import en from "./en.js";
import kn from "./kn.js";
import fr from "./fr.js";

export const dcs_catalogs = { en, kn, fr };
export const dcs_supported_languages = ["en", "kn", "fr"];
export const dcs_default_language = "kn";

/**
 * Translates a message key into the requested language, filling
 * {{placeholders}} from vars, falling back to English then the raw key.
 */
export function dcs_translate(key, language, vars) {
  const catalog = dcs_catalogs[language] || dcs_catalogs[dcs_default_language];
  let message = catalog[key] || dcs_catalogs.en[key] || key;

  if (vars && typeof vars === "object") {
    Object.keys(vars).forEach((var_key) => {
      message = message.split(`{{${var_key}}}`).join(String(vars[var_key]));
    });
  }

  return message;
}
