// supabase/functions/_shared/fetchUpstream.test.ts
//
// Verificación de EDGE-1 (timeouts) y EDGE-2 (reintentos a terceros).
// Correr:  deno test --allow-net supabase/functions/_shared/fetchUpstream.test.ts
//
// Asserts inline (sin import remoto) para que la suite sea hermética: no depende
// de red salvo los dos tests de integración real, que usan solo loopback.

import { fetchUpstream, isRetryableStatus } from './fetchUpstream.ts';

// ── mini-assert ──────────────────────────────────────────────────────────────
function assert(cond: unknown, msg = 'assertion failed'): asserts cond {
  if (!cond) throw new Error(msg);
}
function assertEquals<T>(actual: T, expected: T, msg?: string): void {
  if (actual !== expected) throw new Error(msg ?? `esperaba ${String(expected)}, obtuve ${String(actual)}`);
}
const noSleep = (): Promise<void> => Promise.resolve();

// ── mocks de fetch ─────────────────────────────────────────────────────────
/** fetch que devuelve la secuencia de status dada (repite el último) y cuenta llamadas. */
function seqFetch(statuses: number[], headersPer: Array<Record<string, string>> = []) {
  let n = 0;
  const fn: typeof fetch = () => {
    const i = n++;
    const status = statuses[Math.min(i, statuses.length - 1)];
    const headers = headersPer[Math.min(i, headersPer.length - 1)] ?? {};
    return Promise.resolve(new Response(JSON.stringify({ i }), { status, headers }));
  };
  return { fn, count: () => n };
}

