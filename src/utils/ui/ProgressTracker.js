import cliProgress from 'cli-progress'

/**
 * Rastreador de progreso con barra CLI
 */
export class ProgressTracker {
    /**
     * @param {number} total - Total de items
     * @param {string} message - Mensaje a mostrar
     */
    constructor(total, message = 'Progreso') {
        this.bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)
        this.total = total
        this.message = message
    }

    /**
     * Iniciar barra de progreso
     */
    start() {
        console.log(`${this.message}...`)
        this.bar.start(this.total, 0)
    }

    /**
     * Actualizar progreso a valor específico
     * @param {number} current - Valor actual
     */
    update(current) {
        this.bar.update(current)
    }

    /**
     * Incrementar progreso en 1
     */
    increment() {
        this.bar.increment()
    }

    /**
     * Completar progreso
     */
    complete() {
        this.bar.update(this.total)
        this.bar.stop()
    }

    /**
     * Detener barra de progreso
     */
    stop() {
        this.bar.stop()
    }
}
