// Verificación de `src/utils/withRetry.js` (RES-1).
//
// El proyecto no tiene runner de tests unitarios para `src/` — solo Playwright
// para e2e, que necesita sesión. Este script corre con `node` a secas y ejercita
// la lógica pura: jitter, clasificación de errores y las tres transiciones del
// circuit breaker.
//
//   node scripts/verify-withretry.mjs

import {
    withRetry, backoffFor, isTransient,
    getBreakerState, resetBreaker, CircuitOpenError,
} from '../src/utils/withRetry.js';

let fallos = 0;
const ok = (cond, msg) => {
    console.log(`${cond ? '  OK  ' : ' FALLA'}  ${msg}`);
    if (!cond) fallos++;
};

const transitorio = () => Object.assign(new Error('Failed to fetch'), { name: 'TypeError' });
const negocio = () => Object.assign(new Error('row-level security'), { code: 'PGRST301' });

// ── 1. Clasificación de errores ─────────────────────────────────────────────
console.log('\n1. Clasificación de errores');
ok(isTransient(transitorio()), 'fetch caído es transitorio');
ok(isTransient({ status: 503 }), '5xx es transitorio');
ok(isTransient({ code: 'TIMEOUT' }), 'timeout es transitorio');
ok(!isTransient(negocio()), 'error de RLS NO es transitorio');
ok(!isTransient({ status: 404 }), '4xx NO es transitorio');
ok(!isTransient({ code: 'CIRCUIT_OPEN' }), 'circuito abierto NO cuenta como transitorio');

// ── 2. Full jitter ──────────────────────────────────────────────────────────
console.log('\n2. Full jitter — el reparto es lo que evita la avalancha');
const cfg = { baseDelayMs: 400, backoffCapMs: 8000, random: Math.random };
const muestras = Array.from({ length: 2000 }, () => backoffFor(2, cfg));
const techo = 800; // 400 * 2^1
ok(muestras.every(v => v >= 0 && v < techo), `las 2000 muestras caen en [0, ${techo})`);
const distintos = new Set(muestras.map(v => Math.round(v))).size;
ok(distintos > 500, `se reparten de verdad (${distintos} valores distintos, la v1 daba 1)`);
ok(backoffFor(10, cfg) < 8000 + 1, 'el techo corta el crecimiento exponencial');
// Determinismo con random inyectado
ok(backoffFor(1, { ...cfg, random: () => 0.5 }) === 200, 'con random=0.5 e intento 1 → 200ms exactos');

// ── 3. Reintentos ───────────────────────────────────────────────────────────
console.log('\n3. Reintentos');
resetBreaker();
let intentos = 0;
const r1 = await withRetry(async () => {
    intentos++;
    if (intentos < 3) throw transitorio();
    return 'listo';
}, { baseDelayMs: 1, random: () => 0 });
ok(r1 === 'listo' && intentos === 3, `reintenta transitorios y devuelve el valor (${intentos} intentos)`);

resetBreaker();
intentos = 0;
try {
    await withRetry(async () => { intentos++; throw negocio(); }, { baseDelayMs: 1, random: () => 0 });
} catch (e) {
    ok(intentos === 1 && e.code === 'PGRST301', 'un error de negocio NO se reintenta (1 intento)');
}

// ── 4. Circuit breaker ──────────────────────────────────────────────────────
console.log('\n4. Circuit breaker');
resetBreaker();
const opts = { tries: 1, baseDelayMs: 1, random: () => 0 };

for (let i = 0; i < 5; i++) {
    try { await withRetry(async () => { throw transitorio(); }, opts); } catch { /* esperado */ }
}
ok(getBreakerState().state === 'open', 'tras 5 fallos transitorios seguidos el circuito ABRE');

let sinRed = true;
try {
    await withRetry(async () => { sinRed = false; return 'no debería'; }, opts);
} catch (e) {
    ok(e instanceof CircuitOpenError, 'con el circuito abierto falla rápido con CircuitOpenError');
}
ok(sinRed, 'y NO llega a tocar la red — que es el punto de todo esto');

// Ventana vencida → semiabierto, deja pasar UNA sonda
resetBreaker();
for (let i = 0; i < 5; i++) {
    try { await withRetry(async () => { throw transitorio(); }, opts); } catch { /* esperado */ }
}
// Simula que ya pasaron los 10s de la ventana adelantando el reloj inyectado
const futuro = () => Date.now() + 11_000;
let sondas = 0;
const r2 = await withRetry(async () => { sondas++; return 'recuperado'; }, { ...opts, now: futuro });
ok(r2 === 'recuperado' && sondas === 1, 'vencida la ventana, la sonda pasa');
ok(getBreakerState().state === 'closed', 'y si funciona, el circuito CIERRA');

// Un error de negocio no debe abrir el circuito
resetBreaker();
for (let i = 0; i < 10; i++) {
    try { await withRetry(async () => { throw negocio(); }, opts); } catch { /* esperado */ }
}
ok(getBreakerState().state === 'closed', '10 errores de negocio NO abren el circuito');

console.log(`\n${fallos === 0 ? '✅ Todo en verde' : `❌ ${fallos} comprobaciones fallaron`}\n`);
process.exit(fallos === 0 ? 0 : 1);
