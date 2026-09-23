// Registry of all languages Vegmeet is designed to support: the 22 languages
// scheduled in the Eighth Schedule of the Indian Constitution, plus English.
// `translated: true` means locales/<code>.json is fully written out for the
// demo. `translated: false` means the locale file exists as a scaffold with
// correct keys but English placeholder content (see locales/<code>.json,
// marked "_status": "TODO: translate").
//
// `nativeName` is shown on the language-selection screen. It is intentionally
// NOT looked up from the locale files, since a language's own name is
// meaningful regardless of which language is currently selected.
const LANGUAGES = [
  { code: 'en', nativeName: 'English', translated: true },
  { code: 'ta', nativeName: 'தமிழ்', translated: true },
  { code: 'hi', nativeName: 'हिन्दी', translated: true },
  { code: 'te', nativeName: 'తెలుగు', translated: true },
  { code: 'kn', nativeName: 'ಕನ್ನಡ', translated: true },
  { code: 'ml', nativeName: 'മലയാളം', translated: true },
  { code: 'mr', nativeName: 'मराठी', translated: true },
  { code: 'bn', nativeName: 'বাংলা', translated: true },
  { code: 'gu', nativeName: 'ગુજરાતી', translated: true },
  { code: 'pa', nativeName: 'ਪੰਜਾਬੀ', translated: true },
  { code: 'as', nativeName: 'অসমীয়া', translated: false },
  { code: 'brx', nativeName: 'बड़ो', translated: false },
  { code: 'doi', nativeName: 'डोगरी', translated: false },
  { code: 'ks', nativeName: 'کٲشُر', translated: false },
  { code: 'kok', nativeName: 'कोंकणी', translated: false },
  { code: 'mai', nativeName: 'मैथिली', translated: false },
  { code: 'mni', nativeName: 'ꯃꯤꯇꯩꯂꯣꯟ', translated: false },
  { code: 'ne', nativeName: 'नेपाली', translated: false },
  { code: 'or', nativeName: 'ଓଡ଼ିଆ', translated: false },
  { code: 'sa', nativeName: 'संस्कृतम्', translated: false },
  { code: 'sat', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ', translated: false },
  { code: 'sd', nativeName: 'سنڌي', translated: false },
  { code: 'ur', nativeName: 'اردو', translated: false },
];

const PAGE_SIZE = 8;

function getLanguagePage(page) {
  const start = page * PAGE_SIZE;
  return LANGUAGES.slice(start, start + PAGE_SIZE);
}

function totalLanguagePages() {
  return Math.ceil(LANGUAGES.length / PAGE_SIZE);
}

function getLanguageByCode(code) {
  return LANGUAGES.find((l) => l.code === code);
}

module.exports = { LANGUAGES, PAGE_SIZE, getLanguagePage, totalLanguagePages, getLanguageByCode };
