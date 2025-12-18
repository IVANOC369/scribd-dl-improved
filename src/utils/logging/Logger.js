/**
 * Sistema de logging estructurado
 */
export class Logger {
    static levels = {
        ERROR: 'error',
        WARN: 'warn',
        INFO: 'info',
        DEBUG: 'debug'
    }

    /**
     * @param {string} context - Contexto del logger (nombre del módulo)
     */
    constructor(context = 'App') {
        this.context = context
    }

    /**
     * Log genérico
     * @param {string} level - Nivel de log
     * @param {string} message - Mensaje
     * @param {Object} data - Datos adicionales
     */
    log(level, message, data = {}) {
        const timestamp = new Date().toISOString()

        // En modo DEBUG, usar JSON estructurado
        if (process.env.DEBUG) {
            const logEntry = {
                timestamp,
                level,
                context: this.context,
                message,
                ...data
            }
            console.log(JSON.stringify(logEntry))
        } else {
            // En modo normal, usar formato legible
            const emoji = {
                error: '❌',
                warn: '⚠️ ',
                info: 'ℹ️ ',
                debug: '🔍'
            }[level] || ''

            console.log(`${emoji} [${this.context}] ${message}`)

            if (Object.keys(data).length > 0) {
                console.log('  ', data)
            }
        }
    }

    /**
     * Log de error
     * @param {string} message - Mensaje
     * @param {Error} error - Objeto de error
     */
    error(message, error) {
        this.log(Logger.levels.ERROR, message, {
            error: error?.message,
            stack: error?.stack
        })
    }

    /**
     * Log de advertencia
     * @param {string} message - Mensaje
     * @param {Object} data - Datos adicionales
     */
    warn(message, data) {
        this.log(Logger.levels.WARN, message, data)
    }

    /**
     * Log informativo
     * @param {string} message - Mensaje
     * @param {Object} data - Datos adicionales
     */
    info(message, data) {
        this.log(Logger.levels.INFO, message, data)
    }

    /**
     * Log de debug (solo si DEBUG=true)
     * @param {string} message - Mensaje
     * @param {Object} data - Datos adicionales
     */
    debug(message, data) {
        if (process.env.DEBUG) {
            this.log(Logger.levels.DEBUG, message, data)
        }
    }
}
