/**
 * Envuelve una promesa con un timeout. Si no resuelve antes del límite,
 * la promesa se rechaza con un error 'timeout'.
 *
 * Motivación: las llamadas a Supabase a través de fetch() pueden quedar
 * colgadas indefinidamente si la red se cae, el navegador suspende la
 * pestaña, o el WebSocket de realtime queda en un estado inconsistente.
 * Sin un timeout, el `setLoading(true)` nunca llega al `finally` y el
 * botón "Actualizar" se queda con el spinner girando hasta un F5.
 *
 * @template T
 * @param {Promise<T>} promise - La promesa a envolver
 * @param {number} ms - Timeout en milisegundos (por defecto 12s)
 * @param {string} label - Etiqueta para identificar el origen en el error
 * @returns {Promise<T>}
 */
export function withTimeout(promise, ms = 12_000, label = 'request') {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            const err = new Error(`Tiempo de espera agotado (${label})`);
            err.code = 'TIMEOUT';
            reject(err);
        }, ms);
    });

    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
