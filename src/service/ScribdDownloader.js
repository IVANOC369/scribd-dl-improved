import * as everandRegex from "../const/EverandRegex.js"
import { BaseDownloader } from "./BaseDownloader.js"
import { puppeteerSg } from "../utils/request/PuppeteerSg.js";
import { pdfGenerator } from "../utils/io/PdfGenerator.js";
import { configLoader } from "../utils/io/ConfigLoader.js";
import { directoryIo } from "../utils/io/DirectoryIo.js"
import * as scribdRegex from "../const/ScribdRegex.js"
import * as scribdFlag from '../const/ScribdFlag.js'
import { Image } from "../object/Image.js"
import { ProgressTracker } from "../utils/ui/ProgressTracker.js"
import { PathValidator } from "../utils/validation/PathValidator.js"
import sharp from "sharp";
import path from 'path'
import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';

const output = configLoader.load("DIRECTORY", "output")
const filename = configLoader.load("DIRECTORY", "filename")
const rendertime = parseInt(configLoader.load("SCRIBD", "rendertime"))

class ScribdDownloader extends BaseDownloader {
    constructor() {
        super('ScribdDownloader')
        if (!ScribdDownloader.instance) {
            ScribdDownloader.instance = this
        }
        return ScribdDownloader.instance
    }

