/**
 * Helper para reintentar operaciones con backoff exponencial
 */

/**
 * Reintentar una función con backoff exponencial
 * @param {Function} fn - Función async a reintentar
 * @param {number} maxRetries - Número máximo de reintentos
 * @param {number} initialDelay - Delay inicial en ms
 * @returns {Promise<any>}
 */
export async function retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
    let lastError;

    for (let i = 0; i <= maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (i < maxRetries) {
                const delay = initialDelay * Math.pow(2, i);
                console.log(`🔄 Reintento ${i + 1}/${maxRetries} en ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
}

/**
 * Ejecutar función con timeout
 * @param {Function} fn - Función a ejecutar
 * @param {number} timeoutMs - Timeout en milisegundos
 * @returns {Promise<any>}
 */
export async function withTimeout(fn, timeoutMs) {
    return Promise.race([
        fn(),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout después de ${timeoutMs}ms`)), timeoutMs)
        )
    ]);
}
