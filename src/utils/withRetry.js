/**
 * Reintenta una operación de LECTURA ante fallos transitorios de red.
 *
 * Motivación (Auditoría Frontend F-4 / Auditoría Técnica §9): sin retry, un
 * parpadeo de red o un 503 de Supabase se convierte en error visible para el
 * usuario. Este wrapper reintenta SOLO errores transitorios (fetch caído,
 * timeouts, 5xx) con backoff exponencial. Los errores de negocio (RLS, 4xx,
 * PGRST*, PLAN_LIMIT, validaciones) NO se reintentan: se propagan al primer
 * intento.
 *
 * ⚠️ Usar únicamente en lecturas idempotentes — jamás en INSERT/UPDATE/DELETE
 * (un retry de escritura puede duplicar datos).
 *
 * @template T
 * @param {() => Promise<T>} fn - Función que ejecuta la lectura (se re-invoca por intento)
 * @param {{ tries?: number, baseDelayMs?: number, label?: string }} opts
 * @returns {Promise<T>}
 */
export async function withRetry(fn, { tries = 3, baseDelayMs = 400, label = 'read' } = {}) {
    let lastErr;
    for (let attempt = 1; attempt <= tries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            if (!isTransient(err) || attempt === tries) throw err;
            const delay = baseDelayMs * 2 ** (attempt - 1); // 400ms, 800ms
            if (import.meta.env.DEV) console.warn(`[withRetry:${label}] intento ${attempt} falló (${err?.message}); reintentando en ${delay}ms`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
    throw lastErr;
}

// Transitorio = problema de transporte o servidor, no de negocio.
function isTransient(err) {
    if (!err) return false;
    if (err.code === 'TIMEOUT') return true;                          // withTimeout
    if (err.name === 'TypeError' || /failed to fetch|networkerror|load failed/i.test(err.message || '')) return true; // fetch caído
    const status = err.status ?? err.statusCode;
    if (typeof status === 'number' && status >= 500) return true;     // 5xx
    if (typeof err.code === 'string' && /^5\d\d$/.test(err.code)) return true;
    return false;
}
