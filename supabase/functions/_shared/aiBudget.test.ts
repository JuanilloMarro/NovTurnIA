// supabase/functions/_shared/aiBudget.test.ts
// SEC-3 / T1 — checkAiBudget debe fallar CERRADO: ante error del RPC o respuesta
// nula, NO habilitar el gasto (ok:false, 503 mapeable) en vez de proceder.
// SEC-4 / T2 — recordAiUsage debe reenviar los tokens al RPC (y no tocar la DB
// si no hay tokens que registrar).
//
// Correr:
//   deno test --allow-env supabase/functions/_shared/aiBudget.test.ts

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { checkAiBudget, recordAiUsage, type RpcClient } from './aiBudget.ts';

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

Deno.test('SEC-3: RPC devuelve error → gate CERRADO (503 ai_budget_check_failed)', async () => {
  const { db } = fakeDb(() => Promise.resolve({ data: null, error: { message: 'DB saturada' } }));
  const gate = await checkAiBudget(db, 'biz-1');
  assertEquals(gate.ok, false);
  assertEquals(gate.status, 503);
  assertEquals((gate.body as Record<string, unknown>).code, 'ai_budget_check_failed');
});

Deno.test('SEC-3: RPC devuelve data null sin error → gate CERRADO (503)', async () => {
  const { db } = fakeDb(() => Promise.resolve({ data: null, error: null }));
  const gate = await checkAiBudget(db, 'biz-1');
  assertEquals(gate.ok, false);
  assertEquals(gate.status, 503);
  assertEquals((gate.body as Record<string, unknown>).code, 'ai_budget_check_failed');
});

Deno.test('presupuesto agotado (allowed:false) → 429 ai_limit_reached con resets_at', async () => {
  const { db } = fakeDb(() => Promise.resolve({ data: { allowed: false, resets_at: '2026-08-03T06:00:00Z' }, error: null }));
  const gate = await checkAiBudget(db, 'biz-1');
  assertEquals(gate.ok, false);
  assertEquals(gate.status, 429);
  assertEquals((gate.body as Record<string, unknown>).code, 'ai_limit_reached');
  assertEquals((gate.body as Record<string, unknown>).resets_at, '2026-08-03T06:00:00Z');
});

Deno.test('presupuesto disponible (allowed:true) → gate ABIERTO', async () => {
  const { db } = fakeDb(() => Promise.resolve({ data: { allowed: true }, error: null }));
  const gate = await checkAiBudget(db, 'biz-1');
  assertEquals(gate.ok, true);
});

Deno.test('SEC-4: recordAiUsage reenvía tokens y costo al RPC record_ai_usage', async () => {
  const { db, calls } = fakeDb(() => Promise.resolve({ data: null, error: null }));
  await recordAiUsage(db, { businessId: 'biz-1', tokensIn: 230, tokensOut: 45, costMicroUsd: 999 });
  assertEquals(calls.length, 1);
  assertEquals(calls[0].fn, 'record_ai_usage');
  assertEquals(calls[0].params.p_business_id, 'biz-1');
  assertEquals(calls[0].params.p_tokens_in, 230);
  assertEquals(calls[0].params.p_tokens_out, 45);
  assertEquals(calls[0].params.p_cost_microusd, 999);
  assertEquals(calls[0].params.p_requests, 1);
});

Deno.test('recordAiUsage no toca la DB si no hay tokens que registrar', async () => {
  const { db, calls } = fakeDb(() => Promise.resolve({ data: null, error: null }));
  await recordAiUsage(db, { businessId: 'biz-1', tokensIn: 0, tokensOut: 0, costMicroUsd: 0 });
  assertEquals(calls.length, 0);
});
