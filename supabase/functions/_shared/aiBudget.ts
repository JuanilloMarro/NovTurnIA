// supabase/functions/_shared/aiBudget.ts
// Fuente única del control de presupuesto semanal de tokens del Centro IA para
// las Edge Functions que gastan en Gemini (ai-chat, ai-insights). NO crea
// contadores nuevos: solo envuelve las RPC ya existentes `check_ai_budget` y
// `record_ai_usage` (fuente de verdad en la base, `ai_usage_weekly`) con las dos
// correcciones P0 de la auditoría de tokens:
//   SEC-3 / T1 — fallar CERRADO si el chequeo de presupuesto no se puede verificar.
//   SEC-4 / T2 — registrar los tokens de intentos fallidos, que Google ya cobró.
//
// El bot de WhatsApp NO usa este módulo: esa es otra bolsa (usage_counters por
// mensajes) y jamás debe tocar ai_usage_weekly.

// Cliente mínimo que necesitamos del supabase-js: solo `.rpc`. Se inyecta para
// poder probar la lógica sin red ni cliente real (los callers pasan supabaseAdmin).
// El retorno se tipa como PromiseLike, no Promise: el `.rpc()` real devuelve un
// PostgrestFilterBuilder (thenable, sin catch/finally) — con `await` funciona
// igual, y PromiseLike lo acepta estructuralmente.
export interface RpcClient {
  rpc(fn: string, params: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
}

// Resultado del portón de presupuesto. `ok:true` es la ÚNICA vía para gastar.
export interface BudgetGate {
  ok: boolean;
  status?: number; // status HTTP a devolver cuando ok=false
  body?: Record<string, unknown>; // cuerpo JSON mapeable por el frontend cuando ok=false
}

// SEC-3 / T1 — El código viejo hacía `const { data: budget } = await rpc(...)` y
// DESCARTABA el error. Si el RPC fallaba (función ausente, permisos, DB saturada),
// `budget` quedaba null, la condición `budget && budget.allowed === false` daba
// falso y la función GASTABA igual: el techo de tokens se apagaba solo ante
// cualquier fallo. Acá capturamos el error y, si no podemos CONFIRMAR que el
// negocio tiene presupuesto (error del RPC o respuesta nula), fallamos cerrado
// con un 503 mapeable — nunca dejamos pasar la request a Gemini "por las dudas".
export async function checkAiBudget(db: RpcClient, businessId: string): Promise<BudgetGate> {
  const { data: budget, error } = await db.rpc('check_ai_budget', { p_business_id: businessId });

  if (error || budget == null) {
    console.error(
      'check_ai_budget no verificable — fallando cerrado (SEC-3):',
      error ?? 'respuesta nula',
      { businessId },
    );
    return {
      ok: false,
      status: 503,
      body: {
        error: 'No pudimos verificar tu límite semanal de IA en este momento. Probá de nuevo en un rato.',
        code: 'ai_budget_check_failed',
      },
    };
  }

  if ((budget as { allowed?: unknown }).allowed === false) {
    return {
      ok: false,
      status: 429,
      body: {
        error: 'Alcanzaste tu límite semanal de IA del plan. Se reinicia el lunes.',
        code: 'ai_limit_reached',
        resets_at: (budget as { resets_at?: unknown }).resets_at ?? null,
      },
    };
  }

  return { ok: true };
}

// SEC-4 / T2 — Registra en el contador semanal (ai_usage_weekly, vía
// record_ai_usage) los tokens consumidos, tanto en la ruta de ÉXITO como en la
// de FALLO. `costMicroUsd` viene pre-calculado por el caller porque un solo
// request puede mezclar modelos (ai-chat: router flash-lite + respuesta flash) y
// cada uno tiene tarifa distinta. Si no hay tokens que registrar, no toca la DB.
// El resultado se verifica y se loguea si falla, para no perder el descuento en
// silencio (el reintento/reconciliación es T3/S3, fuera de este alcance).
export async function recordAiUsage(
  db: RpcClient,
  params: { businessId: string; tokensIn: number; tokensOut: number; costMicroUsd: number; requests?: number },
): Promise<void> {
  const { businessId, tokensIn, tokensOut, costMicroUsd, requests = 1 } = params;
  if (tokensIn <= 0 && tokensOut <= 0) return;

  const { error } = await db.rpc('record_ai_usage', {
    p_business_id: businessId,
    p_tokens_in: tokensIn,
    p_tokens_out: tokensOut,
    p_cost_microusd: costMicroUsd,
    p_requests: requests,
  });

  if (error) {
    console.error(
      'record_ai_usage falló — tokens NO descontados del presupuesto (SEC-4/T3):',
      error,
      { businessId, tokensIn, tokensOut },
    );
  }
}
