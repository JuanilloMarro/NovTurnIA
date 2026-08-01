/**
 * Reintenta una operación de LECTURA ante fallos transitorios de red.
 *
 * Motivación (Auditoría Frontend F-4 / Auditoría Técnica §2.5): sin retry, un
 * parpadeo de red o un 503 de Supabase se convierte en error visible para el
 * usuario. Este wrapper reintenta SOLO errores transitorios (fetch caído,
 * timeouts, 5xx); los errores de negocio (RLS, 4xx, PGRST*, PLAN_LIMIT,
 * validaciones) se propagan al primer intento.
 *
 * ⚠️ Usar únicamente en lecturas idempotentes — jamás en INSERT/UPDATE/DELETE
 * (un retry de escritura puede duplicar datos).
 *
 * ── RES-1 · Qué cambió respecto de la v1 ──────────────────────────────────
 *
 * 1. FULL JITTER en vez de backoff determinista.
 *    La v1 esperaba exactamente 400ms y 800ms. Con varias pestañas abiertas —y
 *    varios tenants— eso significa que tras una caída de Supabase **todos**
 *    reintentan en el mismo milisegundo, y el primer reintento vuelve a tumbar
 *    al servidor que se estaba recuperando (thundering herd). Full jitter
 *    reparte cada reintento en [0, techo), así que las mismas N pestañas se
 *    distribuyen en la ventana en vez de apilarse.
 *
 * 2. CIRCUIT BREAKER compartido por todo el módulo.
 *    Reintentar es útil cuando el fallo es un parpadeo. Cuando el backend está
 *    caído de verdad, cada lectura de cada pantalla gasta sus 3 intentos y el
 *    usuario espera varios segundos para ver el mismo error — mientras le sigue
 *    pegando al servidor. Tras `FAILURE_THRESHOLD` fallos transitorios seguidos
 *    el circuito se ABRE: las llamadas fallan de inmediato, sin tocar la red,
 *    durante `OPEN_MS`. Después pasa a SEMIABIERTO y deja pasar UNA sonda: si
 *    funciona, cierra y todo vuelve a la normalidad; si falla, vuelve a abrir.
 *
 *    El estado es del módulo entero a propósito: el objetivo es proteger al
 *    backend, y todas las lecturas van al mismo backend. Un breaker por
 *    etiqueta no evitaría la avalancha.
 *
 * La lógica es la misma que ya corre y está probada del lado del servidor en
 * `supabase/functions/_shared/fetchUpstream.ts` (EDGE-2). Acá se porta al
 * cliente; no se inventa nada nuevo.
 */

const DEFAULTS = {
    tries: 3,
    baseDelayMs: 400,
    /** Techo del backoff: sin esto, 6 intentos pedirían esperas absurdas. */
    backoffCapMs: 8_000,
};

// ── Circuit breaker ──────────────────────────────────────────────────────────
const FAILURE_THRESHOLD = 5;   // fallos transitorios seguidos antes de abrir
const OPEN_MS = 10_000;        // cuánto queda abierto antes de dejar pasar una sonda

const breaker = {
    state: 'closed',   // 'closed' | 'open' | 'half-open'
    failures: 0,
    openedAt: 0,
    probeInFlight: false,
};

/** Error que se lanza cuando el circuito está abierto. */
export class CircuitOpenError extends Error {
    constructor(label) {
        super('El servicio no está respondiendo. Reintentá en unos segundos.');
        this.name = 'CircuitOpenError';
        this.code = 'CIRCUIT_OPEN';
        this.label = label;
    }
}

/** Estado actual — para tests y para que la UI pueda mostrarlo si quiere. */
export function getBreakerState() {
    return { ...breaker };
}

/** Vuelve a cero. Necesario en tests y al cambiar de sesión. */
export function resetBreaker() {
    breaker.state = 'closed';
    breaker.failures = 0;
    breaker.openedAt = 0;
    breaker.probeInFlight = false;
}

