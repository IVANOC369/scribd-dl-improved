// Soporta www.scribd.com, everand.com y subdominios internacionales
const DOMAIN = /^https:\/\/(www|es|fr|de|it|pt|ru|ja|ko|zh)\.scribd\.com/
const DOCUMENT = /^https:\/\/(www|es|fr|de|it|pt|ru|ja|ko|zh)\.(?:scribd|everand)\.com\/(document|doc|book|read)\/([0-9]+)/
const EMBED = /^https:\/\/(www|es|fr|de|it|pt|ru|ja|ko|zh)\.(?:scribd|everand)\.com\/embeds\/([0-9]+)/

export { DOMAIN, DOCUMENT, EMBED }
