import { app } from './src/App.js'
import * as scribdFlag from './src/const/ScribdFlag.js'

const flags = [scribdFlag.DEFAULT, scribdFlag.IMAGE]

if (process.argv.length >= 3) {
    let url;
    let flag = scribdFlag.DEFAULT;  // Valor por defecto

    for (let i = 2; i < process.argv.length; i++) {
        if (flags.includes(process.argv[i])) {
            flag = process.argv[i]
        } else {
            url = process.argv[i]
        }
    }

    if (!url) {
        console.error('❌ Error: Se requiere una URL')
        console.error(`
Uso: npm start [opciones] url
Opciones:  
  /d        modo texto (predeterminado): genera PDF mediante renderizado
  /i        modo imagen: genera PDF mediante capturas de pantalla
        `)
        process.exit(1)
    }

    try {
        await app.execute(url, flag)
        console.log('✅ ¡Descarga completada exitosamente!')
    } catch (error) {
        console.error('❌ Error:', error.message)
        if (process.env.DEBUG) {
            console.error(error.stack)
        }
        process.exit(1)
    }
} else {
    console.error(`
Uso: npm start [opciones] url

Opciones:  
  /d        modo texto (predeterminado): genera PDF mediante renderizado
  /i        modo imagen: genera PDF mediante capturas de pantalla

Ejemplos:
  npm start "https://www.scribd.com/document/123456/ejemplo"
  npm start /i "https://www.scribd.com/document/123456/ejemplo"
  npm start "https://www.slideshare.net/slideshow/ejemplo/123456"
  npm start "https://www.everand.com/podcast-show/123456/nombre"
    `)
    process.exit(1)
}
