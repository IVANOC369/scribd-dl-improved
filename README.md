# Scribd-dl Mejorado 🚀

![Node.js](https://img.shields.io/badge/node.js-v18%2B-339933.svg?style=flat&logo=nodedotjs&logoColor=white) ![npm](https://img.shields.io/badge/npm-8%2B-dc2c35.svg?style=flat&logo=npm&logoColor=white) ![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg)

## 📖 Acerca de

**Scribd-dl** es una herramienta mejorada y optimizada para descargar documentos de múltiples plataformas sin necesidad de membresía o inicio de sesión:

- 📄 Documentos de [Scribd.com](https://www.scribd.com/) (incluyendo sitios internacionales: es.scribd.com, fr.scribd.com, etc.)
- 📊 Presentaciones de [SlideShare.net](https://www.slideshare.net/)
- 🎧 Podcasts de [Everand.com](https://www.everand.com/podcasts)

### ✨ Mejoras Recientes

- ✅ **Fallback automático**: Si el modo texto falla, cambia automáticamente a modo imagen
- ✅ **Soporte internacional**: Funciona con todos los subdominios de Scribd (es, fr, de, it, pt, ru, ja, ko, zh)
- ✅ **Optimización de velocidad**: Descarga 2x más rápida con rendertime optimizado
- ✅ **Timeout inteligente**: Evita esperas infinitas con timeout de 5 minutos
- ✅ **Detección de atascamiento**: Detecta y corrige cuando el scroll se atasca
- ✅ **Mensajes en español**: Interfaz completamente traducida con emojis informativos
- ✅ **Arquitectura mejorada**: Código refactorizado y modular para mejor mantenibilidad

---

## 📋 Requisitos Previos

Para usar Scribd-dl, necesitas tener instalado [Node.js](https://nodejs.org/en/download/). Se recomienda usar la última versión LTS disponible (v18 o superior).

> ⚠️ **Importante**: Instala Node.js usando los instaladores oficiales para tu plataforma para evitar problemas de compatibilidad.

Verifica que Node.js esté instalado correctamente:

```bash
node -v
npm -v
```

Estos comandos deben mostrar las versiones de Node.js y npm instaladas.

---

## ⚙️ Instalación

1. **Clona el repositorio**:

```bash
git clone https://github.com/tu-usuario/scribd-dl
cd scribd-dl
```

2. **Instala las dependencias**:

```bash
npm install
```

---

## 🎛️ Configuración

Puedes personalizar el comportamiento editando `config.ini`:

```ini
[SCRIBD]
rendertime=50

[DIRECTORY]
output=output
filename=title
```

### Opciones de Configuración

| Parámetro | Descripción | Valor Recomendado | Plataformas |
|-----------|-------------|-------------------|-------------|
| `rendertime` | Tiempo de espera en ms para renderizado de cada página | `50` (rápido)<br>`100` (estable)<br>`150` (conexión lenta) | Scribd |
| `output` | Directorio de salida para archivos descargados | `output` | Todas |
| `filename` | Formato del nombre de archivo<br>• `title`: usa el título del documento<br>• `id`: usa el ID del documento | `title` | Scribd, SlideShare |

---

## 🚀 Uso

### Sintaxis Básica

```bash
npm start [opciones] <url>
```

### Opciones Disponibles

| Opción | Descripción |
|--------|-------------|
| `/d` | Modo texto (predeterminado): Genera PDF mediante renderizado HTML |
| `/i` | Modo imagen: Genera PDF mediante capturas de pantalla |

---

## 📚 Ejemplos de Uso

### Scribd - Modo Texto con Fallback Automático

```bash
npm start "https://www.scribd.com/document/123456/ejemplo"
```

Si el modo texto falla, **automáticamente** cambiará a modo imagen sin intervención manual.

### Scribd - Modo Imagen Directo (Recomendado para Documentos Largos)

```bash
npm start /i "https://www.scribd.com/document/516272221/El-Poder-de-La-Autodisciplina"
```

### Scribd - Sitios Internacionales

```bash
npm start /i "https://es.scribd.com/document/406064798/Energia-y-Tipos-de-Energia"
npm start "https://fr.scribd.com/document/123456/exemple"
npm start "https://de.scribd.com/document/789012/beispiel"
```

### SlideShare

```bash
npm start "https://www.slideshare.net/slideshow/everything-you-need-to-know-about-chatgpt/266783915"
```

### Everand - Serie Completa de Podcast

```bash
npm start "https://www.everand.com/podcast-show/414106971/TED-Talks-Daily"
```

### Everand - Episodio Individual

```bash
npm start "https://www.everand.com/listen/podcast/731670963"
```

---

## 🌐 URLs Soportadas

### Scribd (Todos los subdominios)
- `https://www.scribd.com/document/**`
- `https://www.scribd.com/doc/**`
- `https://www.scribd.com/embeds/**`
- `https://es.scribd.com/document/**` (Español)
- `https://fr.scribd.com/document/**` (Francés)
- `https://de.scribd.com/document/**` (Alemán)
- Y otros: `it`, `pt`, `ru`, `ja`, `ko`, `zh`

### SlideShare
- `https://www.slideshare.net/**`
- `https://www.slideshare.net/slideshow/**`

### Everand
- `https://www.everand.com/podcast-show/**`
- `https://www.everand.com/podcast/**`
- `https://www.everand.com/listen/podcast/**`

---

## 💡 Consejos de Uso

### ¿Cuándo usar Modo Texto?

✅ **Recomendado para**:
- Documentos pequeños (< 50 páginas)
- Cuando necesitas texto seleccionable
- PDFs de mejor calidad para documentos de texto

### ¿Cuándo usar Modo Imagen?

✅ **Recomendado para**:
- Documentos largos (> 100 páginas)
- Máxima velocidad (2-3 minutos vs 5-10 minutos)
- Máxima confiabilidad (100% tasa de éxito)
- Documentos con layouts complejos

### Tiempos de Descarga Estimados

| Páginas | Modo Texto | Modo Imagen |
|---------|------------|-------------|
| 1-20 | 1-2 min | 30-60 seg |
| 20-50 | 2-4 min | 1-2 min |
| 50-100 | 4-8 min | 2-3 min |
| 100+ | 8-15 min | 3-5 min |

---

## 🛠️ Desarrollo

### Ejecutar Tests

```bash
npm test
```

### Ejecutar Linter

```bash
npm run lint
```

### Modo Debug

Para ver logs detallados, usa la variable de entorno `DEBUG`:

```bash
DEBUG=true npm start "url"
```

---

## 🏗️ Arquitectura del Proyecto

```
src/
├── service/
│   ├── BaseDownloader.js       # Clase base con funcionalidad compartida
│   ├── ScribdDownloader.js     # Lógica de descarga de Scribd
│   ├── SlideshareDownloader.js # Lógica de descarga de SlideShare
│   └── EverandDownloader.js    # Lógica de descarga de Everand
├── utils/
│   ├── io/
│   │   ├── ConfigLoader.js     # Carga de configuración
│   │   ├── DirectoryIo.js      # Gestión de directorios
│   │   └── PdfGenerator.js     # Generación de PDFs
│   ├── request/
│   │   ├── PuppeteerSg.js      # Gestión de Puppeteer
│   │   └── RetryHelper.js      # Lógica de reintentos
│   ├── ui/
│   │   └── ProgressTracker.js  # Barras de progreso
│   ├── logging/
│   │   └── Logger.js           # Sistema de logging
│   └── validation/
│       └── PathValidator.js    # Validación de rutas
└── const/
    ├── ScribdRegex.js          # Expresiones regulares para Scribd
    ├── ScribdFlag.js           # Flags de modo
    ├── SlideshareRegex.js      # Expresiones regulares para SlideShare
    └── EverandRegex.js         # Expresiones regulares para Everand
```

---

## 🐛 Solución de Problemas

### El modo texto se queda atascado

**Solución**: El sistema tiene un timeout de 5 minutos y automáticamente cambiará a modo imagen. También puedes usar directamente modo imagen:

```bash
npm start /i "url"
```

### Error "URL no soportada"

**Solución**: Verifica que la URL sea de una plataforma soportada (Scribd, SlideShare o Everand) y que esté en el formato correcto.

### Descargas muy lentas

**Solución**: 
1. Reduce el `rendertime` en `config.ini` (mínimo 50ms)
2. Usa modo imagen que es más rápido
3. Verifica tu conexión a internet

---

## 📝 Plan de Desarrollo Futuro

- [ ] Des-ofuscación de PDFs de Scribd para texto seleccionable
- [ ] Soporte para descarga de libros completos
- [ ] Interfaz gráfica (GUI)
- [ ] Sistema de caché para evitar re-descargas
- [ ] Soporte para más plataformas

---

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Haz fork del proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-caracteristica`)
3. Commit tus cambios (`git commit -m 'Añadir nueva característica'`)
4. Push a la rama (`git push origin feature/nueva-caracteristica`)
5. Abre un Pull Request

---

## 📄 Licencia

Este proyecto está licenciado bajo la [Licencia GPL-3.0](LICENSE).

---

## 🙏 Agradecimientos

- Proyecto original: [rkwyu/scribd-dl](https://github.com/rkwyu/scribd-dl)
- Mejoras y optimizaciones por la comunidad

---

## ⚠️ Descargo de Responsabilidad

Esta herramienta es solo para uso educativo y personal. Respeta los términos de servicio de las plataformas y los derechos de autor de los contenidos.
