const en = require("./en");
const kn = require("./kn");
const fr = require("./fr");

const catalogs = { en, kn, fr };
const supported_languages = ["en", "kn", "fr"];
const default_language = "kn";

/**
 * Resolves a supported language code, falling back to the system default.
 */
function resolve_language(lang) {
  const normalized = (lang || "").toString().trim().toLowerCase();
  return supported_languages.includes(normalized) ? normalized : default_language;
}

/**
 * Translates a message key into the requested language, filling {{placeholders}}
 * from vars. Falls back to English then to the raw key if nothing matches.
 */
function translate(key, lang, vars) {
  const language = resolve_language(lang);
  const catalog = catalogs[language] || catalogs[default_language];
  let message = catalog[key] || catalogs.en[key] || key;

  if (vars && typeof vars === "object") {
    Object.keys(vars).forEach((varKey) => {
      message = message.split(`{{${varKey}}}`).join(String(vars[varKey]));
    });
  }

  return message;
}

module.exports = {
  translate,
  resolve_language,
  supported_languages,
  default_language,
};
