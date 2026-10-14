const { flatten_fields } = require("../jsonlogic/dependency_graph.js");

/**
 * Record tracking: a form whose records are found again by one or more KEY
 * fields (a national id, a plot number, a name) and then updated on a
 * chosen set of fields, every change kept with its date and time. A
 * record is found when ANY of its key fields holds the typed value.
 *
 * tracking: {
 *   enabled: boolean,
 *   key_field_ids: [<field id>],    one or more, in order, no upper limit
 *   key_field_id: <field id>,       the first key, kept for old readers
 *   key_unique: boolean,            one record per key COMBINATION, or several
 *   editable_field_ids: [<field id>] the fields a later update may change
 * }
 *
 * An older config carries key_field_id alone; it is read as key_field_ids
 * of one entry everywhere, and normalised to the full shape when saved.
 *
 * On every submission of a tracked form:
 *   record_key       the normalised key values joined with "|" in key
 *                    order (what uniqueness is judged on), indexed
 *   record_key_pairs [{ f: field id, k: normalised value }] - one entry
 *                    per answered key field, what the public lookup
 *                    searches by, indexed
 *   record_key_fields the key field ids the pairs were built for, joined
 *                    with "|" - a record whose marker differs from the
 *                    form's current keys is re-stamped from its answers
 *   tracking_periods { <field id>: [{ value, from, to }] } - the value each
 *                    editable field held from one moment to the next; the
 *                    first period starts at the record's own submission
 *                    time, the open one has to: null
 *   history          [{ at, kind, by, changes: [{ field_id, from, to }] }]
 */

const KEY_FIELD_TYPES = ["text", "large_text", "number", "email", "phone", "url", "single_select", "select_group", "cascading_select", "date", "hidden"];
// Layout blocks ("file" is the static file block, not an upload field) and
// the location capture cannot be updated; every answer field can - media
// fields (image, video, audio, file_upload, signature) included, their
// value being the list of files.
const NOT_EDITABLE_TYPES = ["paragraph", "header", "file", "image_block", "horizontal_line", "section", "group", "geolocation"];
const MAX_EDITABLE_FIELDS = 200;
const KEY_JOINER = "|";
// Digits (spaces allowed between them), an optional sign, an optional fraction.
const NUMERIC_TEXT = /^[+-]?[\d\s]+(\.\d*)?$/;

/** The key field ids of a config in order, reading the old single key_field_id as a list of one. */
function key_ids_of(tracking) {
  if (!tracking || typeof tracking !== "object") return [];
  if (Array.isArray(tracking.key_field_ids)) {
    const seen = new Set();
    return tracking.key_field_ids.filter((field_id) => {
      if (typeof field_id !== "string" || !field_id || seen.has(field_id)) return false;
      seen.add(field_id);
      return true;
    });
  }
  return typeof tracking.key_field_id === "string" && tracking.key_field_id ? [tracking.key_field_id] : [];
}

function is_enabled(tracking) {
  return !!(tracking && tracking.enabled === true && key_ids_of(tracking).length > 0);
}

/**
 * One key answer as it is stored and searched: a trimmed, lowercased
 * string; "" when unanswered. A number reads the same however it was
 * typed or stored: spaces inside the digits are dropped ("0788 123 456"
 * is "0788123456"), a leading plus goes, and so do trailing fractional
 * zeros ("12.0" and "12.50" are "12" and "12.5"). Leading zeros are kept,
 * so an id that starts with 0 stays itself.
 */
function record_key_of(value) {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.map((entry) => record_key_of(entry)).filter(Boolean).join(",");
  if (typeof value === "object") return "";
  return canonical_number(String(value).trim().toLowerCase());
}

function canonical_number(text) {
  if (!NUMERIC_TEXT.test(text)) return text;
  const compact = text.replace(/\s+/g, "").replace(/^\+/, "");
  if (!compact.includes(".")) return compact;
  return compact.replace(/0+$/, "").replace(/\.$/, "");
}

/**
 * The record's whole key: every key answer normalised and joined with "|"
 * in key order. One key field gives exactly record_key_of(its answer).
 * "" when no key field was answered at all.
 */
function composite_record_key(tracking, data) {
  const parts = key_ids_of(tracking).map((field_id) => record_key_of((data || {})[field_id]));
  if (!parts.some(Boolean)) return "";
  return parts.join(KEY_JOINER);
}

/** The searchable pairs of a record: [{ f, k }] for every key field that was answered. */
function record_key_pairs(tracking, data) {
  return key_ids_of(tracking)
    .map((field_id) => ({ f: field_id, k: record_key_of((data || {})[field_id]) }))
    .filter((pair) => pair.k);
}

/** The marker of a key config: its field ids joined, what a record's pairs were built for. */
function key_fields_version(tracking) {
  return key_ids_of(tracking).join(KEY_JOINER);
}

/** Everything a record carries for the key index, derived from its answers alone. */
function key_fields_of(tracking, data) {
  return {
    record_key: composite_record_key(tracking, data),
    record_key_pairs: record_key_pairs(tracking, data),
    record_key_fields: key_fields_version(tracking),
  };
}

/**
 * Validates an author's tracking config against the schema it belongs to.
 * An absent or disabled config is always valid. Either key_field_ids (one
 * or more, any count) or the older key_field_id names the keys.
 */
