import { dcs_supported_languages } from "../i18n/index.js";
import { get_field_text } from "./fieldText.js";

export const LANGUAGE_NAME_KEYS = { en: "DCS_LANGUAGE_EN", kn: "DCS_LANGUAGE_KN", fr: "DCS_LANGUAGE_FR" };

export function shows_all_languages(field) {
  return !!(field && field.design && field.design.show_all_languages);
}

/**
 * The text blocks a heading or paragraph draws. Normally one, in the
 * reader's language (falling back like every other label). A welcome note
 * or a thank-you can instead be told to show every language it was
 * written in, one under the other - the reader's own language first, then
 * the others in the form's fixed order - so a mixed audience reads one
 * block without switching the form's language.
 */
export function language_blocks(field, translated, language) {
  const text = translated || {};
  if (!shows_all_languages(field)) {
    return [{ language, text: get_field_text(text, language) }];
  }
  const order = [language].concat(dcs_supported_languages.filter((code) => code !== language));
  const blocks = order.filter((code) => String(text[code] || "").trim().length > 0).map((code) => ({ language: code, text: text[code] }));
  return blocks.length > 0 ? blocks : [{ language, text: get_field_text(text, language) }];
}
