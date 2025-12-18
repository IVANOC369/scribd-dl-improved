// Soporta www.scribd.com y subdominios internacionales (es, fr, de, it, pt, ru, ja, ko, zh)
const DOMAIN = /^https:\/\/(www|es|fr|de|it|pt|ru|ja|ko|zh)\.scribd\.com/
const DOCUMENT = /^https:\/\/(www|es|fr|de|it|pt|ru|ja|ko|zh)\.scribd\.com\/(document|doc)\/([0-9]+)/
const EMBED = /^https:\/\/(www|es|fr|de|it|pt|ru|ja|ko|zh)\.scribd\.com\/embeds\/([0-9]+)/

export { DOMAIN, DOCUMENT, EMBED }