/** fetch que se cuelga: nunca resuelve, solo rechaza cuando el signal aborta. */
function hangFetch() {
  let n = 0;
  const fn: typeof fetch = (_url, init) => {
    n++;
    const signal = (init as RequestInit | undefined)?.signal;
    return new Promise<Response>((_resolve, reject) => {
      if (!signal) return; // sin signal (pre-fix) se cuelga para siempre
      if (signal.aborted) return reject(signal.reason);
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
  };
  return { fn, count: () => n };
}

// ── EDGE-1: TIMEOUTS ─────────────────────────────────────────────────────────

Deno.test('EDGE-1 · upstream colgado aborta cerca del timeout, no al límite de pared', async () => {
  const h = hangFetch();
  const start = performance.now();
  let threw: Error | null = null;
  try {
    await fetchUpstream('https://upstream.test/', { fetchImpl: h.fn, timeoutMs: 200, tries: 1, sleepImpl: noSleep });
  } catch (e) {
    threw = e as Error;
  }
  const elapsed = performance.now() - start;
  assert(threw !== null, 'un upstream colgado debe lanzar por timeout, no colgarse');
  assertEquals(threw!.name, 'UpstreamError', 'debe ser UpstreamError');
  assert(elapsed >= 180 && elapsed < 1500, `abortó en ${elapsed.toFixed(0)}ms, se esperaba ~200ms (no el límite de pared)`);
  assertEquals(h.count(), 1, 'tries=1 no debe reintentar');
});

Deno.test('EDGE-1 · el timeout se reintenta hasta agotar tries y luego lanza', async () => {
  const h = hangFetch();
  const start = performance.now();
  let threw = false;
  try {
    await fetchUpstream('https://upstream.test/', { fetchImpl: h.fn, timeoutMs: 100, tries: 3, sleepImpl: noSleep });
  } catch {
    threw = true;
  }
  const elapsed = performance.now() - start;
  assert(threw, 'tras agotar 3 timeouts debe lanzar');
  assertEquals(h.count(), 3, 'debe intentar 3 veces (el timeout es transitorio)');
  assert(elapsed >= 270 && elapsed < 2000, `3×100ms ≈ 300ms, fue ${elapsed.toFixed(0)}ms`);
});

// ── EDGE-2: REINTENTOS ───────────────────────────────────────────────────────

Deno.test('EDGE-2 · 503 dos veces y luego 200: reintenta y termina OK', async () => {
  const s = seqFetch([503, 503, 200]);
  const res = await fetchUpstream('https://upstream.test/', { fetchImpl: s.fn, tries: 3, sleepImpl: noSleep, random: () => 0 });
  await res.body?.cancel();
  assertEquals(res.status, 200, 'debe terminar en 200 tras los reintentos');
  assertEquals(s.count(), 3, 'debe haber intentado 3 veces');
});

Deno.test('EDGE-2 · 400 (error de negocio) NO se reintenta', async () => {
  const s = seqFetch([400, 200, 200]);
  const res = await fetchUpstream('https://upstream.test/', { fetchImpl: s.fn, tries: 3, sleepImpl: noSleep });
  await res.body?.cancel();
  assertEquals(res.status, 400, 'un 400 se devuelve tal cual');
  assertEquals(s.count(), 1, 'un 4xx no-429 no debe reintentar');
});

Deno.test('EDGE-2 · 404 y 401 tampoco se reintentan', async () => {
  for (const status of [401, 403, 404]) {
    const s = seqFetch([status, 200]);
    const res = await fetchUpstream('https://upstream.test/', { fetchImpl: s.fn, tries: 3, sleepImpl: noSleep });
    await res.body?.cancel();
    assertEquals(res.status, status, `${status} se devuelve tal cual`);
    assertEquals(s.count(), 1, `${status} no debe reintentar`);
  }
});

Deno.test('EDGE-2 · 5xx persistente devuelve la última respuesta (no lanza)', async () => {
  const s = seqFetch([503, 503, 503]);
  const res = await fetchUpstream('https://upstream.test/', { fetchImpl: s.fn, tries: 3, sleepImpl: noSleep, random: () => 0 });
  await res.body?.cancel();
  assertEquals(res.status, 503, 'con respuesta HTTP real, aunque sea 5xx, se devuelve (el caller la clasifica)');
  assertEquals(s.count(), 3, 'agotó los 3 intentos');
});

Deno.test('EDGE-2 · error de red se reintenta', async () => {
  let n = 0;
  const fn: typeof fetch = () => {
    n++;
    if (n < 2) return Promise.reject(new TypeError('error de conexión'));
    return Promise.resolve(new Response('ok', { status: 200 }));
  };
  const res = await fetchUpstream('https://upstream.test/', { fetchImpl: fn, tries: 3, sleepImpl: noSleep });
  await res.body?.cancel();
  assertEquals(res.status, 200);
  assertEquals(n, 2, 'el error de red del 1er intento debe reintentarse');
});

Deno.test('EDGE-2 · 429 se reintenta y respeta Retry-After', async () => {
  const s = seqFetch([429, 200], [{ 'retry-after': '2' }, {}]);
  const slept: number[] = [];
  const res = await fetchUpstream('https://upstream.test/', {
    fetchImpl: s.fn,
    tries: 3,
    sleepImpl: (ms) => { slept.push(ms); return Promise.resolve(); },
  });
  await res.body?.cancel();
  assertEquals(res.status, 200);
  assertEquals(s.count(), 2, '429 es transitorio: debe reintentar');
  assertEquals(slept.length, 1, 'una sola espera antes del reintento');
  assertEquals(slept[0], 2000, 'debe respetar Retry-After: 2s = 2000ms, no el jitter');
});

Deno.test('EDGE-2 · el backoff usa full jitter (random × techo), no un valor fijo', async () => {
  // random controlado: el sleep del intento 1 debe ser random × min(cap, base·2^0).
  const s = seqFetch([503, 503, 200]);
  const slept: number[] = [];
  await (await fetchUpstream('https://upstream.test/', {
    fetchImpl: s.fn,
    tries: 3,
    baseDelayMs: 400,
    backoffCapMs: 8000,
    random: () => 0.5, // jitter al 50% del techo
    sleepImpl: (ms) => { slept.push(ms); return Promise.resolve(); },
  })).body?.cancel();
  // intento 1: techo = min(8000, 400·2^0)=400 → 0.5·400 = 200
  // intento 2: techo = min(8000, 400·2^1)=800 → 0.5·800 = 400
  assertEquals(slept.length, 2, 'dos esperas para tres intentos');
  assertEquals(slept[0], 200, 'jitter intento 1 = 0.5 × 400');
  assertEquals(slept[1], 400, 'jitter intento 2 = 0.5 × 800 (backoff exponencial)');
});

Deno.test('presupuesto total (budgetMs) corta los reintentos aunque queden tries', async () => {
  const s = seqFetch([503, 503, 503, 503, 503, 503, 503, 503]);
  const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const start = performance.now();
  const res = await fetchUpstream('https://upstream.test/', {
    fetchImpl: s.fn,
    tries: 20,
    timeoutMs: 50,
    budgetMs: 150,
    baseDelayMs: 50,
    backoffCapMs: 50,
    random: () => 1, // peor caso de jitter para consumir presupuesto
    sleepImpl: realSleep,
  });
  await res.body?.cancel();
  const elapsed = performance.now() - start;
  assertEquals(res.status, 503);
  assert(s.count() < 20, `el budget debe cortar antes de 20 intentos, hubo ${s.count()}`);
  assert(elapsed < 600, `no debe exceder mucho el budget de 150ms, fue ${elapsed.toFixed(0)}ms`);
});

Deno.test('isRetryableStatus: 429 y 5xx sí; 2xx/3xx/4xx no', () => {
  for (const s of [429, 500, 502, 503, 504]) assert(isRetryableStatus(s), `${s} debe ser transitorio`);
  for (const s of [200, 201, 301, 400, 401, 403, 404, 409, 422]) assert(!isRetryableStatus(s), `${s} no debe reintentar`);
});

// ── INTEGRACIÓN REAL (loopback) — fetch global + AbortSignal reales ──────────

Deno.test('integración real · 503→503→200 sobre HTTP real con el fetch global', async () => {
  let hits = 0;
  const ac = new AbortController();
  const server = Deno.serve({ port: 0, signal: ac.signal, onListen: () => {} }, () => {
    hits++;
    const status = hits < 3 ? 503 : 200;
    return new Response(JSON.stringify({ hits }), { status, headers: { 'content-type': 'application/json' } });
  });
  const { port } = server.addr as Deno.NetAddr;

  const res = await fetchUpstream(`http://127.0.0.1:${port}/`, { tries: 3, sleepImpl: noSleep });
  const body = await res.json();

  assertEquals(res.status, 200, 'debe terminar en 200 con fetch real');
  assertEquals(hits, 3, 'el servidor real recibió 3 intentos');
  assertEquals(body.hits, 3);

  ac.abort();
  await server.finished;
});

Deno.test('integración real · servidor colgado aborta cerca del timeout con fetch real', async () => {
  const ac = new AbortController();
  const server = Deno.serve({ port: 0, signal: ac.signal, onListen: () => {} }, (req) =>
    // Nunca responde; resuelve solo cuando el cliente aborta (cierra conexión).
    new Promise<Response>((resolve) => {
      req.signal.addEventListener('abort', () => resolve(new Response(null, { status: 499 })), { once: true });
    })
  );
  const { port } = server.addr as Deno.NetAddr;

  const start = performance.now();
  let threw = false;
  try {
    await fetchUpstream(`http://127.0.0.1:${port}/`, { timeoutMs: 300, tries: 1, sleepImpl: noSleep });
  } catch {
    threw = true;
  }
  const elapsed = performance.now() - start;

  ac.abort();
  await server.finished;

  assert(threw, 'un servidor colgado real debe abortar por timeout, no colgar la invocación');
  assert(elapsed >= 250 && elapsed < 2500, `abortó en ${elapsed.toFixed(0)}ms, se esperaba ~300ms`);
});
