import cliProgress from "cli-progress"
import { puppeteerSg } from "../utils/request/PuppeteerSg.js";
import { configLoader } from "../utils/io/ConfigLoader.js";
import { directoryIo } from "../utils/io/DirectoryIo.js"
import * as everandRegex from "../const/EverandRegex.js"
import axios from "axios";
import fs from "fs"
import { pdfGenerator } from "../utils/io/PdfGenerator.js"
import { Image } from "../object/Image.js"
import sharp from "sharp"
import path from "path"

import { scribdDownloader } from "./ScribdDownloader.js"

const output = configLoader.load("DIRECTORY", "output")

class EverandDownloader {
    constructor() {
        if (!EverandDownloader.instance) {
            EverandDownloader.instance = this
        }
        return EverandDownloader.instance
    }

    async execute(url) {
        if (url.match(everandRegex.PODCAST_SERIES)) {
            await this.series(url)
        } else if (url.match(everandRegex.PODCAST_EPISODE)) {
            await this.listen(`https://www.everand.com/listen/podcast/${everandRegex.PODCAST_EPISODE.exec(url)[1]}`)
        } else if (url.match(everandRegex.PODCAST_LISTEN)) {
            await this.listen(url)
        } else if (url.match(everandRegex.AUDIOBOOK)) {
            await this.listen(`https://www.everand.com/listen/audiobook/${everandRegex.AUDIOBOOK.exec(url)[1]}`, true, 'audiobook')
        } else if (url.match(everandRegex.AUDIOBOOK_LISTEN)) {
            await this.listen(url, true, 'audiobook')
        } else if (url.match(everandRegex.BOOK_READ) || url.match(everandRegex.BOOK_VIEW)) {
            console.log('📚 Libro detectado. Iniciando motor Epub de Everand...')
            await scribdDownloader.downloadEverandEpub(url)
        } else {
            throw new Error(`Unsupported URL: ${url}`)
        }
    }

    /**
     * Descarga de Ebooks de Everand mediante captura visual a PDF
     * @param {string} url 
     */
    async readBook(url) {
        console.log(`📖 Iniciando descarga de libro (Modo Visual PDF Perfecto): ${url}`)
        const page = await puppeteerSg.getPage(url)

        // Configurar viewport vertical (tipo Tableta) para forzar vista de UNA sola página
        // Esto evita el problema de doble columna que causa pérdida de páginas
        await page.setViewport({ width: 800, height: 1200, deviceScaleFactor: 2 })

        // 1. Detectar y pulsar "Leer ahora"
        try {
            await page.waitForSelector('a[href*="/read/"], button', { timeout: 5000 })
            const readButton = await page.evaluateHandle(() => {
                const buttons = [...document.querySelectorAll('a, button')];
                return buttons.find(b => b.innerText.toLowerCase().includes('leer ahora') || b.innerText.toLowerCase().includes('read now'));
            });

            if (readButton && await readButton.asElement()) {
                console.log('Botón "Leer ahora" detectado, pulsando...')
                await Promise.all([
                    readButton.click(),
                    page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => { })
                ]);
            }
        } catch {
            console.log('ℹ️  No se detectó botón de landing page, asumiendo vista de lectura directa.')
        }

        console.log('⏳ Esperando carga del visor...')
        await new Promise(resolve => setTimeout(resolve, 5000))

        // Obtener título
        let title = "libro_everand"
        try {
            title = await page.title()
            title = title.replace('| Everand', '').trim().replace(/[^a-z0-9]/gi, '_')
        } catch { }

        const outputDir = `${output}/books/${title}_pdf`
        await directoryIo.create(outputDir)
        const tempImgDir = path.join(outputDir, 'temp_images')
        await directoryIo.create(tempImgDir)

        console.log(`⬇️  Capturando páginas en: ${tempImgDir}`)

        // Inyectar CSS para limpiar interfaz y forzar tema claro para impresión
        await page.addStyleTag({
            content: `
                /* Ocultar UI de Everand para captura limpia */
                header, footer, nav,
                .header, .footer, .global_header,
                .scrubber, /* Barra de progreso inferior */
                .toolbar, /* Barras de herramientas */
                button[aria-label="Previous page"], 
                button[aria-label="Next page"],
                .arrow_left, .arrow_right,
                div[class*="page_controls"],
                div[class*="progress"] { 
                    opacity: 0 !important; 
                    visibility: hidden !important; 
                    pointer-events: none !important; /* Para que no bloqueen clics */
                }
                
                /* Forzar fondo blanco y texto negro para PDF legible */
                body, .reader_content, [role="main"] {
                    background-color: white !important;
                    color: black !important;
                }
                
                /* Asegurar que el contenido ocupe toda la pantalla */
                .reader_content {
                    height: 100vh !important;
                    width: 100vw !important;
                    margin: 0 !important;
                    padding: 20px !important; /* Margen de seguridad */
                }
            `
        })

        let hasNext = true
        let pageNum = 1
        const images = []
        let noChangeCount = 0
        let lastBuffer = null

