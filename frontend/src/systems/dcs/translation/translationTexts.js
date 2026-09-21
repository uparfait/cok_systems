import { DCS_FIELD_TYPE_REGISTRY } from "../fields/fieldTypes.js";
import { get_field_text } from "../fields/fieldText.js";

/**
 * The texts of a form a translator may rewrite - only what a respondent
 * sees: a field's label (a heading's text), a paragraph's text, option
 * labels, placeholders, help texts and a scale's end labels. Nothing else
 * (types, ids, values, conditions, messages) is ever offered. A link may
 * lock whole languages; a locked language is shown but cannot be typed.
 */
export const LANGUAGES = ["en", "kn", "fr"];
export const LANGUAGE_NAME_KEYS = { en: "DCS_TRANSLATION_LANG_EN", kn: "DCS_TRANSLATION_LANG_KN", fr: "DCS_TRANSLATION_LANG_FR" };
export const FIELDS_PER_PAGE = 3;

const NO_LABEL_TYPES = ["paragraph", "group", "section", "file", "image_block", "horizontal_line"];
const NO_INPUT_TYPES = ["paragraph", "header", "group", "section", "file", "image_block", "horizontal_line", "hidden"];

/** The human name of a field type, never its id. */
export function field_type_name(type, translate) {
  const entry = DCS_FIELD_TYPE_REGISTRY.find((item) => item.type === type);
  return entry ? translate(entry.labelKey) : String(type || "").replace(/_/g, " ");
}

/** Every field of the form in reading order, groups' and sections' children included, nothing skipped for visibility. */
export function flatten_all_fields(fields, depth = 0, out = []) {
  (fields || []).forEach((field) => {
    if (!field || typeof field !== "object") return;
    out.push({ field, depth });
    if (Array.isArray(field.children)) flatten_all_fields(field.children, depth + 1, out);
  });
  return out;
}

/**
 * The translatable texts one field carries, as rows a translator edits:
 * { key, title, value } where key is the path the saved change is
 * addressed to ("label", "content", "placeholder", "help_text",
 * "low_label", "high_label", "options/<option id>").
 */
export function translatable_rows(field, translate, language) {
  const rows = [];
  const type = field.type;
  const push = (key, title, value) => rows.push({ key, title, value: value || {} });

  if (!NO_LABEL_TYPES.includes(type) && field.label) push("label", translate(type === "header" ? "DCS_TRANSLATION_HEADING_TEXT" : "DCS_TRANSLATION_KIND_LABEL"), field.label);
  if (type === "paragraph" && field.content) push("content", translate("DCS_TRANSLATION_KIND_CONTENT"), field.content);
  if (!NO_INPUT_TYPES.includes(type)) {
    if (field.placeholder) push("placeholder", translate("DCS_TRANSLATION_KIND_PLACEHOLDER"), field.placeholder);
    if (field.help_text) push("help_text", translate("DCS_TRANSLATION_KIND_HELP_TEXT"), field.help_text);
  }
  if (field.low_label) push("low_label", translate("DCS_TRANSLATION_LOW"), field.low_label);
  if (field.high_label) push("high_label", translate("DCS_TRANSLATION_HIGH"), field.high_label);

  const option_rows = (options) =>
    (options || []).forEach((option) => {
      if (!option || !option.id || !option.label) return;
      const shown = get_field_text(option.label, language) || option.value;
      push(`options/${option.id}`, `${translate("DCS_TRANSLATION_OPTION")}: ${shown}`, option.label);
    });
  option_rows(field.options);
  (field.parent_option_groups || []).forEach((group) => option_rows(group && group.options));
  return rows;
}

/** The fields that carry something to translate, each with its rows, in form order. */
export function translatable_entries(fields, translate, language) {
  return flatten_all_fields(fields)
    .map((entry) => Object.assign({}, entry, { rows: translatable_rows(entry.field, translate, language) }))
    .filter((entry) => entry.rows.length > 0);
}

export function page_count(total, size) {
  return Math.max(1, Math.ceil(total / (size || FIELDS_PER_PAGE)));
}

export function page_slice(list, page, size) {
  const per_page = size || FIELDS_PER_PAGE;
  return list.slice(page * per_page, page * per_page + per_page);
}

/** Writes one language of one row into the pending-changes tree: { field_id: { key: { code: value } } }. */
export function set_change(changes, field_id, key, code, value) {
  const own = Object.assign({}, changes[field_id] || {});
  own[key] = Object.assign({}, own[key] || {}, { [code]: value });
  return Object.assign({}, changes, { [field_id]: own });
}

/** The pending value of a row's language, falling back to what the form (or a saved proposal) holds. */
export function read_change(changes, field_id, key, code, fallback) {
  const own = changes[field_id];
  const node = own && own[key];
  return node && node[code] !== undefined ? node[code] : fallback;
}

export function count_changes(changes) {
  let total = 0;
  Object.values(changes || {}).forEach((own) => Object.values(own || {}).forEach((texts) => Object.keys(texts || {}).forEach((code) => LANGUAGES.includes(code) && (total += 1))));
  return total;
}

/** Saved proposals indexed for a quick look-up: "field|key|language" -> proposal (the newest wins). */
export function index_proposals(proposals) {
  const map = new Map();
  (proposals || []).forEach((proposal) => {
    const key = `${proposal.field_id}|${(proposal.path || []).join("/")}|${proposal.language}`;
    const held = map.get(key);
    if (!held || String(proposal.proposed_at) >= String(held.proposed_at)) map.set(key, proposal);
  });
  return map;
}

export const proposal_key = (field_id, key, language) => `${field_id}|${key}|${language}`;

/** field_id -> { name, mine }: the translator who first worked on the field through this link. */
export function owners_by_field(proposals) {
  const map = new Map();
  (proposals || [])
    .slice()
    .sort((a, b) => String(a.proposed_at).localeCompare(String(b.proposed_at)))
    .forEach((proposal) => {
      if (!proposal.translator || map.has(proposal.field_id)) return;
      map.set(proposal.field_id, { name: proposal.translator.name || "", mine: proposal.mine === true });
    });
  return map;
}
