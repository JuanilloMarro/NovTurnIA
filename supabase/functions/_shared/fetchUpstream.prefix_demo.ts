// supabase/functions/_shared/fetchUpstream.prefix_demo.ts
//
// Demostración de que la verificación FALLA contra el código pre-fix.
// Correr:  deno run --allow-net supabase/functions/_shared/fetchUpstream.prefix_demo.ts
//
// El "código pre-fix" era el patrón exacto de los dos call sites antes de este
// cambio: un único `fetch(url, init)` sin AbortSignal y sin reintento. Este
// script aplica los MISMOS escenarios de fetchUpstream.test.ts a ese patrón y
// reporta que las propiedades de EDGE-1 (timeout) y EDGE-2 (reintento) NO se
// cumplen. Es la contraprueba: la misma aserción que pasa con el fix, falla sin él.

/** El call site pre-fix: sin timeout, sin reintento. */
async function naiveFetch(url: string, init: RequestInit): Promise<Response> {
  return await fetch(url, init);
}

function line(label: string, ok: boolean, detail: string) {
  const tag = ok ? 'PASA' : 'FALLA';
  console.log(`  [${tag}] ${label} — ${detail}`);
  return ok;
}

console.log('=== Contraprueba pre-fix (patrón: fetch único, sin timeout, sin reintento) ===\n');

// ── EDGE-2: reintento ante 503 transitorio ──────────────────────────────────
console.log('EDGE-2 · escenario 503→503→200 (la aserción del test exige status=200, 3 intentos):');
{
  let hits = 0;
  const ac = new AbortController();
  const server = Deno.serve({ port: 0, signal: ac.signal, onListen: () => {} }, () => {
    hits++;
    return new Response(JSON.stringify({ hits }), { status: hits < 3 ? 503 : 200 });
  });
  const { port } = server.addr as Deno.NetAddr;

  const res = await naiveFetch(`http://127.0.0.1:${port}/`, {});
  await res.body?.cancel();

  line('status === 200', res.status === 200, `status real = ${res.status}`);
  line('intentos === 3', hits === 3, `intentos reales = ${hits}`);
  console.log('  → sin reintento, un 503 transitorio se propaga como fallo definitivo.\n');

  ac.abort();
  await server.finished;
}

// ── EDGE-1: timeout ante upstream colgado ────────────────────────────────────
console.log('EDGE-1 · escenario upstream colgado (la aserción del test exige abortar en ~300ms):');
{
  const ac = new AbortController();
  const server = Deno.serve({ port: 0, signal: ac.signal, onListen: () => {} }, (req) =>
    new Promise<Response>((resolve) => {
      req.signal.addEventListener('abort', () => resolve(new Response(null, { status: 499 })), { once: true });
    })
  );
  const { port } = server.addr as Deno.NetAddr;

  const start = performance.now();
  // El pre-fix no aborta solo; lo corremos contra un watchdog de 900ms para no
  // colgar el script. Si gana el watchdog, es porque naiveFetch NO tenía timeout.
  const outcome = await Promise.race([
    naiveFetch(`http://127.0.0.1:${port}/`, {}).then(() => 'RESPONDIÓ').catch(() => 'ABORTÓ'),
    new Promise<string>((r) => setTimeout(() => r('SIGUE_COLGADO'), 900)),
  ]);
  const elapsed = performance.now() - start;

  const abortedNearTimeout = outcome === 'ABORTÓ' && elapsed < 500;
  line('abortó cerca de 300ms', abortedNearTimeout, `resultado = ${outcome} a los ${elapsed.toFixed(0)}ms`);
  console.log('  → sin AbortSignal, la invocación queda colgada hasta el límite de pared de la plataforma.\n');

  // Cerrar: abortar el cliente colgado y el servidor.
  ac.abort();
  await server.finished;
}

console.log('=== Conclusión: contra el pre-fix, ambas aserciones FALLAN. El fix las hace pasar. ===');
