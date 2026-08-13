/**
 * Reads a field-authored translated object (label, placeholder, help text,
 * messages) in the active language, falling back across the other
 * supported languages before returning an empty string.
 */
export function get_field_text(translated_object, language) {
  if (!translated_object) return "";
  return translated_object[language] || translated_object.en || translated_object.kn || translated_object.fr || "";
}

/**
 * Whether a field has any label text authored in at least one language,
 * used to keep unlabeled fields out of "depends on field" pickers where a
 * blank entry would be meaningless to select.
 */
export function has_field_label(field) {
  return get_field_text(field.label, "en").trim().length > 0;
}
