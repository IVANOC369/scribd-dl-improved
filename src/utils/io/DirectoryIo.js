import { promises as fs } from 'fs'

class DirectoryIo {
    constructor() {
        if (!DirectoryIo.instance) {
            DirectoryIo.instance = this
        }
        return DirectoryIo.instance
    }

    /**
     * Crear directorios (recursivo)
     * @param {string} dest - ruta del directorio
     */
    async create(dest) {
        try {
            await fs.mkdir(dest, { recursive: true })
        } catch (err) {
            if (err.code !== 'EEXIST') {
                throw err
            }
            // Si el directorio ya existe, no es un error
        }
    }

    /**
     * Eliminar directorios (recursivo)
     * @param {string} dest - ruta a eliminar
     */
    async remove(dest) {
        try {
            await fs.rm(dest, { recursive: true, force: true })
        } catch (err) {
            console.error(`⚠️  Advertencia: No se pudo eliminar ${dest}:`, err.message)
        }
    }
}

export const directoryIo = new DirectoryIo()
