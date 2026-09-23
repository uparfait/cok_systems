import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import { get_field_text } from "../fields/fieldText.js";

/**
 * Record tracking, the frontend half (the server's rules live in
 * dc_backend/utilities/tracking.js): a form whose records are found again
 * by one KEY field and then updated on a chosen set of fields, every
 * change kept with its date and time.
 *
 * tracking: { enabled, key_field_id, key_unique, editable_field_ids }
 */

export const KEY_FIELD_TYPES = ["text", "number", "email", "phone", "url", "single_select", "select_group", "cascading_select", "date", "hidden"];
export const NOT_EDITABLE_TYPES = ["paragraph", "header", "file", "image_block", "horizontal_line", "section", "group", "geolocation"];

export function empty_tracking() {
  return { enabled: false, key_field_id: "", key_unique: true, editable_field_ids: [] };
}

export const is_tracking_enabled = (tracking) => !!(tracking && tracking.enabled === true && tracking.key_field_id);

/** A stored or pasted config brought to the four known keys; unknown fields are dropped. */
export function normalize_tracking(raw, fields) {
  if (!raw || typeof raw !== "object" || raw.enabled !== true) return empty_tracking();
  const known = new Set(flatten_fields(fields || []).map((field) => field.id));
  const key_field_id = typeof raw.key_field_id === "string" && known.has(raw.key_field_id) ? raw.key_field_id : "";
  const editable = Array.isArray(raw.editable_field_ids) ? raw.editable_field_ids.filter((id) => typeof id === "string" && known.has(id) && id !== key_field_id) : [];
  return { enabled: !!key_field_id, key_field_id, key_unique: raw.key_unique !== false, editable_field_ids: [...new Set(editable)] };
}

/** What is sent to the server: null when off. */
export function tracking_payload(tracking) {
  if (!is_tracking_enabled(tracking)) return null;
  return {
    enabled: true,
    key_field_id: tracking.key_field_id,
    key_unique: tracking.key_unique !== false,
    editable_field_ids: (tracking.editable_field_ids || []).filter((id) => id !== tracking.key_field_id),
  };
}

/** The fields of the form that may be the key: one answer, typed or picked, never a file or a container. */
export function key_candidates(fields) {
  return flatten_fields(fields || []).filter((field) => KEY_FIELD_TYPES.includes(field.type));
}

/** The fields that may be updated later: every answer except the key and the containers. */
export function editable_candidates(fields, key_field_id) {
  return flatten_fields(fields || []).filter((field) => !NOT_EDITABLE_TYPES.includes(field.type) && field.id !== key_field_id);
}

/** A field's name for lists and tables, falling back to its id. */
export function field_name(field, language) {
  if (!field) return "";
  return get_field_text(field.label, language) || get_field_text(field.label, "en") || field.id;
}

/** The set of field ids a respondent may NOT change on a loaded record. */
export function locked_field_ids(tracking, fields) {
  if (!is_tracking_enabled(tracking)) return new Set();
  const editable = new Set(tracking.editable_field_ids || []);
  return new Set(flatten_fields(fields || []).map((field) => field.id).filter((id) => !editable.has(id)));
}

/** One stored answer as a short line for the history tables. */
export function format_value(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (Array.isArray(value)) return value.map((entry) => format_value(entry)).join(", ");
  if (typeof value === "object") {
    if (value.name) return String(value.name);
    if (value.hours !== undefined) return `${value.hours || 0}h ${value.minutes || 0}m`;
    return JSON.stringify(value);
  }
  return String(value);
}

export function format_when(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}
