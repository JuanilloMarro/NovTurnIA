// supabase/functions/_shared/fetchUpstream.ts
//
// EDGE-1 (cero timeouts) + EDGE-2 (cero reintentos a terceros).
//
// Fuente única de resiliencia para TODO `fetch` a un tercero desde las Edge
// Functions (Meta Graph, Gemini, ...). En vez de parchear cada call site, las 8
// funciones comparten este envoltorio. Blueprint: Auditoria Tecnica Multi-Tenant §5.3.
//
// Qué garantiza:
//   1. Timeout duro POR INTENTO con `AbortSignal.timeout`. Un upstream colgado
//      ya no retiene la invocación hasta el límite de pared de la plataforma
//      (que bajo carga agota la concurrencia y tira el handoff humano para
//      TODOS los tenants a la vez).
//   2. Reintento SOLO ante fallo transitorio: 429, 5xx, o error de red/timeout.
//      Un 503 pasajero de Meta ya no pierde el mensaje del staff definitivamente.
//   3. Backoff con FULL JITTER (AWS), no determinista: sin jitter, todas las
//      invocaciones que fallan al mismo tiempo reintentan en el mismo instante
//      (thundering herd). Con full jitter se reparten en [0, cap].
//   4. Presupuesto TOTAL de tiempo (budgetMs): techo de pared para toda la
//      operación —intentos + esperas—, no solo por intento. Ningún caller puede
//      quedar colgado más que budgetMs aunque cada intento agote su timeout.
//
// Lo que NO reintenta (a propósito): 4xx que no sea 429. Un 400/401/403/404 es
// error de negocio (input inválido, ventana de 24h cerrada, credencial mala):
// reintentar solo repite el mismo rechazo y gasta presupuesto. Se devuelve la
// Response tal cual para que el caller la clasifique (p. ej. wa-human-reply
// discrimina el code 131047/131051 de Meta).
//
// Nota fuente única: `src/utils/withRetry.js` y `withTimeout.js` son del cliente
// (navegador/React) y NO se importan acá. Este módulo es el equivalente del lado
// Edge (runtime Deno, sin DOM). No se duplican: cubren capas distintas.

export type FetchUpstreamOpts = RequestInit & {
  /** Timeout duro por intento, en ms. Default 10_000. */
  timeoutMs?: number;
  /** Número máximo de intentos (no de reintentos). Default 3. */
  tries?: number;
  /**
   * Presupuesto total de pared en ms para toda la operación (intentos + esperas).
   * Si se agota, se corta y se devuelve/lanza el último resultado. Default:
   * timeoutMs * tries + margen para los backoffs.
   */
  budgetMs?: number;
  /** Base del backoff exponencial en ms. Default 500. */
  baseDelayMs?: number;
  /** Techo del backoff por intento en ms. Default 8_000. */
  backoffCapMs?: number;
  /** Techo para respetar `Retry-After` del upstream en ms. Default 20_000. */
  maxRetryAfterMs?: number;
  /** Etiqueta para logs/telemetría. Default 'upstream'. */
  label?: string;
  /** Inyectable para tests. Default: `fetch` global. */
  fetchImpl?: typeof fetch;
  /** Inyectable para tests (saltar esperas reales). Default: setTimeout. */
  sleepImpl?: (ms: number) => Promise<void>;
  /** Inyectable para tests deterministas del jitter. Default: Math.random. */
  random?: () => number;
};

const DEFAULT_SLEEP = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

/** ¿El status amerita reintento? 429 (rate limit) y 5xx (fallo de servidor). */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * `fetch` a terceros con timeout duro por intento, reintento con full jitter
 * SOLO en fallo transitorio, y presupuesto total de tiempo.
 *
 * Devuelve la última `Response` obtenida (incluida una 5xx final tras agotar
 * intentos, para que el caller la clasifique). Lanza SOLO si nunca hubo una
 * respuesta HTTP: timeout duro o error de red en todos los intentos. En ese
 * caso el error lleva `.name === 'UpstreamError'` y `.cause` con el original.
 */
