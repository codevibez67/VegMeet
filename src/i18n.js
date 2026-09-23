// ============================================================================
// i18n loader
// ----------------------------------------------------------------------------
// Loads every locales/<code>.json file once at startup and exposes t(lang,
// key, params) to look up display text by a language-neutral message id.
// The state-machine/routing code must NEVER hardcode English strings; it
// only ever deals in ids (message ids, item ids, template ids) and asks this
// module to resolve them against the session's selected locale.
// ============================================================================

const fs = require('fs');
const path = require('path');
const { LANGUAGES } = require('./languages');

const LOCALES_DIR = path.join(__dirname, '..', 'locales');
const cache = {};

function loadLocale(code) {
  if (cache[code]) return cache[code];
  const filePath = path.join(LOCALES_DIR, `${code}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  cache[code] = data;
  return data;
}

// Warm the cache for all registered languages at boot so a bad/missing file
// fails fast instead of on first request.
LANGUAGES.forEach((l) => loadLocale(l.code));

function format(template, params) {
  if (template === undefined) return '';
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(params, key) ? params[key] : match
  );
}

// Falls back to English if a key is missing in the target locale (covers
// untranslated scaffold locales and any accidental gaps).
function t(lang, key, params) {
  const locale = loadLocale(lang) || loadLocale('en');
  const template = locale[key] !== undefined ? locale[key] : loadLocale('en')[key];
  if (template === undefined) return `[[${key}]]`;
  return format(template, params);
}

module.exports = { t, loadLocale };
