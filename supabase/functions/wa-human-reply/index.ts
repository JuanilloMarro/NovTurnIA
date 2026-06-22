// supabase/functions/wa-human-reply/index.ts
// Edge Function: respuesta humana de WhatsApp (handoff de agente).
//
// El agente escribe desde el dashboard → esta función envía el mensaje por la
// Cloud API de Meta del tenant y lo registra. Reemplaza al webhook de n8n para
// el envío SALIENTE; n8n queda solo para los mensajes ENTRANTES (la IA).
//
// Seguridad:
//   - El business_id se deriva del JWT (staff_users), NUNCA del body → anti cross-tenant.
//   - El whatsapp_token vive en `businesses` y solo lo toca esta función (service_role).
//   - Permiso requerido: toggle_ai (el mismo que gatea el composer en el frontend).
//   - Es el único escritor de `history` con role='agent' (el dashboard solo hace
//     optimistic append local), por eso no hay filas duplicadas.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/auth.ts';

// Versión de la Graph API de Meta. Override opcional vía secret WHATSAPP_API_VERSION.
const GRAPH_API_VERSION = Deno.env.get('WHATSAPP_API_VERSION') || 'v21.0';
const WINDOW_24H_MS = 24 * 60 * 60 * 1000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Valida el token de Supabase y carga el perfil del agente (business_id + permisos).
async function getCallerProfile(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await supabaseAdmin
    .from('staff_users')
    .select('id, business_id, staff_roles(permissions)')
    .eq('id', user.id)
    .eq('active', true)
    .single();

  return profile ?? null;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return json({ error: 'Método no permitido' }, 405);
    }

    // ── Autenticación ────────────────────────────────────────────────────────
    const caller = await getCallerProfile(req);
    if (!caller) return json({ error: 'No autorizado.' }, 401);

    const permissions = (caller.staff_roles as any)?.permissions ?? {};
    if (!permissions?.toggle_ai) {
      return json({ error: 'No tiene permisos para responder conversaciones.' }, 403);
    }

    // ── Input ────────────────────────────────────────────────────────────────
    const { patient_id, text } = await req.json();
    if (!patient_id || typeof patient_id !== 'string') {
      return json({ error: 'El paciente es requerido.' }, 400);
    }
    const body = typeof text === 'string' ? text.trim() : '';
    if (!body) return json({ error: 'El mensaje está vacío.' }, 400);
    if (body.length > 4096) return json({ error: 'El mensaje es demasiado largo.' }, 400);

    // ── Paciente del mismo negocio + teléfono primario ───────────────────────
    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id, patient_phones(phone, is_primary)')
      .eq('id', patient_id)
      .eq('business_id', caller.business_id)
      .single();

    if (!patient) {
      return json({ error: 'El paciente no existe o no pertenece a este negocio.' }, 404);
    }

    const phones = (patient.patient_phones as any[]) ?? [];
    const primary = phones.find((p) => p.is_primary) ?? phones[0];
    const phone = (primary?.phone || '').replace(/[^\d]/g, '');
    if (!phone) return json({ error: 'El paciente no tiene un teléfono válido.' }, 400);

    // ── Ventana de 24h: último mensaje ENTRANTE del cliente ──────────────────
    const { data: lastInbound } = await supabaseAdmin
      .from('history')
      .select('created_at')
      .eq('patient_id', patient_id)
      .eq('business_id', caller.business_id)
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastTs = lastInbound?.created_at ? new Date(lastInbound.created_at).getTime() : 0;
    if (!lastTs || Date.now() - lastTs > WINDOW_24H_MS) {
      return json({ code: 'WINDOW_EXPIRED', error: 'La ventana de 24h cerró.' }, 409);
    }

    // ── Credenciales WhatsApp del tenant ─────────────────────────────────────
    const { data: business } = await supabaseAdmin
      .from('businesses')
      .select('phone_number_id, whatsapp_token')
      .eq('id', caller.business_id)
      .single();

    if (!business?.phone_number_id || !business?.whatsapp_token) {
      return json({ error: 'WhatsApp no está configurado para este negocio.' }, 400);
    }

    // ── Envío por la Cloud API de Meta ───────────────────────────────────────
    const graphRes = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${business.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${business.whatsapp_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phone,
          type: 'text',
          text: { preview_url: false, body },
        }),
      },
    );

    if (!graphRes.ok) {
      let errBody: any = null;
      try { errBody = await graphRes.json(); } catch { /* sin JSON */ }
      const metaCode = errBody?.error?.code;
      // 131047 / 131051: Meta (autoridad final) rechaza por estar fuera de la ventana de 24h
      if (metaCode === 131047 || metaCode === 131051) {
        return json({ code: 'WINDOW_EXPIRED', error: 'La ventana de 24h cerró.' }, 409);
      }
      console.error('WhatsApp send failed:', graphRes.status, JSON.stringify(errBody));
      return json({ error: 'WhatsApp rechazó el mensaje.', meta: errBody?.error ?? null }, 502);
    }

    // ── Persistencia: history(role='agent') + pausar IA ──────────────────────
    // El INSERT en el padre `history` enruta a la partición del mes automáticamente.
    const { error: histError } = await supabaseAdmin.from('history').insert({
      patient_id,
      business_id: caller.business_id,
      role: 'agent',
      content: body,
    });
    if (histError) {
      // El mensaje YA se envió al cliente; no fallar la request por el log.
      console.error('history insert failed (message already sent):', JSON.stringify(histError));
    }

    await supabaseAdmin
      .from('patients')
      .update({ human_takeover: true })
      .eq('id', patient_id)
      .eq('business_id', caller.business_id);

    return json({ ok: true }, 200);
  } catch (err) {
    console.error('wa-human-reply error:', err);
    return json({ error: 'Error interno del servidor.' }, 500);
  }
});