export async function fetchUpstream(url: string | URL, opts: FetchUpstreamOpts = {}): Promise<Response> {
  const {
    timeoutMs = 10_000,
    tries = 3,
    baseDelayMs = 500,
    backoffCapMs = 8_000,
    maxRetryAfterMs = 20_000,
    label = 'upstream',
    fetchImpl = fetch,
    sleepImpl = DEFAULT_SLEEP,
    random = Math.random,
    // El signal del caller no se combina: este módulo es el dueño del ciclo de
    // vida del abort (timeout por intento). Los call sites no pasan signal.
    signal: _callerSignal,
    ...init
  } = opts;

  const budgetMs = opts.budgetMs ?? timeoutMs * tries + backoffCapMs * (tries - 1);
  const start = Date.now();
  const deadline = start + budgetMs;
  const remaining = () => deadline - Date.now();

  let lastError: unknown;
  let lastResponse: Response | undefined;

  for (let attempt = 1; attempt <= tries; attempt++) {
    // Presupuesto agotado antes de arrancar el intento: no queda tiempo útil.
    const timeLeft = remaining();
    if (timeLeft <= 0) break;

    // El timeout efectivo nunca excede lo que queda del presupuesto total.
    const attemptTimeout = Math.min(timeoutMs, timeLeft);

    try {
      const res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(attemptTimeout) });
      lastResponse = res;

      // Éxito o error de negocio (4xx != 429): no reintentar, devolver tal cual.
      if (!isRetryableStatus(res.status)) return res;

      // Transitorio (429/5xx) en el último intento: devolver la respuesta para
      // que el caller la clasifique (no lanzar: hubo respuesta HTTP real).
      if (attempt === tries) return res;

      // Consumir el cuerpo para no filtrar la conexión antes de reintentar.
      await res.body?.cancel().catch(() => {});

      const wait = backoffFor(attempt, res, { baseDelayMs, backoffCapMs, maxRetryAfterMs, random });
      if (!(await waitWithinBudget(wait, remaining, sleepImpl))) return res;
    } catch (err) {
      // Timeout duro (AbortSignal.timeout → TimeoutError) o error de red.
      lastError = err;
      if (attempt === tries) break;

      const wait = backoffFor(attempt, null, { baseDelayMs, backoffCapMs, maxRetryAfterMs, random });
      if (!(await waitWithinBudget(wait, remaining, sleepImpl))) break;
    }
  }

  // Se agotaron los intentos/presupuesto. Si en algún momento hubo respuesta
  // HTTP (aunque fuera 5xx), devolverla. Si nunca hubo (solo timeout/red), lanzar.
  if (lastResponse) return lastResponse;
  throw upstreamError(label, tries, budgetMs, Date.now() - start, lastError);
}

/** Backoff full-jitter para el intento dado, respetando Retry-After si viene. */
function backoffFor(
  attempt: number,
  res: Response | null,
  cfg: { baseDelayMs: number; backoffCapMs: number; maxRetryAfterMs: number; random: () => number },
): number {
  // Retry-After (segundos) del upstream tiene prioridad: respeta su cadencia.
  if (res) {
    const header = res.headers.get('retry-after');
    if (header) {
      const seconds = Number(header);
      if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.min(cfg.maxRetryAfterMs, seconds * 1000);
      }
    }
  }
  // Full jitter: sleep aleatorio en [0, min(cap, base * 2^(attempt-1))].
  const ceiling = Math.min(cfg.backoffCapMs, cfg.baseDelayMs * 2 ** (attempt - 1));
  return cfg.random() * ceiling;
}

/**
 * Duerme `wait` ms, pero nunca más allá del presupuesto. Devuelve false si no
 * queda tiempo para otro intento después de la espera (el caller corta).
 */
async function waitWithinBudget(
  wait: number,
  remaining: () => number,
  sleepImpl: (ms: number) => Promise<void>,
): Promise<boolean> {
  const timeLeft = remaining();
  if (timeLeft <= 0) return false;
  await sleepImpl(Math.min(wait, timeLeft));
  return remaining() > 0;
}

function upstreamError(
  label: string,
  tries: number,
  budgetMs: number,
  elapsedMs: number,
  cause: unknown,
): Error {
  const reason = cause instanceof Error ? cause.message : String(cause ?? 'sin respuesta');
  const err = new Error(`fetchUpstream(${label}) agotó ${tries} intento(s) en ${elapsedMs}ms (budget ${budgetMs}ms): ${reason}`);
  err.name = 'UpstreamError';
  (err as Error & { cause?: unknown }).cause = cause;
  return err;
}
