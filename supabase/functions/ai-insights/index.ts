// supabase/functions/ai-insights/index.ts
// Centro IA — insights bajo demanda (doc "Automatización Agente IA" Parte B §B.1.2).
// Cache-first: la UI ya lee ai_insights directo; esta función es la ÚNICA que
// gasta tokens. business_id se deriva del JWT del caller, JAMÁS del body.
//
// Fix 2026-07-16: los budgets ahora son de salida REAL (el thinking de los
// modelos 2.5 va apagado en _shared/gemini.ts — antes se comía el budget y
// truncaba la respuesta), y si Gemini no devuelve el JSON del schema la
// función responde 502 SIN insertar en ai_insights (antes cacheaba { raw }).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/auth.ts';
import { callGeminiJSON, costMicroUsd } from '../_shared/gemini.ts';

const VALID_SCOPES = ['patient_summary', 'patient_strategy', 'retention', 'kpi_narrative', 'weekly_digest', 'content_offer', 'finance_narrative', 'agenda_narrative'];
const NEEDS_PATIENT = new Set(['patient_summary', 'patient_strategy']);

// Horas de frescura del cache antes de permitir servir sin regenerar (doc B.1.2 paso 2).
const CACHE_HOURS: Record<string, number> = {
  patient_summary: 24 * 7,
  patient_strategy: 24 * 7,
  retention: 24 * 7,
  kpi_narrative: 24,
  weekly_digest: 24 * 7,
  content_offer: 24 * 7,
  finance_narrative: 24,
  agenda_narrative: 6,
};

const SCHEMAS: Record<string, object> = {
  patient_summary: {
    type: 'OBJECT',
    properties: {
      resumen: { type: 'STRING' },
      estado: { type: 'STRING', enum: ['activo', 'en_riesgo', 'inactivo', 'nuevo'] },
      siguiente_accion: { type: 'STRING' },
    },
    required: ['resumen', 'estado', 'siguiente_accion'],
  },
  patient_strategy: {
    type: 'OBJECT',
    properties: {
      accion: { type: 'STRING' },
      razon: { type: 'STRING' },
      borrador_whatsapp: { type: 'STRING' },
    },
    required: ['accion', 'razon', 'borrador_whatsapp'],
  },
  retention: {
    type: 'OBJECT',
    properties: {
      tasa_retencion: { type: 'NUMBER' },
      prioridades: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: { nombre: { type: 'STRING' }, razon: { type: 'STRING' }, sugerencia: { type: 'STRING' } },
          required: ['nombre', 'razon', 'sugerencia'],
        },
      },
      insight_general: { type: 'STRING' },
    },
    required: ['tasa_retencion', 'prioridades', 'insight_general'],
  },
  kpi_narrative: {
    type: 'OBJECT',
    properties: {
      titular: { type: 'STRING' },
      analisis: { type: 'STRING' },
      recomendaciones: { type: 'ARRAY', items: { type: 'STRING' } },
    },
    required: ['titular', 'analisis', 'recomendaciones'],
  },
  weekly_digest: {
    type: 'OBJECT',
    properties: {
      semana: { type: 'STRING' },
      resumen: { type: 'STRING' },
      wins: { type: 'ARRAY', items: { type: 'STRING' } },
      alertas: { type: 'ARRAY', items: { type: 'STRING' } },
      foco_siguiente_semana: { type: 'STRING' },
    },
    required: ['semana', 'resumen', 'wins', 'alertas', 'foco_siguiente_semana'],
  },
  content_offer: {
    type: 'OBJECT',
    properties: {
      promos: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            servicio: { type: 'STRING' },
            descuento_sugerido: { type: 'STRING' },
            dias: { type: 'STRING' },
            copy: { type: 'STRING' },
          },
          required: ['servicio', 'copy'],
        },
      },
    },
    required: ['promos'],
  },
  finance_narrative: {
    type: 'OBJECT',
    properties: {
      titular: { type: 'STRING' },
      salud: { type: 'STRING', enum: ['buena', 'atencion', 'critica'] },
      analisis: { type: 'STRING' },
      recomendaciones: { type: 'ARRAY', items: { type: 'STRING' } },
    },
    required: ['titular', 'salud', 'analisis', 'recomendaciones'],
  },
  agenda_narrative: {
    type: 'OBJECT',
    properties: {
      titular: { type: 'STRING' },
      analisis: { type: 'STRING' },
      huecos: { type: 'ARRAY', items: { type: 'STRING' } },
      recomendaciones: { type: 'ARRAY', items: { type: 'STRING' } },
    },
    required: ['titular', 'analisis', 'huecos', 'recomendaciones'],
  },
};

