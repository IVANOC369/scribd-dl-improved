import { puppeteerSg } from "../utils/request/PuppeteerSg.js"
import { directoryIo } from "../utils/io/DirectoryIo.js"
import { configLoader } from "../utils/io/ConfigLoader.js"
import { PathValidator } from "../utils/validation/PathValidator.js"
import { Logger } from "../utils/logging/Logger.js"

/**
 * Clase base para downloaders con funcionalidad compartida
 */
export class BaseDownloader {
    constructor(serviceName = 'BaseDownloader') {
        this.output = configLoader.load("DIRECTORY", "output")
        this.logger = new Logger(serviceName)
    }

    /**
     * Obtener nombre de archivo sanitizado
     * @param {string} title - Título del documento
     * @param {string} id - ID del documento
     * @returns {string} Nombre de archivo sanitizado
     */
    getFilename(title, id) {
        const filenameMode = configLoader.load("DIRECTORY", "filename")
        const rawFilename = filenameMode === "title" ? title : id
        return PathValidator.sanitizeFilename(rawFilename)
    }

    /**
     * Navegar a página con espera
     * @param {string} url - URL a navegar
     * @param {number} waitTime - Tiempo de espera en ms
     * @returns {Promise<Page>} Página de Puppeteer
     */
    async navigateToPage(url, waitTime = 1000) {
        const page = await puppeteerSg.getPage(url)
        await new Promise(resolve => setTimeout(resolve, waitTime))
        return page
    }

    /**
     * Esperar que un selector exista en la página
     * @param {Page} page - Página de Puppeteer
     * @param {string|string[]} selectors - Selector o array de selectores
     * @param {number} timeout - Timeout en ms
     * @returns {Promise<ElementHandle|null>}
     */
    async waitForSelector(page, selectors, timeout = 5000) {
        const selectorArray = Array.isArray(selectors) ? selectors : [selectors]

        for (const selector of selectorArray) {
            try {
                const element = await page.waitForSelector(selector, { timeout })
                if (element) {
                    this.logger.debug(`Selector encontrado: ${selector}`)
                    return element
                }
            } catch (error) {  // eslint-disable-line
                this.logger.debug(`Selector no encontrado: ${selector}`)
                continue
            }
        }

        return null
    }

    /**
     * Limpiar recursos
     * @param {Page} page - Página a cerrar
     * @param {string} tempDir - Directorio temporal a eliminar
     */
    async cleanup(page, tempDir = null) {
        try {
            if (page) {
                await page.close()
                this.logger.debug('Página cerrada')
            }

            if (tempDir) {
                await directoryIo.remove(tempDir)
                this.logger.debug(`Directorio temporal eliminado: ${tempDir}`)
            }

            await puppeteerSg.close()
        } catch (error) {
            this.logger.error('Error en cleanup', error)
        }
    }

    /**
     * Crear directorio de salida de manera segura
     * @param {string} dirPath - Ruta del directorio
     */
    async createOutputDirectory(dirPath) {
        await directoryIo.create(dirPath)
        this.logger.debug(`Directorio creado: ${dirPath}`)
    }
}
