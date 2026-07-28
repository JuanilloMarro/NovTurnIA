// supabase/functions/ai-chat/index.ts
// Centro IA — chat de negocio (doc "Automatización Agente IA" Parte B §B.1.2 y §B.2.7).
// Router de intents (flash-lite, barato) → fetch determinista (0 tokens) →
// respuesta final (flash). Nunca le damos al LLM acceso SQL libre: el router +
// allowlist de RPCs/tablas ES la seguridad. business_id viene del JWT, no del body.
// Devuelve también los ids de los 2 mensajes insertados (usuario+asistente)
// para que el frontend pueda borrarlos individualmente sin recargar el hilo.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/auth.ts';
import { callGeminiJSON, callGeminiText, costMicroUsd, GeminiError } from '../_shared/gemini.ts';
import { checkAiBudget, recordAiUsage } from '../_shared/aiBudget.ts';

const ROUTER_SCHEMA = {
  type: 'OBJECT',
  properties: {
    intent: { type: 'STRING', enum: ['kpis', 'finanzas', 'retencion', 'pacientes', 'servicios', 'agenda', 'general'] },
    entidad: { type: 'STRING' },
  },
  required: ['intent'],
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function getCallerProfile(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await supabaseAdmin
    .from('staff_users')
    .select('id, business_id')
    .eq('id', user.id)
    .eq('active', true)
    .single();
  return profile ?? null;
}

async function fetchForIntent(intent: string, entidad: string | undefined, businessId: string) {
  if (intent === 'pacientes') {
    if (!entidad) return { error: 'No se especificó el nombre del cliente.' };
    const { data: patients } = await supabaseAdmin
      .from('patients')
      .select('id, display_name')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .ilike('display_name', `%${entidad.trim()}%`)
      .limit(3);
    if (!patients?.length) return { error: `No encontré un cliente que coincida con "${entidad}".` };
    const { data: profile } = await supabaseAdmin.rpc('get_patient_profile', { p_business_id: businessId, p_patient_id: patients[0].id });
    return { cliente: patients[0].display_name, perfil: profile };
  }

  if (intent === 'agenda') {
    const { data: appts } = await supabaseAdmin
      .from('appointments')
      .select('date_start, status, patients(display_name)')
      .eq('business_id', businessId)
      .gte('date_start', new Date().toISOString())
      .in('status', ['scheduled', 'confirmed'])
      .order('date_start', { ascending: true })
      .limit(10);
    return { proximos_turnos: (appts ?? []).map((a: any) => ({ fecha: a.date_start, estado: a.status, cliente: a.patients?.display_name })) };
  }

  const { data: pack } = await supabaseAdmin.rpc('get_business_context_pack', { p_business_id: businessId });

  if (intent === 'retencion') {
    const { data: atRisk } = await supabaseAdmin.rpc('get_at_risk_patients', { p_business_id: businessId, p_limit: 10 });
    return { ...pack, pacientes_en_riesgo: atRisk ?? [] };
  }

  if (intent === 'finanzas') {
    return { finanzas: pack?.finanzas ?? {} };
  }

  // kpis | servicios | general
  return pack;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

    const caller = await getCallerProfile(req);
    if (!caller) return json({ error: 'No autorizado.' }, 401);

    const { data: unlocked } = await supabaseAdmin.rpc('has_feature', { p_feature: 'stats_intelligence', p_business_id: caller.business_id });
    if (!unlocked) return json({ error: 'Esta función no está incluida en tu plan.' }, 403);

    const body = await req.json().catch(() => ({}));
    const message = (body.message || '').toString().trim();
    if (!message) return json({ error: 'Falta el mensaje.' }, 400);
    if (message.length > 500) return json({ error: 'Pregunta muy larga (máximo 500 caracteres).' }, 400);

    const { data: rateCount } = await supabaseAdmin.rpc('check_rate_limit', {
      p_key: `ai:${caller.business_id}`,
      p_window_start: new Date(new Date().setMinutes(0, 0, 0, 0)).toISOString(),
    });
    if ((rateCount ?? 0) > 30) return json({ error: 'Alcanzaste el límite de preguntas IA de esta hora. Probá de nuevo en un rato.' }, 429);

    // Presupuesto semanal de tokens del plan (Pro/Enterprise) — ANTES de insertar
    // el mensaje y de gastar en Gemini. El chequeo vive en la DB: imposible de
    // saltar desde el cliente. (Overshoot máximo: 1 request en vuelo, ~Q0.08.)
    // SEC-3: falla CERRADO — si el chequeo no se puede verificar, 503 mapeable
    // en vez de gastar igual.
    const gate = await checkAiBudget(supabaseAdmin, caller.business_id);
    if (!gate.ok) return json(gate.body, gate.status);

    const { data: userRow } = await supabaseAdmin
      .from('ai_chat_messages')
      .insert({
        business_id: caller.business_id,
        staff_user_id: caller.id,
        role: 'user',
        content: message,
      })
      .select('id')
      .single();

    let intent = 'general';
    let entidad: string | undefined;
    let tokensInTotal = 0;
    let tokensOutTotal = 0;
    let costTotal = 0;
    try {
      const routerPrompt = `Clasifica la pregunta del dueño de un negocio en una categoría y extrae la entidad si aplica (por ejemplo el nombre de un cliente). Responde SOLO el JSON del schema.\nPREGUNTA: ${message}`;
      const routed = await callGeminiJSON('gemini-2.5-flash-lite', routerPrompt, ROUTER_SCHEMA, 60);
      intent = (routed.content as any)?.intent || 'general';
      entidad = (routed.content as any)?.entidad;
      tokensInTotal += routed.tokensIn;
      tokensOutTotal += routed.tokensOut;
      costTotal += costMicroUsd('gemini-2.5-flash-lite', routed.tokensIn, routed.tokensOut);
    } catch (routerErr) {
      // Si el router falla, seguimos con 'general' — no bloquea la pregunta.
      // SEC-4: pero si igual gastó tokens (reintentos internos), se contabilizan.
      if (routerErr instanceof GeminiError) {
        tokensInTotal += routerErr.tokensIn;
        tokensOutTotal += routerErr.tokensOut;
        costTotal += costMicroUsd('gemini-2.5-flash-lite', routerErr.tokensIn, routerErr.tokensOut);
      }
    }

    const datos = await fetchForIntent(intent, entidad, caller.business_id);

    const { data: recent } = await supabaseAdmin
      .from('ai_chat_messages')
      .select('role, content')
      .eq('business_id', caller.business_id)
      .eq('staff_user_id', caller.id)
      .order('created_at', { ascending: false })
      .limit(7);
    const historial = (recent ?? [])
      .slice(1)
      .reverse()
      .map((m: any) => `${m.role === 'user' ? 'Dueño' : 'IA'}: ${(m.content || '').slice(0, 300)}`)
      .join('\n');

    const answerPrompt = `Eres el analista de negocio de este cliente. Responde en español, conciso, con números concretos cuando aplique. Si el dato no está en DATOS, decilo — nunca inventes cifras.\nDATOS: ${JSON.stringify(datos)}\n${historial ? `HISTORIAL RECIENTE:\n${historial}\n` : ''}PREGUNTA: ${message}`;
    let answer: string;
    try {
      const res = await callGeminiText('gemini-2.5-flash', answerPrompt, 400);
      answer = res.text;
      tokensInTotal += res.tokensIn;
      tokensOutTotal += res.tokensOut;
      costTotal += costMicroUsd('gemini-2.5-flash', res.tokensIn, res.tokensOut);
    } catch (answerErr) {
      // SEC-4: la respuesta falló, pero el router (y cualquier intento del
      // answer) ya gastaron tokens que Google cobró. Se descuentan del
      // presupuesto ANTES de devolver el error, en vez de perderse en el 500.
      console.error('ai-chat gemini answer error:', answerErr);
      if (answerErr instanceof GeminiError) {
        tokensInTotal += answerErr.tokensIn;
        tokensOutTotal += answerErr.tokensOut;
        costTotal += costMicroUsd('gemini-2.5-flash', answerErr.tokensIn, answerErr.tokensOut);
      }
      await recordAiUsage(supabaseAdmin, {
        businessId: caller.business_id,
        tokensIn: tokensInTotal,
        tokensOut: tokensOutTotal,
        costMicroUsd: costTotal,
      });
      return json({ error: 'La IA no pudo responder en este momento. Probá de nuevo en un rato.', code: 'ai_generation_failed' }, 502);
    }

    const { data: assistantRow } = await supabaseAdmin
      .from('ai_chat_messages')
      .insert({
        business_id: caller.business_id,
        staff_user_id: caller.id,
        role: 'assistant',
        content: answer,
        tokens_in: tokensInTotal,
        tokens_out: tokensOutTotal,
      })
      .select('id')
      .single();

    // Contador semanal del Centro IA (tokens + costo real). Ya NO se toca
    // usage_counters: ese contador mensual es exclusivo del bot de WhatsApp.
    await recordAiUsage(supabaseAdmin, {
      businessId: caller.business_id,
      tokensIn: tokensInTotal,
      tokensOut: tokensOutTotal,
      costMicroUsd: costTotal,
    });

    return json({ answer, userMessageId: userRow?.id ?? null, assistantMessageId: assistantRow?.id ?? null });
  } catch (err) {
    console.error('ai-chat error:', err);
    return json({ error: err instanceof Error ? err.message : 'Error interno del servidor.' }, 500);
  }
});