// Presupuestos de SALIDA real por scope (el thinking va apagado en el cliente:
// con los valores viejos de 250-500 y thinking activo, content_offer y
// patient_strategy salían truncados a 3-8 tokens — bug del 2026-07-14).
const MODEL_CONFIG: Record<string, { model: string; maxOutputTokens: number }> = {
  patient_summary: { model: 'gemini-2.5-flash-lite', maxOutputTokens: 320 },
  patient_strategy: { model: 'gemini-2.5-flash', maxOutputTokens: 512 },
  retention: { model: 'gemini-2.5-flash', maxOutputTokens: 1024 },
  kpi_narrative: { model: 'gemini-2.5-flash', maxOutputTokens: 768 },
  weekly_digest: { model: 'gemini-2.5-flash-lite', maxOutputTokens: 768 },
  content_offer: { model: 'gemini-2.5-flash', maxOutputTokens: 768 },
  finance_narrative: { model: 'gemini-2.5-flash', maxOutputTokens: 768 },
  agenda_narrative: { model: 'gemini-2.5-flash-lite', maxOutputTokens: 640 },
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

function activeOffersFilter(query: any) {
  const nowIso = new Date().toISOString();
  return query
    .eq('active', true)
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`);
}

async function buildContext(scope: string, businessId: string, refId: string | null) {
  if (NEEDS_PATIENT.has(scope)) {
    const { data: profile } = await supabaseAdmin.rpc('get_patient_profile', { p_business_id: businessId, p_patient_id: refId });
    const { data: history } = await supabaseAdmin
      .from('history')
      .select('role, content')
      .eq('business_id', businessId)
      .eq('patient_id', refId)
      .order('created_at', { ascending: false })
      .limit(15);
    const { data: appts } = await supabaseAdmin
      .from('appointments')
      .select('date_start, status')
      .eq('business_id', businessId)
      .eq('patient_id', refId)
      .gte('date_start', new Date().toISOString())
      .order('date_start', { ascending: true })
      .limit(3);

    const base = {
      perfil: profile,
      historial: (history ?? []).reverse().map((h: any) => ({ role: h.role, texto: (h.content || '').slice(0, 150) })),
      citas: appts ?? [],
    };

    if (scope === 'patient_strategy') {
      const { data: offers } = await activeOffersFilter(
        supabaseAdmin.from('offers').select('name, description, promo_price').eq('business_id', businessId)
      ).limit(5);
      return { ...base, ofertas: offers ?? [] };
    }
    return base;
  }

  // Finanzas: pack propio con business_id explícito (mes actual vs anterior,
  // por cobrar, meta, turnos futuros) — RPC solo llamable con service_role.
  if (scope === 'finance_narrative') {
    const { data: finPack } = await supabaseAdmin.rpc('get_finance_pack', { p_business_id: businessId });
    return finPack ?? {};
  }

  // Agenda de hoy: turnos del día (hora, cliente, servicio, estado) — pack
  // liviano de KPIs para contexto, más la lista cruda de citas de hoy (el
  // modelo razona los huecos, no se precalculan en código).
  if (scope === 'agenda_narrative') {
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
    const { data: todays } = await supabaseAdmin
      .from('appointments')
      .select('date_start, date_end, status, confirmed, patients(display_name), services(name)')
      .eq('business_id', businessId)
      .gte('date_start', dayStart.toISOString())
      .lt('date_start', dayEnd.toISOString())
      .order('date_start', { ascending: true });
    const { data: pack } = await supabaseAdmin.rpc('get_business_context_pack', { p_business_id: businessId });
    return {
      ...pack,
      turnos_hoy: (todays ?? []).map((a: any) => ({
        hora: a.date_start,
        hora_fin: a.date_end,
        cliente: a.patients?.display_name ?? null,
        servicio: a.services?.name ?? null,
        estado: a.status,
        confirmado: a.confirmed,
      })),
    };
  }

  const { data: pack } = await supabaseAdmin.rpc('get_business_context_pack', { p_business_id: businessId });

  if (scope === 'retention') {
    const { data: atRisk } = await supabaseAdmin.rpc('get_at_risk_patients', { p_business_id: businessId, p_limit: 15 });
    return { ...pack, pacientes_en_riesgo: atRisk ?? [] };
  }

  if (scope === 'content_offer') {
    const { data: offers } = await activeOffersFilter(
      supabaseAdmin.from('offers').select('name, promo_price').eq('business_id', businessId)
    ).limit(10);
    return { ...pack, ofertas_activas: offers ?? [] };
  }

  return pack;
}

function buildPrompt(scope: string, ctx: unknown): string {
  const datos = `DATOS: ${JSON.stringify(ctx)}`;
  switch (scope) {
    case 'patient_summary':
      return `Eres el asistente clínico/comercial de este negocio. Con el PERFIL, el HISTORIAL de chat y las CITAS próximas del cliente (en DATOS), resume su situación para el dueño. Sé concreto y breve. Responde SOLO el JSON del schema.\n${datos}`;
    case 'patient_strategy':
      return `Eres el asistente comercial de este negocio. Con el PERFIL del cliente y las OFERTAS activas (en DATOS), propone UNA acción comercial concreta según su prioridad (alta: fidelizar/upsell, media: recurrencia, en_riesgo: reactivar) y redacta un borrador de WhatsApp breve (máximo 300 caracteres, tono cercano guatemalteco). Responde SOLO el JSON del schema.\n${datos}`;
    case 'retention':
      return `Eres el analista de retención de este negocio. Con los pacientes en riesgo (más de 45 días sin venir, 2 o más visitas) y los KPIs (en DATOS), prioriza a quién contactar esta semana y por qué. Máximo 5. Responde SOLO el JSON del schema.\n${datos}`;
    case 'kpi_narrative':
      return `Eres el analista de este negocio. Con los KPIs del mes (en DATOS), explica en lenguaje de dueño el porqué detrás de los números y da 3 recomendaciones accionables. Responde SOLO el JSON del schema.\n${datos}`;
    case 'weekly_digest':
      return `Eres el analista de este negocio. Con los datos de esta semana (en DATOS), arma un resumen ejecutivo: qué salió bien, qué necesita atención, y el foco de la próxima semana. Responde SOLO el JSON del schema.\n${datos}`;
    case 'content_offer':
      return `Eres el asistente de marketing de este negocio. Con los servicios top y las ofertas activas (en DATOS), sugiere 1 o 2 promos para llenar días/horarios flojos y redacta el copy de cada una (WhatsApp status/story, máximo 280 caracteres). Responde SOLO el JSON del schema.\n${datos}`;
    case 'finance_narrative':
      return `Eres el asesor financiero de este negocio. Con las finanzas del mes (en DATOS: ingresos/egresos del mes y del anterior, costo de insumos, egresos por categoría, servicios top con costo, cuentas por cobrar, meta mensual y turnos futuros), evalúa la salud financiera (buena/atencion/critica), explica el porqué en lenguaje de dueño con números concretos y da 3 recomendaciones accionables. Si hay saldo por cobrar alto o la meta se ve lejos, menciónalo. Responde SOLO el JSON del schema.\n${datos}`;
    case 'agenda_narrative':
      return `Eres el asistente de agenda de este negocio. Con la lista de turnos de HOY (hora, cliente, servicio, estado, confirmado) y el horario del negocio (en DATOS), arma un briefing corto: cuántos turnos hay y cómo viene el día, identifica huecos grandes sin turnos dentro del horario laboral (como lista de rangos de hora en texto, ej. "2:00pm - 4:00pm") y turnos aún sin confirmar que convendría recordar. Da 2-3 recomendaciones accionables para aprovechar mejor el día. Responde SOLO el JSON del schema.\n${datos}`;
    default:
      return datos;
  }
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
    const scope = body.scope;
    const refId = body.ref_id ?? null;
    const regenerate = body.regenerate !== false;

    if (!VALID_SCOPES.includes(scope)) return json({ error: 'Scope inválido.' }, 400);
    if (NEEDS_PATIENT.has(scope) && !refId) return json({ error: 'Este análisis requiere elegir un cliente.' }, 400);

    if (!regenerate) {
      let cacheQuery = supabaseAdmin
        .from('ai_insights')
        .select('id, scope, ref_id, content, generated_at')
        .eq('business_id', caller.business_id)
        .eq('scope', scope)
        .order('generated_at', { ascending: false })
        .limit(1);
      cacheQuery = refId ? cacheQuery.eq('ref_id', refId) : cacheQuery.is('ref_id', null);
      const { data: cached } = await cacheQuery.maybeSingle();
      if (cached) {
        const ageHours = (Date.now() - new Date(cached.generated_at).getTime()) / 3_600_000;
        if (ageHours < (CACHE_HOURS[scope] ?? 24)) return json({ data: cached });
      }
    }

    const { data: rateCount } = await supabaseAdmin.rpc('check_rate_limit', {
      p_key: `ai:${caller.business_id}`,
      p_window_start: new Date(new Date().setMinutes(0, 0, 0, 0)).toISOString(),
    });
    if ((rateCount ?? 0) > 30) return json({ error: 'Alcanzaste el límite de análisis IA de esta hora. Probá de nuevo en un rato.' }, 429);

    // Presupuesto semanal de tokens del plan — después del cache (leer cache es
    // gratis y no se bloquea) y ANTES de gastar en Gemini. Vive en la DB.
    const { data: budget } = await supabaseAdmin.rpc('check_ai_budget', { p_business_id: caller.business_id });
    if (budget && budget.allowed === false) {
      return json({
        error: 'Alcanzaste tu límite semanal de IA del plan. Se reinicia el lunes.',
        code: 'ai_limit_reached',
        resets_at: budget.resets_at ?? null,
      }, 429);
    }

    const context = await buildContext(scope, caller.business_id, refId);
    const { model, maxOutputTokens } = MODEL_CONFIG[scope];
    const prompt = buildPrompt(scope, context);

    // Si Gemini no devuelve el JSON del schema (tras el reintento interno del
    // cliente), NO se cachea nada: el usuario reintenta y el feed queda limpio.
    let generated;
    try {
      generated = await callGeminiJSON(model, prompt, SCHEMAS[scope], maxOutputTokens);
    } catch (aiErr) {
      console.error('ai-insights gemini error:', aiErr);
      return json({ error: 'La IA no devolvió un análisis válido. Volvé a intentarlo en un momento.' }, 502);
    }
    const { content, tokensIn, tokensOut } = generated;

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('ai_insights')
      .insert({
        business_id: caller.business_id,
        scope,
        ref_id: refId,
        content,
        model,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        generated_by: caller.id,
      })
      .select('id, scope, ref_id, content, generated_at')
      .single();
    if (insertError) throw insertError;

    // Contador semanal del Centro IA (tokens + costo real). Ya NO se toca
    // usage_counters: ese contador mensual es exclusivo del bot de WhatsApp.
    await supabaseAdmin.rpc('record_ai_usage', {
      p_business_id: caller.business_id,
      p_tokens_in: tokensIn,
      p_tokens_out: tokensOut,
      p_cost_microusd: costMicroUsd(model, tokensIn, tokensOut),
      p_requests: 1,
    });

    return json({ data: inserted });
  } catch (err) {
    console.error('ai-insights error:', err);
    return json({ error: err instanceof Error ? err.message : 'Error interno del servidor.' }, 500);
  }
});