        const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)
        bar.start(300, 0) // Estimado

        while (hasNext) {
            // Esperar renderizado completo (importante para las fuentes)
            await new Promise(resolve => setTimeout(resolve, 2000))

            // Capturar screenshot del viewport completo (ya que limpiamos la UI)
            const imgPath = path.join(tempImgDir, `${String(pageNum).padStart(4, '0')}.png`)

            const buffer = await page.screenshot({
                path: imgPath,
                fullPage: false // Capturar solo lo que se ve (una página)
            })

            // Detección de fin por imagen duplicada (si no avanza)
            if (lastBuffer && buffer.equals(lastBuffer)) {
                noChangeCount++
                if (noChangeCount > 3) {
                    console.warn('⚠️  La página no cambia, fin del libro detectado.')
                    break
                }
            } else {
                noChangeCount = 0
                lastBuffer = buffer

                const metadata = await sharp(buffer).metadata()
                images.push(new Image(imgPath, metadata.width, metadata.height))

                bar.increment()
                pageNum++
            }

            // Navegar siguiente
            try {
                // Hacemos CLIC en el borde derecho (95% ancho, 50% alto)
                // Esta es la forma más universal de avanzar en lectores e-book táctiles/web
                const dims = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }))
                await page.mouse.click(dims.w * 0.95, dims.h * 0.5)

            } catch (e) {
                hasNext = false;
            }
        }

        bar.stop();
        console.log('✅  Descarga finalizada (o detenida).');
        await page.close();
        await puppeteerSg.close();
    }

    async listen(url, isEpisode, type = 'podcast') {
        if (typeof isEpisode === "undefined") {
            isEpisode = true
        }

        let id
        if (type === 'audiobook') {
            id = everandRegex.AUDIOBOOK_LISTEN.exec(url)[1]
        } else {
            id = everandRegex.PODCAST_LISTEN.exec(url)[1]
        }

        console.log(`🎧 Procesando ${type}: ${id}`)

        // navigate to everand
        let page = await puppeteerSg.getPage(url)

        // wait rendering
        await new Promise(resolve => setTimeout(resolve, 2000))

        // get title, audio-url, series-url
        const title = await page.evaluate(() => {
            try {
                return eval('Scribd.current_doc.short_title')
            } catch {
                return document.title.split('|')[0].trim()
            }
        })

        const audioUrl = await page.evaluate(() => {
            const audio = document.querySelector('audio#audioplayer')
            return audio ? audio.src : null
        })

        if (!audioUrl) {
            console.error('❌ No se encontró la URL del audio. Puede requerir suscripción premium.')
            await page.close()
            if (isEpisode) await puppeteerSg.close()
            return
        }

        let dir
        if (type === 'audiobook') {
            // Para audiolibros, usamos el directorio "audiobooks" y el título del libro
            dir = `${output}/audiobooks`
            await directoryIo.create(dir)
        } else {
            // Podcast logic
            let seriesUrl = await page.evaluate(() => {
                const el = document.querySelector('a[href^="https://www.everand.com/podcast-show/"]')
                return el ? el.href : null
            })

            if (seriesUrl) {
                const seriesId = everandRegex.PODCAST_SERIES.exec(seriesUrl)[1]
                dir = `${output}/${seriesId}`
            } else {
                dir = `${output}/podcasts`
            }
            await directoryIo.create(dir)
        }

        // download audio
        const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
        if (isEpisode) {
            bar.start(1, 0)
        }

        // Limpiar nombre de archivo
        const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase()
        let path = `${dir}/${id}_${safeTitle}.mp3`

        console.log(`⬇️  Descargando a: ${path}`)

        const resp = await axios.get(audioUrl, { responseType: 'stream' })
        resp.data.pipe(fs.createWriteStream(path))

        // Esperar a que termine la descarga
        await new Promise((resolve, reject) => {
            resp.data.on('end', () => {
                if (isEpisode) {
                    bar.update(1)
                    bar.stop()
                }
                resolve()
            })
            resp.data.on('error', reject)
        })

        await page.close()
        if (isEpisode) {
            await puppeteerSg.close()
        }
    }

    async series(url) {
        const seriesId = everandRegex.PODCAST_SERIES.exec(url)[1]
        console.log(`📻 Descargando serie de podcast: ${seriesId}`)

        // navigate to everand
        let page = await puppeteerSg.getPage(url)

        // wait rendering
        await new Promise(resolve => setTimeout(resolve, 2000))

        // get number-of-episodes with fallback
        let totalEpisode = 0
        try {
            totalEpisode = await page.evaluate(() => {
                const el = document.querySelector('span[data-e2e="podcast-series-header-total-episodes"]')
                return el ? parseInt(el.textContent.replace(/[^0-9]/g, "")) : 0
            })
        } catch {
            console.warn('⚠️  No se pudo determinar el total de episodios')
        }

        // get pages with fallback
        let totalPage = 1
        try {
            const pages = await page.evaluate(() => {
                const els = document.querySelectorAll('div[data-e2e="pagination"] a[aria-label^="Page"]')
                return els.length > 0 ? [...els].at(-1).textContent : "1"
            })
            totalPage = parseInt(pages)
        } catch {
            // Si falla, asumimos 1 página
        }

        console.log(`📄 Total de páginas detectadas: ${totalPage}`)

        const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)
        bar.start(totalEpisode || 10, 0)

        for (let i = 1; i <= totalPage; i++) {
            if (i > 1) {
                await page.goto(`${url}?page=${i}&sort=desc`, { waitUntil: "load" })
                await new Promise(resolve => setTimeout(resolve, 2000))
            }

            let episodes = await page.evaluate(() => {
                // Intentar selector específico primero
                let links = document.querySelectorAll('div.breakpoint_hide.below a[data-e2e="podcast-episode-player-button"]')

                // Fallback a selectores más genéricos si falla
                if (links.length === 0) {
                    links = document.querySelectorAll('a[href^="https://www.everand.com/listen/podcast/"]')
                }

                return [...links].map(x => x.href)
            })

            console.log(`⬇️  Procesando página ${i}: ${episodes.length} episodios encontrados`)

            for (let j = 0; j < episodes.length; j++) {
                await this.listen(episodes[j], false)
                bar.increment()
            }
        }
        bar.stop()

        await page.close()
        await puppeteerSg.close()
    }
}

export const everandDownloader = new EverandDownloader()