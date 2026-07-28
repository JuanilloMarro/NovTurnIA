// supabase/functions/_shared/aiBudget.integration.test.ts
// Reproduce la composición EXACTA que hacen los handlers (ai-chat / ai-insights),
// usando las mismas funciones compartidas (checkAiBudget → callGeminiJSON →
// recordAiUsage) con el cliente de Supabase y el fetch a Gemini mockeados:
//
//   (a) SEC-3 — el budget check falla → NO se llama a Gemini y se devuelve el
//       error mapeable (ai_budget_check_failed).
//   (c) SEC-4 — callGeminiJSON falla tras N intentos → se registra el consumo
//       acumulado vía record_ai_usage antes de devolver el error.
//
// `simulateSpend` es el mismo control de flujo que el handler: gate → si abre,
// gasta; si Gemini lanza, descuenta los tokens del GeminiError. El handler real
// es glue delgado sobre estas tres funciones (ver ai-insights/index.ts).
//
// Correr:
//   GEMINI_API_KEY=test-key deno test --allow-env supabase/functions/_shared/aiBudget.integration.test.ts

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { checkAiBudget, recordAiUsage, type RpcClient } from './aiBudget.ts';
import { callGeminiJSON, costMicroUsd, GeminiError } from './gemini.ts';

const SCHEMA = { type: 'OBJECT', properties: { foo: { type: 'STRING' } }, required: ['foo'] };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function geminiResult(text: string, tokensIn: number, tokensOut: number) {
  return {
    usageMetadata: { promptTokenCount: tokensIn, candidatesTokenCount: tokensOut },
    candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }],
  };
}

function stubFetch(makeResponses: Array<() => Response>) {
  const original = globalThis.fetch;
  const state = { calls: 0 };
  let i = 0;
  globalThis.fetch = ((..._args: unknown[]) => {
    const make = makeResponses[Math.min(i, makeResponses.length - 1)];
    i++;
    state.calls++;
    return Promise.resolve(make());
  }) as typeof fetch;
  return { restore: () => { globalThis.fetch = original; }, state };
}

type RpcImpl = (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
function fakeDb(impl: RpcImpl) {
  const calls: Array<{ fn: string; params: Record<string, unknown> }> = [];
  const db: RpcClient = {
    rpc(fn, params) {
      calls.push({ fn, params });
      return impl(fn, params);
    },
  };
  return { db, calls };
}

// Mismo control de flujo que el handler ai-insights: gate → gasto → registro.
async function simulateSpend(db: RpcClient, businessId: string, model: string) {
  const gate = await checkAiBudget(db, businessId);
  if (!gate.ok) return { blocked: gate.body, geminiCalled: false, recorded: false };
  try {
    await callGeminiJSON(model, 'prompt', SCHEMA, 60);
    return { blocked: null, geminiCalled: true, recorded: false };
  } catch (aiErr) {
    let recorded = false;
    if (aiErr instanceof GeminiError) {
      await recordAiUsage(db, {
        businessId,
        tokensIn: aiErr.tokensIn,
        tokensOut: aiErr.tokensOut,
        costMicroUsd: costMicroUsd(model, aiErr.tokensIn, aiErr.tokensOut),
      });
      recorded = true;
    }
    return { blocked: null, geminiCalled: true, recorded };
  }
}

Deno.test('(a) SEC-3: budget check falla → Gemini NUNCA se llama y se devuelve error mapeable', async () => {
  const { restore, state } = stubFetch([() => jsonResponse(geminiResult('{"foo":"ok"}', 100, 20))]);
  const { db, calls } = fakeDb((fn) => {
    if (fn === 'check_ai_budget') return Promise.resolve({ data: null, error: { message: 'boom' } });
    return Promise.resolve({ data: null, error: null });
  });
  try {
    const res = await simulateSpend(db, 'biz-1', 'gemini-2.5-flash');
    assertEquals(state.calls, 0, 'no debe haber ni una llamada a Gemini cuando el presupuesto no se pudo verificar');
    assertEquals(res.geminiCalled, false);
    assertEquals((res.blocked as Record<string, unknown>).code, 'ai_budget_check_failed');
    assertEquals(calls.filter((c) => c.fn === 'record_ai_usage').length, 0, 'no se registra consumo si no se gastó');
  } finally {
    restore();
  }
});

Deno.test('(c) SEC-4: callGeminiJSON falla tras N intentos → record_ai_usage con tokens acumulados', async () => {
  const { restore, state } = stubFetch([
    () => jsonResponse(geminiResult('{"bar":1}', 100, 20)), // schema no cumple
    () => jsonResponse(geminiResult('{"bar":2}', 130, 25)), // schema no cumple (reintento)
  ]);
  const { db, calls } = fakeDb((fn) => {
    if (fn === 'check_ai_budget') return Promise.resolve({ data: { allowed: true }, error: null });
    return Promise.resolve({ data: null, error: null });
  });
  try {
    const res = await simulateSpend(db, 'biz-1', 'gemini-2.5-flash');
    assertEquals(state.calls, 2);
    assertEquals(res.recorded, true);
    const usage = calls.filter((c) => c.fn === 'record_ai_usage');
    assertEquals(usage.length, 1, 'los tokens de los intentos fallidos deben descontarse una vez');
    assertEquals(usage[0].params.p_tokens_in, 230); // 100 + 130
    assertEquals(usage[0].params.p_tokens_out, 45); // 20 + 25
    // costo flash: 230*0.30 + 45*2.50 = 69 + 112.5 → round = 182
    assertEquals(usage[0].params.p_cost_microusd, 182);
  } finally {
    restore();
  }
});