function validate_tracking_config(tracking, schema) {
  const errors = [];
  if (tracking === undefined || tracking === null) return { valid: true, errors };
  if (typeof tracking !== "object" || Array.isArray(tracking)) return { valid: false, errors: ["tracking must be an object"] };
  if (tracking.enabled !== true) return { valid: true, errors };

  const fields_by_id = new Map(flatten_fields((schema && schema.fields) || []).map((field) => [field.id, field]));
  const has_list = tracking.key_field_ids !== undefined;
  if (has_list && !Array.isArray(tracking.key_field_ids)) {
    errors.push("tracking.key_field_ids must be a list of field ids");
  }
  const key_ids = key_ids_of(tracking);
  if (key_ids.length === 0) {
    errors.push(has_list ? "tracking.key_field_ids must name at least one field of the form" : "tracking.key_field_id must name a field of the form");
  }
  key_ids.forEach((field_id) => {
    const key_field = fields_by_id.get(field_id);
    if (!key_field) errors.push(`tracking.key_field_ids: unknown field ${field_id}`);
    else if (!KEY_FIELD_TYPES.includes(key_field.type)) errors.push(`tracking.key_field_ids: a ${key_field.type} field cannot be a key`);
  });
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
      else if (key_ids.includes(field_id)) errors.push("tracking.editable_field_ids: a key field itself cannot be changed");
      else if (NOT_EDITABLE_TYPES.includes(field.type)) errors.push(`tracking.editable_field_ids: a ${field.type} cannot be updated`);
    });
  }
  return { valid: errors.length === 0, errors };
}

function label_text(field, language) {
  const label = field && field.label && typeof field.label === "object" ? field.label : {};
  const text = (language && label[language]) || label.en || label.kn || label.fr || "";
  return String(text).trim() || field.id;
}

/**
 * The key fields' own names in the reader's language (["National ID",
 * "Plot number"]), in key order, for messages to respondents - who know a
 * field by its label, not as "the key". Falls back through English to the
 * field id.
 */
function key_field_labels(schema, tracking, language) {
  if (!is_enabled(tracking)) return [];
  const fields_by_id = new Map(flatten_fields((schema && schema.fields) || []).map((field) => [field.id, field]));
  return key_ids_of(tracking).map((field_id) => {
    const field = fields_by_id.get(field_id);
    return field ? label_text(field, language) : field_id;
  });
}

/** The label of one key field (the first one when none is named) - the old single-key reading. */
function key_field_label(schema, tracking, language, field_id) {
  const ids = key_ids_of(tracking);
  const labels = key_field_labels(schema, tracking, language);
  const index = field_id ? ids.indexOf(field_id) : 0;
  return index >= 0 && labels[index] !== undefined ? labels[index] : "";
}

/** The stored shape: null when off, otherwise exactly the five keys, key_field_id being the first key. */
function normalize_tracking_config(tracking) {
  if (!is_enabled(tracking)) return null;
  const key_ids = key_ids_of(tracking);
  const seen = new Set();
  const editable = (tracking.editable_field_ids || []).filter((field_id) => {
    if (typeof field_id !== "string" || !field_id || seen.has(field_id) || key_ids.includes(field_id)) return false;
    seen.add(field_id);
    return true;
  });
  return {
    enabled: true,
    key_field_ids: key_ids,
    key_field_id: key_ids[0],
    key_unique: tracking.key_unique === true,
    editable_field_ids: editable,
  };
}

/**
 * What a brand new submission of a tracked form carries: its key and its
 * searchable pairs, the opening period of every editable field and a
 * "created" history entry.
 */
function tracking_fields_for_new(tracking, data, submitted_at, by) {
  if (!is_enabled(tracking)) return {};
  const periods = {};
  (tracking.editable_field_ids || []).forEach((field_id) => {
    periods[field_id] = [{ value: value_or_null(data[field_id]), from: submitted_at, to: null }];
  });
  return Object.assign(key_fields_of(tracking, data), {
    tracking_periods: periods,
    updated_at: null,
    history: [{ at: submitted_at, kind: "created", by: by || null, changes: [] }],
  });
}

function value_or_null(value) {
  return value === undefined ? null : value;
}

function same_value(a, b) {
  return JSON.stringify(value_or_null(a)) === JSON.stringify(value_or_null(b));
}

/**
 * The BASELINE of a record collected before the form tracked it, or
 * before a field became updatable: a "created" history entry at its
 * submission (when it has none) and, for every updatable field without
 * periods, a first period open since the submission holding the value
 * the record has now - so its first follow-up change already reads as a
 * history, and the as-of reading shows the old value for any moment
 * before that change. Returns { history, tracking_periods, created_added,
 * periods_added }: the record's own when nothing was missing.
 */
function seed_baseline(tracking, record) {
  const submitted_at = record.submitted_at;
  const history = Array.isArray(record.history) ? record.history.slice() : [];
  const created_added = !history.some((entry) => entry && entry.kind === "created");
  if (created_added) history.unshift({ at: submitted_at, kind: "created", by: null, changes: [] });
  const tracking_periods = Object.assign({}, record.tracking_periods || {});
  let periods_added = false;
  ((tracking && tracking.editable_field_ids) || []).forEach((field_id) => {
    if (Array.isArray(tracking_periods[field_id]) && tracking_periods[field_id].length > 0) return;
    tracking_periods[field_id] = [{ value: value_or_null((record.data || {})[field_id]), from: submitted_at, to: null }];
    periods_added = true;
  });
  return { history, tracking_periods, created_added, periods_added };
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
  key_ids_of,
  record_key_of,
  composite_record_key,
  record_key_pairs,
  key_fields_version,
  key_fields_of,
  validate_tracking_config,
  normalize_tracking_config,
  key_field_label,
  key_field_labels,
  tracking_fields_for_new,
  seed_baseline,
  diff_editable,
  next_periods,
};