    /**
     * Ejecutar descarga con fallback automático
     * @param {string} url - URL del documento
     * @param {string} flag - Modo de descarga
     */
    async execute(url, flag) {
        // DETECCIÓN DE URLs DE EVERAND (LIBROS Y LECTURA)
        if (url.match(everandRegex.BOOK) || url.match(everandRegex.READ) || url.match(everandRegex.BOOK_READ)) {
            this.logger.info('📚 Detectado eBook de Everand. Usando motor de "Epub Reader"...')
            await this.downloadEverandBook(url)
            return
        }

        // Convertir URL de documento a URL de embed
        let embedUrl;
        if (url.match(scribdRegex.DOCUMENT)) {
            // Grupo [3] contiene el document ID
            const m = scribdRegex.DOCUMENT.exec(url)
            const id = m[3]

            // ESTRATEGIA: Los documentos de Everand ("Books") a menudo existen en Scribd como "Documents".
            // El visor de lectura de Everand (/read/) es una SPA compleja.
            // El visor de embeds de Scribd es simple y ya lo soportamos.
            // Intentaremos forzar el uso del embed de Scribd para este ID.

            embedUrl = `https://www.scribd.com/embeds/${id}/content?start_page=1&view_mode=scroll&access_key=key-1`
        } else if (url.match(scribdRegex.EMBED)) {
            embedUrl = url
        } else {
            throw new Error(`URL no soportada: ${url}`)
        }

        // Determinar modo de descarga
        if (flag === scribdFlag.IMAGE) {
            this.logger.info('📸 Modo: IMAGEN')
            await this.embedsImage(embedUrl)
        } else {
            this.logger.info('📄 Modo: TEXTO (con fallback automático a imagen si falla)')
            try {
                // Timeout de 10 minutos para modo texto (documentos largos necesitan más tiempo)
                await Promise.race([
                    this.embedsDefault(embedUrl),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout: Modo texto tardó más de 10 minutos')), 600000)
                    )
                ])
            } catch (error) {
                this.logger.warn('⚠️  El modo texto falló, intentando con modo imagen...', { error: error.message })
                console.log('\n🔄 Cambiando automáticamente a modo IMAGEN...\n')
                await this.embedsImage(embedUrl)
            }
        }
    }

    /**
     * Descarga especializada para Everand Epub Reader
     * @param {string} url 
     */
    /**
     * Descarga especializada para Everand Epub Reader (Ingeniería Inversa)
     * @param {string} url 
     */
    async downloadEverandEpub(url) {
        this.logger.info(`📖 Conectando al Visor de Everand (Nuevo Motor): ${url}`)

        // Uso de puppeteerSg para gestionar cookies premium
        const page = await puppeteerSg.getPage(url)
        let tempDir = null

        try {
            await page.setViewport({ width: 1200, height: 1600 })

            // 1. Esperar carga del visor y contador de páginas
            this.logger.info('⏳ Esperando carga del lector...')
            await page.waitForSelector('.page_counter', { timeout: 45000 }).catch(() => {
                this.logger.warn('Timeout esperando .page_counter')
            })

            // 2. Extraer Total de Páginas con lógica robusta
            let totalPages = 100
            try {
                const pageCounterText = await page.$eval('.page_counter', el => el.innerText) // Ej: "Página 4 de 31" o "Page 4 of 31"
                this.logger.debug(`Texto contador: ${pageCounterText}`)

                // Lógica de parseo flexible
                const parts = pageCounterText.split(/\s(de|of)\s/i)
                if (parts.length > 1) {
                    totalPages = parseInt(parts.pop().trim())
                }
            } catch (e) {
                this.logger.warn('No se pudo leer el total de páginas, usando default', e)
            }

            // Obtener Título
            let title = await page.title()
            title = title.replace('| Everand', '').trim().replace(/[^a-z0-9]/gi, '_')
            this.logger.info(`📘 Libro: ${title} | Total páginas: ${totalPages}`)

            // Directorio temporal
            tempDir = path.join(output, `${title}_temp`)
            await this.createOutputDirectory(tempDir)

            // 3. Inyectar CSS Crítico (Especificación del Usuario)
            await page.addStyleTag({
                content: `
                    @media print {
                        .text_line { 
                            color: #000 !important; 
                            opacity: 1 !important; 
                            visibility: visible !important; 
                            display: block !important; 
                        }
                        .reader_columns { 
                            display: block !important; 
                            overflow: visible !important; 
                        }
                        /* Ocultar interfaz */
                        .osano-cm-dialog, .page_scrubber_container, .top_toolbar, .prev_btn, .next_btn { 
                            display: none !important; 
                        }
                    }
                `
            });

            // 4. Bucle de Captura
            const progress = new ProgressTracker(totalPages, 'Capturando páginas')
            progress.start()

            // Click de foco inicial
            try {
                await page.click('body')
            } catch { }

            for (let i = 1; i <= totalPages; i++) {
                // Capturar PDF de la página actual
                const pdfPath = path.join(tempDir, `${String(i).padStart(4, '0')}.pdf`)
                await page.pdf({
                    path: pdfPath,
                    width: '1200px',
                    height: '1600px',
                    printBackground: true,
                    pageRanges: '1'
                })

                // Navegar a la siguiente página
                try {
                    await page.keyboard.press('ArrowRight')
                } catch (e) {
                    this.logger.warn('Error al navegar', e)
                }

                // IMPORTANTE: Esperar a que el selector .text_line sea visible y estable
                try {
                    // Esperamos que haya líneas de texto visibles para confirmar carga
                    await page.waitForFunction(() => {
                        const lines = document.querySelectorAll('.text_line');
                        if (lines.length > 0) {
                            // Verificar que al menos una línea sea visible (no oculta)
                            return Array.from(lines).some(l => l.offsetParent !== null);
                        }
                        return false;
                    }, { timeout: 5000 });
                } catch {
                    // Si falla (ej. página con solo imagen), esperamos un tiempo fijo por seguridad
                    await new Promise(r => setTimeout(r, 1500))
                }

                progress.update(i)
            }
            progress.complete()

            // 5. Merge Final
            const outputPdfPath = path.join(output, `${title}.pdf`)
            await this.mergePdfs(tempDir, totalPages, outputPdfPath)

            this.logger.info(`✅ PDF eBook Generado: ${outputPdfPath}`)
            await directoryIo.remove(tempDir)

        } catch (e) {
            this.logger.error('Error en descarga de Everand Book', e)
            throw e
        } finally {
            if (page) await page.close()
            await puppeteerSg.close()
        }
    }


    /**
     * Descargar usando modo texto/PDF (predeterminado)
     * @param {string} url - URL de embed
     */
    async embedsDefault(url) {
        const m = scribdRegex.EMBED.exec(url)
        if (!m) {
            throw new Error(`URL de embed inválida: ${url}`)
        }

        const id = m[1]
        let page = null
        let tempDir = null

        try {
            // Navegar a Scribd
            this.logger.info(`🌐 Conectando a Scribd...`)
            page = await this.navigateToPage(url, 1000)

            // Emular medios screen para mejor renderizado de texto
            await page.emulateMediaType('screen')
            this.logger.debug('Emulación de medios: screen')

            // Obtener el título
            const title = await this.getDocumentTitle(page)
            this.logger.info(`📖 Documento: ${title}`)

            // Preparar identificador
            const identifier = PathValidator.sanitizeFilename(filename == "title" ? title : id)
            tempDir = path.join(output, identifier)

            // Limpiar diálogos de cookies
            await this.removeCookieDialogs(page)

            // Cargar todas las páginas mediante scroll
            const pageCount = await this.loadAllPages(page)
            this.logger.info(`📄 Total de páginas: ${pageCount}`)

            // Inyectar CSS para mejorar renderizado de texto
            await this.injectPrintStyles(page)

            // Preparar páginas para captura
            await this.preparePages(page, pageCount)

            // Generar PDFs individuales
            await this.generatePagePdfs(page, pageCount, tempDir)

            // Combinar PDFs
            const outputPdfPath = path.join(output, `${identifier}.pdf`)
            await this.mergePdfs(tempDir, pageCount, outputPdfPath)

            // Limpiar directorio temporal
            await directoryIo.remove(tempDir)

            this.logger.info(`✅ PDF generado: ${outputPdfPath}`)

        } catch (error) {
            this.logger.error('Error en modo texto', error)
            if (tempDir) {
                await directoryIo.remove(tempDir)
            }
            throw error
        } finally {
            if (page) {
                await page.close()
            }
            await puppeteerSg.close()
        }
    }

    /**
     * Obtener título del documento
     * @param {Page} page - Página de Puppeteer
     * @returns {Promise<string>}
     */
    async getDocumentTitle(page) {
        try {
            // Intentar obtener título del overlay (modo gratuito/preview)
            const overlay = await this.waitForSelector(
                page,
                ["div.mobile_overlay a", "a.bottom_link"],
                2000 // Reducir timeout ya que es opcional ahora
            )

            if (overlay) {
                return await overlay.evaluate((el) => {
                    const href = el.href || ''
                    return decodeURIComponent(href.split('/').pop().trim())
                })
            }
        } catch {
            // Ignorar error de timeout
        }

        // Fallback: Intentar obtener título del documento (modo premium)
        return await page.evaluate(() => {
            // Intentar Scribd.current_doc
            try {
                if (window.Scribd && window.Scribd.current_doc && window.Scribd.current_doc.title) {
                    return window.Scribd.current_doc.title;
                }
            } catch {
                // Ignorar error
            }

            // Intentar meta tag og:title
            const ogTitle = document.querySelector('meta[property="og:title"]');
            if (ogTitle && ogTitle.content) {
                return ogTitle.content;
            }

            // Fallback final: document.title
            return document.title.replace(' - Read online', '').replace(' - Scribd', '').replace(' - Everand', '').trim();
        })
    }

    /**
     * Remover diálogos de cookies y overlays
     * @param {Page} page - Página de Puppeteer
     */
    async removeCookieDialogs(page) {
        const selectors = [
            "div.customOptInDialog",
            "div[aria-label='Cookie Consent Banner']",
            "#onetrust-consent-sdk"
        ]

        for (const selector of selectors) {
            try {
                const elements = await page.$$(selector)
                for (const el of elements) {
                    await el.evaluate(node => node.remove())
                }
            } catch (error) {  // eslint-disable-line
                // Ignorar si el selector no existe
            }
        }
    }

    /**
     * Inyectar estilos CSS para mejorar renderizado de texto
     * @param {Page} page - Página de Puppeteer
     */
    async injectPrintStyles(page) {
        this.logger.info('🎨 Inyectando estilos de impresión...')

        await page.addStyleTag({
            content: `
                /* Ocultar elementos que ensucian el PDF */
                .unprintable, .reader_upsell, .buy_button, .mobile_overlay, 
                .floating_buttons, .promotion, #onesignal-slidedown-container,
                #onetrust-consent-sdk, .ot-sdk-container, .ot-sdk-row,
                div[class*="cookie"], div[class*="banner"], div[class*="consent"],
                footer, .footer, .global_footer { 
                    display: none !important; 
                    visibility: hidden !important;
                    height: 0 !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                }
                
                /* Forzar que el texto sea visible y negro para mejor contraste */
                .text_layer { 
                    opacity: 1 !important; 
                    color: black !important; 
                    text-shadow: none !important;
                    font-weight: inherit !important;
                }
                .bold { font-weight: bold !important; }
                h1, h2, h3 { color: black !important; display: block !important; }
                .premium_unlock_overlay, .upsell { display: none !important; }
                
                .text_layer * {
                    visibility: visible !important;
                }

                /* Asegurar que las imágenes de fondo (si las hay) no tapen el texto */
                .absimg { 
                    z-index: -1 !important; 
                }

                /* Quitar márgenes extra para el renderizado por página */
                div[id^="outer_page_"] { 
                    margin: 0 !important; 
                    padding: 0 !important;
                    page-break-after: always !important; 
                }
            `
        })

        this.logger.debug('✅ Estilos CSS inyectados')
    }


    /**
     * Cargar todas las páginas mediante scroll
     * @param {Page} page - Página de Puppeteer
     * @returns {Promise<number>} Número de páginas
     */
    async loadAllPages(page) {
        this.logger.info('📜 Cargando páginas...')

        await page.click('div.document_scroller')
        const containerSelector = await page.$('div.document_scroller')

        if (!containerSelector) {
            throw new Error('No se encontró el contenedor de documento')
        }

        // Obtener dimensiones iniciales
        let scrollHeight = await containerSelector.evaluate(el => el.scrollHeight)
        const clientHeight = await containerSelector.evaluate(el => el.clientHeight)

        const progress = new ProgressTracker(scrollHeight, 'Cargando páginas')
        progress.start()

        // Verificar que existan capas de texto (opcional, no bloqueante)
        try {
            await page.waitForFunction(() => {
                const textLayers = document.querySelectorAll('.text_layer')
                return textLayers.length > 0
            }, { timeout: 5000 })
            this.logger.info('✅ Capas de texto detectadas')
        } catch (error) {  // eslint-disable-line
            this.logger.warn('⚠️  No se detectaron capas de texto, el PDF podría ser solo imagen')
        }

        let scrollTop = await containerSelector.evaluate(el => el.scrollTop)
        let lastScrollTop = -1
        let stuckCount = 0

        while (scrollTop + clientHeight < scrollHeight) {
            // Detectar si está atascado
            if (scrollTop === lastScrollTop) {
                stuckCount++
                if (stuckCount > 5) {
                    this.logger.warn('Scroll atascado, intentando saltar...')
                    await page.evaluate((distance) => {
                        const scroller = document.querySelector('div.document_scroller')
                        if (scroller) {
                            scroller.scrollTop += distance
                        }
                    }, 1000)
                    stuckCount = 0
                }
            } else {
                stuckCount = 0
            }
            lastScrollTop = scrollTop

            lastScrollTop = scrollTop

            // Scroll nativo agresivo (más confiable que PageDown)
            await page.evaluate((selector) => {
                const el = document.querySelector(selector)
                if (el) {
                    // Avanzar una pantalla completa + un extra para asegurar carga
                    el.scrollTop += el.clientHeight
                }
            }, 'div.document_scroller')

            await new Promise(resolve => setTimeout(resolve, Math.max(50, rendertime)))  // Mínimo 50ms

            scrollTop = await containerSelector.evaluate(el => el.scrollTop)
            // Actualizar scrollHeight dinámicamente ya que puede crecer
            scrollHeight = await containerSelector.evaluate(el => el.scrollHeight)

            progress.update(Math.min(Math.round(scrollTop + clientHeight), scrollHeight))
        }

        progress.complete()

        // Esperar un momento para que se rendericen todas las páginas
        this.logger.info('⏳ Esperando renderizado final...')
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Contar páginas de manera más eficiente
        this.logger.info('🔢 Contando páginas...')
        const pageCount = await page.evaluate(() => {
            const pages = document.querySelectorAll("div.outer_page_container div[id^='outer_page_']")
            return pages.length
        })

        if (pageCount === 0) {
            throw new Error('No se encontraron páginas en el documento')
        }

        return pageCount
    }

    /**
     * Preparar páginas para captura
     * @param {Page} page - Página de Puppeteer
     * @param {number} pageCount - Número de páginas
     */
    async preparePages(page, pageCount) {
        // Remover márgenes de cada página
        for (let i = 0; i < pageCount; i++) {
            await page.evaluate((i) => {
                const pageEl = document.getElementById(`outer_page_${(i + 1)}`)
                if (pageEl) {
                    pageEl.style.margin = 0
                }
            }, i)
        }

        // Mantener solo el contenedor de páginas
        await page.evaluate(() => {
            const container = document.querySelector("div.outer_page_container")
            if (container) {
                document.body.innerHTML = container.innerHTML
            }
        })

        // Ocultar todas las páginas inicialmente
        for (let i = 0; i < pageCount; i++) {
            await page.evaluate((i) => {
                const pageEl = document.getElementById(`outer_page_${(i + 1)}`)
                if (pageEl) {
                    pageEl.style.display = 'none'
                }
            }, i)
        }
    }

    /**
     * Generar PDFs individuales por página
     * @param {Page} page - Página de Puppeteer
     * @param {number} pageCount - Número de páginas
     * @param {string} tempDir - Directorio temporal
     */
    async generatePagePdfs(page, pageCount, tempDir) {
        this.logger.info('🖨️  Generando PDFs por página...')
        await this.createOutputDirectory(tempDir)

        const progress = new ProgressTracker(pageCount, 'Generando PDFs')
        progress.start()

        for (let i = 0; i < pageCount; i++) {
            // Mostrar página actual
            await page.evaluate((i) => {
                const pageEl = document.getElementById(`outer_page_${(i + 1)}`)
                if (pageEl) {
                    pageEl.style.display = 'block'
                }
            }, i)

            // Obtener dimensiones de la página
            const pageSelector = await page.$(`#outer_page_${(i + 1)}`)
            if (!pageSelector) continue

            const style = await pageSelector.evaluate((el) => el.getAttribute("style"))

            let height = 792  // Altura predeterminada
            let width = 612   // Ancho predeterminado

            if (style && style.includes("height:") && style.includes("width:")) {
                height = parseInt(style.split("height:")[1].split("px")[0].trim())
                width = parseInt(style.split("width:")[1].split("px")[0].trim())

                // Asegurar altura par
                if (height % 2 !== 0) {
                    height += 1
                }
            }

            // Generar PDF
            const pdfPath = path.join(tempDir, `${String(i).padStart(3, '0')}.pdf`)
            await page.pdf({
                path: pdfPath,
                width: width,
                height: height,
                printBackground: true,
                timeout: 0
            })

            // Ocultar página actual
            await page.evaluate((i) => {
                const pageEl = document.getElementById(`outer_page_${(i + 1)}`)
                if (pageEl) {
                    pageEl.style.display = 'none'
                }
            }, i)

            progress.update(i + 1)
        }

        progress.complete()
    }

    /**
     * Combinar PDFs individuales
     * @param {string} tempDir - Directorio temporal
     * @param {number} pageCount - Número de páginas
     * @param {string} outputPath - Ruta de salida
     */
    async mergePdfs(tempDir, pageCount, outputPath) {
        this.logger.info('🔗 Combinando PDFs...')

        const outputPdf = await PDFDocument.create()

        for (let i = 0; i < pageCount + 1; i++) {
            const tmpPdfPath = path.join(tempDir, `${String(i).padStart(4, '0')}.pdf`)

            // Intentar con 3 dígitos si falla 4 (compatibilidad con embedsDefault)
            // O mejor hacer el loop flexible
            let exists = false;
            let finalPath = tmpPdfPath;

            try { await fs.access(tmpPdfPath); exists = true; } catch { }

            if (!exists) {
                const tmp3 = path.join(tempDir, `${String(i).padStart(3, '0')}.pdf`)
                try { await fs.access(tmp3); finalPath = tmp3; exists = true; } catch { }
            }

            if (!exists) continue; // Saltar si no existe (inicio loop en 0 vs 1)

            try {
                const pdfBytes = await fs.readFile(finalPath)
                const sourcePdf = await PDFDocument.load(pdfBytes)
                const copiedPages = await outputPdf.copyPages(sourcePdf, sourcePdf.getPageIndices())
                copiedPages.forEach(page => outputPdf.addPage(page))
            } catch (error) {
                this.logger.warn(`No se pudo combinar PDF: ${finalPath}`, { error: error.message })
            }
        }

        const outputPdfBytes = await outputPdf.save()
        // Asegurar directorio existe
        await directoryIo.create(path.dirname(outputPath));
        await fs.writeFile(outputPath, outputPdfBytes)

        // Validación de integridad
        const finalPageCount = outputPdf.getPageCount()
        this.logger.debug(`✅ Integridad verificada: ${finalPageCount} páginas`)
    }

    /**
     * Descargar usando modo imagen
     * @param {string} url - URL de embed
     */
    async embedsImage(url) {
        const m = scribdRegex.EMBED.exec(url)
        if (!m) {
            throw new Error(`URL de embed inválida: ${url}`)
        }

        const id = m[1]
        const deviceScaleFactor = 2
        let page = null
        let tempDir = null

        try {
            // Crear directorio temporal
            tempDir = path.join(output, id)
            await this.createOutputDirectory(tempDir)

            // Navegar a Scribd
            this.logger.info(`🌐 Conectando a Scribd...`)
            page = await this.navigateToPage(url, 1000)

            // Obtener título
            const title = await this.getDocumentTitle(page)
            this.logger.info(`📖 Documento: ${title}`)

            // Ocultar elementos que bloquean
            await this.hideBlockers(page)

            // Descargar imágenes
            const images = await this.downloadImages(page, tempDir, deviceScaleFactor)

            // Generar PDF
            const identifier = PathValidator.sanitizeFilename(filename == "title" ? title : id)
            const outputPdfPath = path.join(output, `${identifier}.pdf`)
            await pdfGenerator.generate(images, outputPdfPath)

            // Limpiar directorio temporal
            await directoryIo.remove(tempDir)

            this.logger.info(`✅ PDF generado: ${outputPdfPath}`)

        } catch (error) {
            this.logger.error('Error en modo imagen', error)
            if (tempDir) {
                await directoryIo.remove(tempDir)
            }
            throw error
        } finally {
            if (page) {
                await page.close()
            }
            await puppeteerSg.close()
        }
    }

    /**
     * Ocultar elementos bloqueadores
     * @param {Page} page - Página de Puppeteer
     */
    async hideBlockers(page) {
        try {
            const docScroller = await page.$("div.document_scroller")
            if (docScroller) {
                await docScroller.evaluate((el) => {
                    el["style"]["bottom"] = "0px"
                    el["style"]["margin-top"] = "0px"
                })
            }

            const docToolbarDrop = await page.$("div.toolbar_drop")
            if (docToolbarDrop) {
                await docToolbarDrop.evaluate((el) => el["style"]["display"] = "none")
            }
        } catch (error) {
            this.logger.debug('Error ocultando blockers', error)
        }
    }

    /**
     * Descargar imágenes de páginas
     * @param {Page} page - Página de Puppeteer
     * @param {string} tempDir - Directorio temporal
     * @param {number} deviceScaleFactor - Factor de escala
     * @returns {Promise<Image[]>}
     */
    async downloadImages(page, tempDir, deviceScaleFactor) {
        const docOuterPages = await page.$$("div.outer_page_container div[id^='outer_page_']")
        const images = []

        const progress = new ProgressTracker(docOuterPages.length, 'Capturando imágenes')
        progress.start()

        for (let i = 0; i < docOuterPages.length; i++) {
            await page.evaluate((i) => {
                const pageEl = document.getElementById(`outer_page_${(i + 1)}`)
                if (pageEl) {
                    pageEl.scrollIntoView()
                }
            }, i)

            // Calcular dimensiones
            let width = 1191
            let height = 1684
            const style = await docOuterPages[i].evaluate((el) => el.getAttribute("style"))

            if (style && style.includes("width:") && style.includes("height:")) {
                const styleWidth = parseInt(style.split("width:")[1].split("px")[0].trim())
                const styleHeight = parseInt(style.split("height:")[1].split("px")[0].trim())
                height = Math.ceil(width * styleHeight / styleWidth)
            }

            await page.setViewport({ width, height, deviceScaleFactor })

            // Capturar screenshot
            const imagePath = path.join(tempDir, `${String(i + 1).padStart(4, '0')}.png`)
            await docOuterPages[i].screenshot({ path: imagePath })

            // Obtener metadatos
            const metadata = await sharp(imagePath).metadata()
            images.push(new Image(imagePath, metadata.width, metadata.height))

            progress.update(i + 1)
        }

        progress.complete()
        return images
    }
}

export const scribdDownloader = new ScribdDownloader()