function onSuccess() {
    // Cualquier éxito cierra el circuito: si la sonda pasó, el backend volvió.
    breaker.state = 'closed';
    breaker.failures = 0;
    breaker.probeInFlight = false;
}

function onTransientFailure() {
    breaker.probeInFlight = false;
    breaker.failures += 1;
    if (breaker.failures >= FAILURE_THRESHOLD) {
        breaker.state = 'open';
        breaker.openedAt = Date.now();
    }
}

/**
 * ¿Se puede intentar? Además de responder, hace la transición
 * open → half-open cuando venció la ventana.
 */
function canAttempt(now) {
    if (breaker.state === 'closed') return true;

    if (breaker.state === 'open') {
        if (now - breaker.openedAt < OPEN_MS) return false;
        breaker.state = 'half-open';
        breaker.probeInFlight = false;
    }

    // Semiabierto: pasa UNA sola sonda. El resto falla rápido para no mandar
    // una avalancha contra un backend que todavía no sabemos si se recuperó.
    if (breaker.probeInFlight) return false;
    breaker.probeInFlight = true;
    return true;
}

/**
 * @template T
 * @param {() => Promise<T>} fn - Función que ejecuta la lectura (se re-invoca por intento)
 * @param {{ tries?: number, baseDelayMs?: number, backoffCapMs?: number, label?: string,
 *           random?: () => number, now?: () => number }} opts
 *        `random` y `now` son inyectables para poder testear el jitter y las
 *        ventanas de tiempo de forma determinista.
 * @returns {Promise<T>}
 */
export async function withRetry(fn, opts = {}) {
    const {
        tries = DEFAULTS.tries,
        baseDelayMs = DEFAULTS.baseDelayMs,
        backoffCapMs = DEFAULTS.backoffCapMs,
        label = 'read',
        random = Math.random,
        now = Date.now,
    } = opts;

    if (!canAttempt(now())) throw new CircuitOpenError(label);

    let lastErr;
    for (let attempt = 1; attempt <= tries; attempt++) {
        try {
            const result = await fn();
            onSuccess();
            return result;
        } catch (err) {
            lastErr = err;

            if (!isTransient(err)) {
                // Un error de negocio no dice nada del estado del backend: no
                // debe contar para abrir el circuito ni gatillar reintentos.
                breaker.probeInFlight = false;
                throw err;
            }

            if (attempt === tries) {
                onTransientFailure();
                throw err;
            }

            const wait = backoffFor(attempt, { baseDelayMs, backoffCapMs, random });
            // `?.` para que el módulo se pueda cargar también fuera de Vite
            // (el script de verificación lo importa desde Node a pelo).
            if (import.meta.env?.DEV) {
                console.warn(`[withRetry:${label}] intento ${attempt} falló (${err?.message}); reintentando en ${Math.round(wait)}ms`);
            }
            await sleep(wait);
        }
    }

    onTransientFailure();
    throw lastErr;
}

/** Full jitter: espera aleatoria en [0, min(cap, base * 2^(intento-1))). */
export function backoffFor(attempt, { baseDelayMs, backoffCapMs, random }) {
    const ceiling = Math.min(backoffCapMs, baseDelayMs * 2 ** (attempt - 1));
    return random() * ceiling;
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// Transitorio = problema de transporte o servidor, no de negocio.
export function isTransient(err) {
    if (!err) return false;
    if (err.code === 'CIRCUIT_OPEN') return false;                    // ya es nuestro
    if (err.code === 'TIMEOUT') return true;                          // withTimeout
    if (err.name === 'TypeError' || /failed to fetch|networkerror|load failed/i.test(err.message || '')) return true; // fetch caído
    const status = err.status ?? err.statusCode;
    if (typeof status === 'number' && status >= 500) return true;     // 5xx
    if (typeof err.code === 'string' && /^5\d\d$/.test(err.code)) return true;
    return false;
}
