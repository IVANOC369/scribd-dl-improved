import path from 'path'
import sanitize from 'sanitize-filename'

/**
 * Validador y sanitizador de rutas de archivos
 */
export class PathValidator {
    /**
     * Sanitizar y validar un nombre de archivo
     * @param {string} filename - nombre de archivo a sanitizar
     * @returns {string} nombre de archivo sanitizado
     */
    static sanitizeFilename(filename) {
        if (!filename || typeof filename !== 'string') {
            throw new Error('Nombre de archivo inválido')
        }

        return sanitize(filename, { replacement: '_' })
    }

    /**
     * Construir ruta segura
     * @param {...string} parts - partes de la ruta
     * @returns {string} ruta sanitizada
     */
    static buildPath(...parts) {
        return path.join(...parts.map(p => this.sanitizeFilename(String(p))))
    }

    /**
     * Validar que una ruta no escape del directorio base
     * @param {string} basePath - directorio base
     * @param {string} targetPath - ruta objetivo
     * @returns {boolean} true si la ruta es segura
     */
    static isPathSafe(basePath, targetPath) {
        const resolvedBase = path.resolve(basePath)
        const resolvedTarget = path.resolve(targetPath)
        return resolvedTarget.startsWith(resolvedBase)
    }
}
