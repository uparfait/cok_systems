/**
 * The kinds of translatable text a form field carries, and how a batch of
 * translations is applied to a schema. A translation link lets its holder
 * change these texts - in en, kn and fr - and nothing else: never a field's
 * type, id, options' values, conditions, formulas or design. Kinds the
 * link's creator locked are refused even when the request carries them.
 */
const LANGUAGES = ["en", "kn", "fr"];
const MAX_TEXT_LENGTH = 4000;

const SIMPLE_KINDS = {
  label: "label",
  content: "content",
  placeholder: "placeholder",
  help_text: "help_text",
  required_message: "required_message",
  valid_message: "valid_message",
  low_label: "scale",
  high_label: "scale",
};

const TEXT_KINDS = ["label", "content", "placeholder", "help_text", "required_message", "valid_message", "options", "rules", "scale"];

function read_locked_kinds(raw) {
  if (!Array.isArray(raw)) return [];
  return Array.from(new Set(raw.filter((kind) => TEXT_KINDS.includes(kind))));
}

/** A translated text object read from a request: only the three languages, strings only, capped. */
function read_translated(raw) {
  if (!raw || typeof raw !== "object") return null;
  const out = {};
  LANGUAGES.forEach((code) => {
    if (typeof raw[code] === "string") out[code] = raw[code].slice(0, MAX_TEXT_LENGTH);
  });
  return Object.keys(out).length > 0 ? out : null;
}

function apply_translated(target, incoming) {
  const next = Object.assign({}, target || {});
  Object.keys(incoming).forEach((code) => {
    next[code] = incoming[code];
  });
  return next;
}

function apply_option_labels(options, incoming, counter) {
  (options || []).forEach((option) => {
    const change = option && option.id ? read_translated(incoming[option.id]) : null;
    if (!change) return;
    option.label = apply_translated(option.label, change);
    counter.count += 1;
  });
}

/**
 * Applies one field's translations in place, honouring the locked kinds.
 * Returns how many texts were changed.
 */
function apply_field_changes(field, changes, locked, counter) {
  Object.keys(SIMPLE_KINDS).forEach((key) => {
    if (locked.includes(SIMPLE_KINDS[key])) return;
    const incoming = read_translated(changes[key]);
    if (!incoming) return;
    if (field[key] === undefined || field[key] === null) return;
    field[key] = apply_translated(field[key], incoming);
    counter.count += 1;
  });

  if (!locked.includes("options") && changes.options && typeof changes.options === "object") {
    apply_option_labels(field.options, changes.options, counter);
    (field.parent_option_groups || []).forEach((group) => apply_option_labels(group.options, changes.options, counter));
  }

  if (!locked.includes("rules") && changes.rules && typeof changes.rules === "object") {
    (field.validation_rules || []).forEach((rule) => {
      const change = rule && rule.id ? changes.rules[rule.id] : null;
      if (!change || typeof change !== "object") return;
      ["message", "valid_message"].forEach((key) => {
        const incoming = read_translated(change[key]);
        if (!incoming) return;
        rule[key] = apply_translated(rule[key], incoming);
        counter.count += 1;
      });
    });
  }
}

/**
 * Walks every field (groups' and sections' children included) and applies
 * the changes addressed to it. Works on a deep copy; the original schema is
 * never touched.
 */
function apply_translation_changes(fields, changes, locked_kinds) {
  const copy = JSON.parse(JSON.stringify(fields || []));
  const safe_changes = changes && typeof changes === "object" ? changes : {};
  const locked = read_locked_kinds(locked_kinds);
  const counter = { count: 0 };
  const walk = (list) =>
    (list || []).forEach((field) => {
      if (!field || typeof field !== "object") return;
      const own = field.id ? safe_changes[field.id] : null;
      if (own && typeof own === "object") apply_field_changes(field, own, locked, counter);
      if (Array.isArray(field.children)) walk(field.children);
    });
  walk(copy);
  return { fields: copy, applied: counter.count };
}

module.exports = {
  TEXT_KINDS,
  LANGUAGES,
  read_locked_kinds,
  apply_translation_changes,
};
