import puppeteer from 'puppeteer'

class PuppeteerSg {
  constructor() {
    if (!PuppeteerSg.instance) {
      PuppeteerSg.instance = this;
      process.on('exit', () => {
        this.close();
      });
    }
    return PuppeteerSg.instance;
  }

  /**
   * Launch a browser
   */
  async launch() {
    const isCI = process.env.CI === 'true'; // Detect if running in CI
    const args = [];
    if (isCI) {
      args.push('--no-sandbox', '--disable-setuid-sandbox');
    }
    this.browser = await puppeteer.launch({
      headless: "new",
      defaultViewport: null,
      args,
      timeout: 0,
    });
  }

  /**
   * New a page
   * @param {string} url 
   * @returns 
   */
  async getPage(url) {
    if (!this.browser) {
      await this.launch()
    }
    const page = await this.browser.newPage()

    // Inyección de cookies premium
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const cookiePath = path.resolve(process.cwd(), 'cookies.json');

      console.log(`🍪 Buscando cookies en: ${cookiePath}`);

      try {
        await fs.default.access(cookiePath);
        const cookiesData = await fs.default.readFile(cookiePath, 'utf8');
        const cookies = JSON.parse(cookiesData);

        if (Array.isArray(cookies)) {
          // Filtrar cookies y limpiar campos incompatibles con Puppeteer
          const validCookies = cookies.map(c => {
            const cookie = { ...c };
            // Puppeteer no acepta sameSite: null
            if (cookie.sameSite === null || cookie.sameSite === undefined) {
              delete cookie.sameSite;
            }
            // storeId a veces causa problemas
            delete cookie.storeId;
            // Eliminar hostOnly y session si causan conflictos (opcional, pero seguro)
            delete cookie.hostOnly;
            delete cookie.session;
            return cookie;
          }).filter(c => c.name && c.value && c.domain);

          await page.setCookie(...validCookies);
          console.log(`🍪 Sesión Premium cargada: ${validCookies.length} cookies inyectadas.`);
        }
      } catch (e) {
        console.warn(`⚠️ No se pudo cargar cookies.json: ${e.message}`);
      }
    } catch (err) {
      console.error("❌ Error inesperado al cargar cookies:", err);
    }

    await page.goto(url, {
      waitUntil: "load",
    })
    return page
  }

  /**
   * Close the browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export const puppeteerSg = new PuppeteerSg()
