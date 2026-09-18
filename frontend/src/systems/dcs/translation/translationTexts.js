export const LANGUAGES = ["en", "kn", "fr"];

export const TEXT_KINDS = [
  { kind: "label", labelKey: "DCS_TRANSLATION_KIND_LABEL" },
  { kind: "content", labelKey: "DCS_TRANSLATION_KIND_CONTENT" },
  { kind: "placeholder", labelKey: "DCS_TRANSLATION_KIND_PLACEHOLDER" },
  { kind: "help_text", labelKey: "DCS_TRANSLATION_KIND_HELP_TEXT" },
  { kind: "required_message", labelKey: "DCS_TRANSLATION_KIND_REQUIRED_MESSAGE" },
  { kind: "valid_message", labelKey: "DCS_TRANSLATION_KIND_VALID_MESSAGE" },
  { kind: "options", labelKey: "DCS_TRANSLATION_KIND_OPTIONS" },
  { kind: "rules", labelKey: "DCS_TRANSLATION_KIND_RULES" },
  { kind: "scale", labelKey: "DCS_TRANSLATION_KIND_SCALE" },
];

const NO_LABEL_TYPES = ["paragraph", "group", "section", "file", "image_block", "horizontal_line"];
const NO_INPUT_TYPES = ["paragraph", "header", "group", "section", "file", "image_block", "horizontal_line", "hidden"];

const has_text = (value) => !!value && LANGUAGES.some((code) => String(value[code] || "").trim().length > 0);

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
 * The translatable texts one field carries, as rows a translator edits.
 * Each row names the kind it belongs to (so a locked kind can be shown
 * read-only) and the path the saved change is addressed to.
 */
export function collect_text_rows(field, translate) {
  const rows = [];
  const type = field.type;
  const push = (kind, path, title, value) => rows.push({ kind, path, title, value: value || {} });

  if (!NO_LABEL_TYPES.includes(type) && field.label) push("label", ["label"], translate("DCS_TRANSLATION_KIND_LABEL"), field.label);
  if (type === "paragraph" && field.content) push("content", ["content"], translate("DCS_TRANSLATION_KIND_CONTENT"), field.content);

  if (!NO_INPUT_TYPES.includes(type)) {
    if (field.placeholder) push("placeholder", ["placeholder"], translate("DCS_TRANSLATION_KIND_PLACEHOLDER"), field.placeholder);
    if (field.help_text) push("help_text", ["help_text"], translate("DCS_TRANSLATION_KIND_HELP_TEXT"), field.help_text);
    if (field.mandatory && field.required_message) push("required_message", ["required_message"], translate("DCS_TRANSLATION_KIND_REQUIRED_MESSAGE"), field.required_message);
    if (has_text(field.valid_message)) push("valid_message", ["valid_message"], translate("DCS_TRANSLATION_KIND_VALID_MESSAGE"), field.valid_message);
  }

  if (field.low_label) push("scale", ["low_label"], translate("DCS_TRANSLATION_LOW"), field.low_label);
  if (field.high_label) push("scale", ["high_label"], translate("DCS_TRANSLATION_HIGH"), field.high_label);

  const option_rows = (options) =>
    (options || []).forEach((option) => {
      if (option && option.id && option.label) push("options", ["options", option.id], `${translate("DCS_TRANSLATION_OPTION")}: ${option.value}`, option.label);
    });
  option_rows(field.options);
  (field.parent_option_groups || []).forEach((group) => option_rows(group.options));

  (field.validation_rules || []).forEach((rule, index) => {
    if (!rule || !rule.id) return;
    const name = `${translate("DCS_TRANSLATION_RULE")} ${index + 1} (${rule.operator || ""})`;
    if (rule.message) push("rules", ["rules", rule.id, "message"], name, rule.message);
    if (has_text(rule.valid_message)) push("rules", ["rules", rule.id, "valid_message"], `${name} - ${translate("DCS_TRANSLATION_KIND_VALID_MESSAGE")}`, rule.valid_message);
  });

  return rows;
}

/** Writes one language of one row into the pending-changes tree, keyed by field id then path. */
export function set_change(changes, field_id, path, code, value) {
  const next = Object.assign({}, changes);
  const own = Object.assign({}, next[field_id] || {});
  if (path.length === 1) {
    own[path[0]] = Object.assign({}, own[path[0]] || {}, { [code]: value });
  } else if (path[0] === "options") {
    own.options = Object.assign({}, own.options || {}, { [path[1]]: Object.assign({}, (own.options || {})[path[1]] || {}, { [code]: value }) });
  } else if (path[0] === "rules") {
    const rule = Object.assign({}, (own.rules || {})[path[1]] || {});
    rule[path[2]] = Object.assign({}, rule[path[2]] || {}, { [code]: value });
    own.rules = Object.assign({}, own.rules || {}, { [path[1]]: rule });
  }
  next[field_id] = own;
  return next;
}

/** The pending value of a row's language, falling back to what the form holds. */
export function read_change(changes, field_id, path, code, fallback) {
  const own = changes[field_id];
  if (!own) return fallback;
  let node = own;
  if (path.length === 1) node = own[path[0]];
  else if (path[0] === "options") node = (own.options || {})[path[1]];
  else if (path[0] === "rules") node = ((own.rules || {})[path[1]] || {})[path[2]];
  return node && node[code] !== undefined ? node[code] : fallback;
}

export function count_changes(changes) {
  let total = 0;
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    Object.keys(node).forEach((key) => {
      if (LANGUAGES.includes(key)) total += 1;
      else walk(node[key]);
    });
  };
  walk(changes);
  return total;
}
