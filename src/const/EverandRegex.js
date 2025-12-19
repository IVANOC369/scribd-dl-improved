// Soporta www.everand.com y subdominios internacionales
const DOMAIN = /^https:\/\/(www|es|fr|de|it|pt|ru|ja|ko|zh)\.everand\.com/
const PODCAST_SERIES = /^https:\/\/(?:www|es|fr|de|it|pt|ru|ja|ko|zh)\.everand\.com\/podcast-show\/([0-9]+)\/([a-zA-z0-9_-]+)/
const PODCAST_EPISODE = /^https:\/\/(?:www|es|fr|de|it|pt|ru|ja|ko|zh)\.everand\.com\/podcast\/([0-9]+)\/([a-zA-z0-9_-]+)/
const PODCAST_LISTEN = /^https:\/\/(?:www|es|fr|de|it|pt|ru|ja|ko|zh)\.everand\.com\/listen\/podcast\/([0-9]+)/
const AUDIOBOOK = /^https:\/\/(?:www|es|fr|de|it|pt|ru|ja|ko|zh)\.everand\.com\/audiobook\/([0-9]+)\/([a-zA-z0-9_-]+)/
const AUDIOBOOK_LISTEN = /^https:\/\/(?:www|es|fr|de|it|pt|ru|ja|ko|zh)\.everand\.com\/listen\/audiobook\/([0-9]+)/
const BOOK = /^https:\/\/(?:www|es|fr|de|it|pt|ru|ja|ko|zh)\.everand\.com\/book\/([0-9]+)\/([a-zA-z0-9_-]+)/
const READ = /^https:\/\/(?:www|es|fr|de|it|pt|ru|ja|ko|zh)\.everand\.com\/read\/([0-9]+)\/([a-zA-z0-9_-]+)/

export { DOMAIN, PODCAST_SERIES, PODCAST_EPISODE, PODCAST_LISTEN, AUDIOBOOK, AUDIOBOOK_LISTEN, BOOK, READ }
