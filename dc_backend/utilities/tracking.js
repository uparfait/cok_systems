const { flatten_fields } = require("../jsonlogic/dependency_graph.js");

/**
 * Record tracking: a form whose records are found again by one KEY field
 * (a national id, a plot number) and then updated on a chosen set of
 * fields, every change kept with its date and time.
 *
 * tracking: {
 *   enabled: boolean,
 *   key_field_id: <field id>,
 *   key_unique: boolean,            one record per key, or several
 *   editable_field_ids: [<field id>] the fields a later update may change
 * }
 *
 * On every submission of a tracked form:
 *   record_key       the key answer, trimmed and lowercased, indexed
 *   tracking_periods { <field id>: [{ value, from, to }] } - the value each
 *                    editable field held from one moment to the next; the
 *                    first period starts at the record's own submission
 *                    time, the open one has to: null
 *   history          [{ at, kind, by, changes: [{ field_id, from, to }] }]
 */

const KEY_FIELD_TYPES = ["text", "number", "email", "phone", "url", "single_select", "select_group", "cascading_select", "date", "hidden"];
const NOT_EDITABLE_TYPES = ["paragraph", "header", "file", "image_block", "horizontal_line", "section", "group", "geolocation"];
const MAX_EDITABLE_FIELDS = 200;

function is_enabled(tracking) {
  return !!(tracking && tracking.enabled === true && tracking.key_field_id);
}

/** The key answer as it is stored and searched: a trimmed, lowercased string; "" when unanswered. */
function record_key_of(value) {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.map((entry) => record_key_of(entry)).filter(Boolean).join(",");
  if (typeof value === "object") return "";
  return String(value).trim().toLowerCase();
}

/**
 * Validates an author's tracking config against the schema it belongs to.
 * An absent or disabled config is always valid.
 */
function validate_tracking_config(tracking, schema) {
  const errors = [];
  if (tracking === undefined || tracking === null) return { valid: true, errors };
  if (typeof tracking !== "object" || Array.isArray(tracking)) return { valid: false, errors: ["tracking must be an object"] };
  if (tracking.enabled !== true) return { valid: true, errors };

  const fields_by_id = new Map(flatten_fields((schema && schema.fields) || []).map((field) => [field.id, field]));
  const key_field = fields_by_id.get(tracking.key_field_id);
  if (typeof tracking.key_field_id !== "string" || !key_field) {
    errors.push("tracking.key_field_id must name a field of the form");
  } else if (!KEY_FIELD_TYPES.includes(key_field.type)) {
    errors.push(`tracking.key_field_id: a ${key_field.type} field cannot be the key`);
  }
  if (tracking.key_unique !== undefined && typeof tracking.key_unique !== "boolean") {
    errors.push("tracking.key_unique must be true or false");
  }
  if (!Array.isArray(tracking.editable_field_ids)) {
    errors.push("tracking.editable_field_ids must be a list of field ids");
  } else {
    if (tracking.editable_field_ids.length > MAX_EDITABLE_FIELDS) errors.push(`tracking.editable_field_ids: at most ${MAX_EDITABLE_FIELDS} fields`);
    tracking.editable_field_ids.forEach((field_id) => {
      const field = fields_by_id.get(field_id);
      if (typeof field_id !== "string" || !field) errors.push(`tracking.editable_field_ids: unknown field ${field_id}`);
      else if (field_id === tracking.key_field_id) errors.push("tracking.editable_field_ids: the key field itself cannot be changed");
      else if (NOT_EDITABLE_TYPES.includes(field.type)) errors.push(`tracking.editable_field_ids: a ${field.type} cannot be updated`);
    });
  }
  return { valid: errors.length === 0, errors };
}

/**
 * The key field's own name in the reader's language ("National ID"), for
 * messages to respondents - who know the field by its label, not as "the
 * key". Falls back through English to the field id.
 */
function key_field_label(schema, tracking, language) {
  if (!is_enabled(tracking)) return "";
  const field = flatten_fields((schema && schema.fields) || []).find((entry) => entry.id === tracking.key_field_id);
  if (!field) return tracking.key_field_id;
  const label = field.label && typeof field.label === "object" ? field.label : {};
  const text = (language && label[language]) || label.en || label.kn || label.fr || "";
  return String(text).trim() || field.id;
}

/** The stored shape: null when off, otherwise exactly the four keys. */
function normalize_tracking_config(tracking) {
  if (!is_enabled(tracking)) return null;
  const seen = new Set();
  const editable = (tracking.editable_field_ids || []).filter((field_id) => {
    if (typeof field_id !== "string" || !field_id || seen.has(field_id) || field_id === tracking.key_field_id) return false;
    seen.add(field_id);
    return true;
  });
  return {
    enabled: true,
    key_field_id: tracking.key_field_id,
    key_unique: tracking.key_unique === true,
    editable_field_ids: editable,
  };
}

/**
 * What a brand new submission of a tracked form carries: its key, the
 * opening period of every editable field and a "created" history entry.
 */
function tracking_fields_for_new(tracking, data, submitted_at, by) {
  if (!is_enabled(tracking)) return {};
  const periods = {};
  (tracking.editable_field_ids || []).forEach((field_id) => {
    periods[field_id] = [{ value: value_or_null(data[field_id]), from: submitted_at, to: null }];
  });
  return {
    record_key: record_key_of(data[tracking.key_field_id]),
    tracking_periods: periods,
    updated_at: null,
    history: [{ at: submitted_at, kind: "created", by: by || null, changes: [] }],
  };
}

function value_or_null(value) {
  return value === undefined ? null : value;
}

function same_value(a, b) {
  return JSON.stringify(value_or_null(a)) === JSON.stringify(value_or_null(b));
}

/**
 * The changes an update makes on the editable fields only: the previous
 * and the new value of every field whose answer actually differs.
 */
function diff_editable(tracking, previous_data, next_data) {
  const changes = [];
  (tracking.editable_field_ids || []).forEach((field_id) => {
    const from = value_or_null(previous_data[field_id]);
    const to = value_or_null(next_data[field_id]);
    if (!same_value(from, to)) changes.push({ field_id, from, to });
  });
  return changes;
}

/**
 * Closes the open period of every changed field at `at` and opens the next
 * one. A field with no periods yet (tracked after the record was made)
 * gets its previous value backdated to the record's own submission.
 */
function next_periods(existing_periods, changes, at, submitted_at) {
  const periods = Object.assign({}, existing_periods || {});
  changes.forEach((change) => {
    const list = Array.isArray(periods[change.field_id]) ? periods[change.field_id].slice() : [{ value: change.from, from: submitted_at, to: null }];
    const closed = list.map((period) => (period.to === null || period.to === undefined ? Object.assign({}, period, { to: at }) : period));
    closed.push({ value: change.to, from: at, to: null });
    periods[change.field_id] = closed;
  });
  return periods;
}

module.exports = {
  KEY_FIELD_TYPES,
  NOT_EDITABLE_TYPES,
  is_enabled,
  record_key_of,
  validate_tracking_config,
  normalize_tracking_config,
  key_field_label,
  tracking_fields_for_new,
  diff_editable,
  next_periods,
};
