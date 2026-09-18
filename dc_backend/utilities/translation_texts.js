/**
 * The texts of a form a translator may rewrite, and how a translation is
 * read from and written into a schema. Only what a RESPONDENT SEES is
 * translatable: a field's label (a heading's text), a paragraph's text,
 * option labels, placeholders, help texts and a scale's end labels - never
 * a type, an id, an option value, a condition, a formula, a design or a
 * validation message. A link may lock whole LANGUAGES (en, kn, fr): a
 * locked language is shown but refused on save.
 */
const LANGUAGES = ["en", "kn", "fr"];
const MAX_TEXT_LENGTH = 4000;

// Field types that show no label of their own to the respondent.
const NO_LABEL_TYPES = ["paragraph", "group", "section", "file", "image_block", "horizontal_line"];
// Field types with no input, so no placeholder or help text is ever shown.
const NO_INPUT_TYPES = ["paragraph", "header", "group", "section", "file", "image_block", "horizontal_line", "hidden"];

const SIMPLE_PATHS = ["label", "content", "placeholder", "help_text", "low_label", "high_label"];

function read_locked_languages(raw) {
  if (!Array.isArray(raw)) return [];
  return Array.from(new Set(raw.filter((code) => LANGUAGES.includes(code))));
}

function flatten(fields, out) {
  const list = out || [];
  (fields || []).forEach((field) => {
    if (!field || typeof field !== "object") return;
    list.push(field);
    if (Array.isArray(field.children)) flatten(field.children, list);
  });
  return list;
}

/** Whether this path is a text the respondent sees on this field. */
function path_allowed(field, path) {
  if (!Array.isArray(path) || path.length === 0) return false;
  const [head] = path;
  if (head === "label") return !NO_LABEL_TYPES.includes(field.type) && path.length === 1;
  if (head === "content") return field.type === "paragraph" && path.length === 1;
  if (head === "placeholder" || head === "help_text") return !NO_INPUT_TYPES.includes(field.type) && path.length === 1;
  if (head === "low_label" || head === "high_label") return path.length === 1;
  if (head === "options") return path.length === 2 && typeof path[1] === "string";
  return false;
}

function find_option(field, option_id) {
  const own = (field.options || []).find((option) => option && option.id === option_id);
  if (own) return own;
  for (const group of field.parent_option_groups || []) {
    const hit = ((group && group.options) || []).find((option) => option && option.id === option_id);
    if (hit) return hit;
  }
  return null;
}

/** The translated text object a path addresses on a field, or null when the field has none there. */
function text_at(field, path) {
  if (!field || !path_allowed(field, path)) return null;
  if (path[0] === "options") {
    const option = find_option(field, path[1]);
    return option && option.label && typeof option.label === "object" ? option.label : null;
  }
  const value = field[path[0]];
  return value && typeof value === "object" ? value : null;
}

/** A clean path from a request: the known shapes only. */
function read_path(raw) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 2) return null;
  const head = String(raw[0]);
  if (raw.length === 1) return SIMPLE_PATHS.includes(head) ? [head] : null;
  return head === "options" && typeof raw[1] === "string" && raw[1].trim() ? ["options", raw[1].trim()] : null;
}

const path_key = (path) => path.join("/");

/**
 * Writes one language of one text into a schema copy. Returns
 * { previous } with the text that stood there (null when the language was
 * empty), or null when the field or path does not exist on the form.
 */
function write_text(fields, field_id, path, language, value) {
  if (!LANGUAGES.includes(language)) return null;
  const field = flatten(fields).find((entry) => entry.id === field_id);
  if (!field || !path_allowed(field, path)) return null;
  if (path[0] === "options") {
    const option = find_option(field, path[1]);
    if (!option) return null;
    const previous = option.label && typeof option.label[language] === "string" ? option.label[language] : null;
    option.label = Object.assign({}, option.label || {}, { [language]: String(value).slice(0, MAX_TEXT_LENGTH) });
    return { previous };
  }
  if (field[path[0]] === undefined || field[path[0]] === null) return null;
  const target = typeof field[path[0]] === "object" ? field[path[0]] : {};
  const previous = typeof target[language] === "string" ? target[language] : null;
  field[path[0]] = Object.assign({}, target, { [language]: String(value).slice(0, MAX_TEXT_LENGTH) });
  return { previous };
}

/**
 * Applies a list of { field_id, path, language, value } onto a deep copy
 * of the fields. Returns { fields, results } where results holds, per
 * entry, the previous text or null when it could not be applied.
 */
function apply_texts(fields, entries) {
  const copy = JSON.parse(JSON.stringify(fields || []));
  const results = (entries || []).map((entry) => write_text(copy, entry.field_id, entry.path, entry.language, entry.value));
  return { fields: copy, results };
}

/** The current text of one language at a path on the live fields, or null. */
function current_text(fields, field_id, path, language) {
  const field = flatten(fields).find((entry) => entry.id === field_id);
  const text = text_at(field, path);
  return text && typeof text[language] === "string" ? text[language] : null;
}

/**
 * Reads the changes a translator saved: { field_id: { <path key>: { en, kn, fr } } }
 * where a path key is "label", "content", "placeholder", "help_text",
 * "low_label", "high_label" or "options/<option id>". Returns clean
 * { field_id, path, language, value } entries, locked languages dropped,
 * unknown fields and paths dropped.
 */
function read_changes(fields, raw, locked_languages) {
  const flat = flatten(fields);
  const by_id = new Map(flat.map((field) => [field.id, field]));
  const locked = read_locked_languages(locked_languages);
  const out = [];
  if (!raw || typeof raw !== "object") return out;
  Object.keys(raw).slice(0, 5000).forEach((field_id) => {
    const field = by_id.get(field_id);
    const own = raw[field_id];
    if (!field || !own || typeof own !== "object") return;
    Object.keys(own).forEach((key) => {
      const path = read_path(key.split("/"));
      if (!path || !path_allowed(field, path) || !text_at(field, path)) return;
      const texts = own[key];
      if (!texts || typeof texts !== "object") return;
      LANGUAGES.forEach((language) => {
        if (locked.includes(language) || typeof texts[language] !== "string") return;
        out.push({ field_id, path, language, value: texts[language].slice(0, MAX_TEXT_LENGTH) });
      });
    });
  });
  return out;
}

module.exports = {
  LANGUAGES,
  read_locked_languages,
  read_path,
  path_key,
  text_at,
  current_text,
  write_text,
  apply_texts,
  read_changes,
};
