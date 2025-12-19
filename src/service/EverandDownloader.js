import cliProgress from "cli-progress"
import { puppeteerSg } from "../utils/request/PuppeteerSg.js";
import { configLoader } from "../utils/io/ConfigLoader.js";
import { directoryIo } from "../utils/io/DirectoryIo.js"
import * as everandRegex from "../const/EverandRegex.js"
import axios from "axios";
import fs from "fs"


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
            // Grupo 1 es ID para audiolibros (índice ajustado a 1 si la regex no tiene subdominio, pero ahora tiene)
            // La regex actualizada tiene subdominio en grupo 1 (si no es non-capturing), ID en 2.
            // Verificamos regex en EverandRegex.js:
            // const AUDIOBOOK = /^https:\/\/(?:www|es|fr|de|it|pt|ru|ja|ko|zh)\.everand\.com\/audiobook\/([0-9]+)\/([a-zA-z0-9_-]+)/
            // El grupo del dominio es non-capturing (?:...), así que ID es [1]
            await this.listen(`https://www.everand.com/listen/audiobook/${everandRegex.AUDIOBOOK.exec(url)[1]}`, true, 'audiobook')
        } else if (url.match(everandRegex.AUDIOBOOK_LISTEN)) {
            await this.listen(url, true, 'audiobook')
        } else if (url.match(everandRegex.BOOK) || url.match(everandRegex.READ)) {
            await this.readBook(url)
        } else {
            throw new Error(`Unsupported URL: ${url}`)
        }
    }

    /**
     * Descarga de Ebooks de Everand simulando lectura
     * @param {string} url 
     */
    async readBook(url) {
        console.log(`📖 Iniciando descarga de libro: ${url}`)
        const page = await puppeteerSg.getPage(url)

        // 1. Detectar y pulsar "Leer ahora" si estamos en la landing page del libro
        try {
            // Buscamos botones con texto "Leer ahora" o similar
            await page.waitForSelector('a[href*="/read/"], button', { timeout: 5000 })
            const readButton = await page.evaluateHandle(() => {
                // Buscamos por texto porque las clases cambian
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

        // 2. Esperar al visor de lectura
        // El visor suele tener indicadores de página tipo "PÁGINA 1 DE 348" o una estructura específica
        console.log('⏳ Esperando carga del visor...')
        await new Promise(resolve => setTimeout(resolve, 5000)) // Espera generosa inicial

        // Obtener metadatos básicos
        let title = "libro_everand";
        try {
            title = await page.title();
            title = title.replace('| Everand', '').trim().replace(/[^a-z0-9]/gi, '_');
        } catch {
            // Ignorar error de título
        }

        const outputDir = `${output}/books/${title}`
        await directoryIo.create(outputDir)
        const contentFile = `${outputDir}/content.txt`

        console.log(`⬇️  Guardando contenido en: ${contentFile}`)
        fs.writeFileSync(contentFile, `TITULO: ${title}\nURL: ${url}\n\n`)

        let hasNext = true
        let pageNum = 1
        let noChangeCount = 0
        let lastContent = ""

        const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
        bar.start(100, 0); // Desconocemos total exacto al inicio muchas veces

        while (hasNext) {
            // 3. Extraer contenido
            // Intentar obtener texto visible del contenedor principal
            const pageContent = await page.evaluate(() => {
                // Selectores comunes de lectores de ebooks en web
                const contentSelectors = [
                    '.reader_content',
                    '[role="main"]',
                    '#main-content',
                    '.page_content',
                    'div[class*="text_layer"]',
                    'div[data-page-number]' // A veces usan data attributes
                ];

                for (const sel of contentSelectors) {
                    const el = document.querySelector(sel);
                    if (el && el.innerText.length > 50) return el.innerText;
                }
                return document.body.innerText; // Fallback agresivo
            });

            // Evitar duplicados exactos si la página no avanzó realmente
            if (pageContent !== lastContent) {
                fs.appendFileSync(contentFile, `\n\n--- PÁGINA ${pageNum} ---\n\n${pageContent}`);
                lastContent = pageContent;
                noChangeCount = 0;
                bar.increment();
                pageNum++;
                console.log(`📄 Capturada página ${pageNum}`);
            } else {
                noChangeCount++;
                if (noChangeCount > 5) {
                    console.warn('⚠️  El contenido no cambia. Posible fin del libro o bloqueo.');
                    break;
                }
            }

            // 4. Navegar a siguiente página e interactuar
            try {
                let clicked = false;

                // 4.1 Buscar botón "Seguir leyendo" o "Next chapter" dentro del contenido
                const loadMoreClicked = await page.evaluate(() => {
                    // Buscamos botones o enlaces visibles que parezcan ser de continuación de lectura
                    const candidates = [...document.querySelectorAll('button, a, div[role="button"], span')];
                    const loadMore = candidates.find(b => {
                        const t = b.innerText.toLowerCase();
                        // Palabras clave comunes en Everand
                        return (t.includes('seguir leyendo') ||
                            t.includes('continue reading') ||
                            t.includes('siguiente capítulo') ||
                            t.includes('next chapter'))
                            && b.offsetParent !== null // Visible
                            && b.innerText.length < 50; // Evitar falsos positivos con párrafos largos
                    });

                    if (loadMore) {
                        loadMore.click();
                        return true;
                    }
                    return false;
                });

                if (loadMoreClicked) {
                    console.log('⏬ Botón "Seguir leyendo/Siguiente capítulo" pulsado.');
                    clicked = true;
                    // Esperar más tiempo porque esto suele cargar un nuevo capítulo entero
                    await new Promise(resolve => setTimeout(resolve, 3000));
                } else {
                    // 4.2 Buscar botones de "Siguiente" página estándar (flechas, etc.)
                    clicked = await page.evaluate(() => {
                        const nextSelectors = [
                            'button[aria-label*="Next"]',
                            'button[aria-label*="Siguiente"]',
                            '.next_page',
                            '.arrow_right',
                            'div[class*="next_btn"]',
                            '[data-e2e="next-chapter-button"]'
                        ];

                        for (const sel of nextSelectors) {
                            const btn = document.querySelectorAll(sel);
                            // A veces hay varios (arriba/abajo), pulsamos el último visible
                            const visibleBtn = [...btn].find(b => b.offsetParent !== null);
                            if (visibleBtn) {
                                visibleBtn.click();
                                return true;
                            }
                        }
                        return false;
                    });
                }

                if (!clicked) {
                    // Intento de clic físico en el borde derecho
                    const dims = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
                    await page.mouse.click(dims.w - 50, dims.h / 2);
                }

                await new Promise(resolve => setTimeout(resolve, 1500)); // Esperar renderizado y transición

            } catch (e) {
                console.error('Error al navegar:', e);
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