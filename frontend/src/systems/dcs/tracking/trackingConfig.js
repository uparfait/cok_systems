import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import { get_field_text } from "../fields/fieldText.js";

export const KEY_FIELD_TYPES = ["text", "large_text", "number", "email", "phone", "url", "single_select", "select_group", "cascading_select", "date", "hidden"];
export const NOT_EDITABLE_TYPES = ["paragraph", "header", "file", "image_block", "horizontal_line", "section", "group", "geolocation"];
export const SEARCHABLE_INPUT_TYPES = ["text", "large_text", "number", "email", "phone", "url", "date"];
export const LAYOUT_FIELD_TYPES = ["section", "group", "paragraph", "header", "image_block", "horizontal_line", "file"];

export function empty_tracking() {
  return { enabled: false, key_field_ids: [], key_field_id: "", key_unique: true, editable_field_ids: [] };
}

export function key_ids_of(tracking) {
  if (!tracking || typeof tracking !== "object") return [];
  if (Array.isArray(tracking.key_field_ids)) {
    return [...new Set(tracking.key_field_ids.filter((id) => typeof id === "string" && id))];
  }
  return typeof tracking.key_field_id === "string" && tracking.key_field_id ? [tracking.key_field_id] : [];
}

export const is_tracking_enabled = (tracking) => !!(tracking && tracking.enabled === true && key_ids_of(tracking).length > 0);

export function normalize_tracking(raw, fields) {
  if (!raw || typeof raw !== "object" || raw.enabled !== true) return empty_tracking();
  const known = new Set(flatten_fields(fields || []).map((field) => field.id));
  const key_field_ids = key_ids_of(raw).filter((id) => known.has(id));
  const keys = new Set(key_field_ids);
  const editable = Array.isArray(raw.editable_field_ids) ? raw.editable_field_ids.filter((id) => typeof id === "string" && known.has(id) && !keys.has(id)) : [];
  return {
    enabled: key_field_ids.length > 0,
    key_field_ids,
    key_field_id: key_field_ids[0] || "",
    key_unique: raw.key_unique !== false,
    editable_field_ids: [...new Set(editable)],
  };
}

export function tracking_payload(tracking) {
  if (!is_tracking_enabled(tracking)) return null;
  const key_field_ids = key_ids_of(tracking);
  return {
    enabled: true,
    key_field_ids,
    key_field_id: key_field_ids[0],
    key_unique: tracking.key_unique !== false,
    editable_field_ids: (tracking.editable_field_ids || []).filter((id) => !key_field_ids.includes(id)),
  };
}

export function key_candidates(fields) {
  return flatten_fields(fields || []).filter((field) => KEY_FIELD_TYPES.includes(field.type));
}

export function editable_candidates(fields, key_field_ids) {
  const keys = new Set(Array.isArray(key_field_ids) ? key_field_ids : key_field_ids ? [key_field_ids] : []);
  return flatten_fields(fields || []).filter((field) => !NOT_EDITABLE_TYPES.includes(field.type) && !keys.has(field.id));
}

export function field_name(field, language) {
  if (!field) return "";
  return get_field_text(field.label, language) || get_field_text(field.label, "en") || field.id;
}

export function key_fields_of(tracking, fields) {
  const by_id = new Map(flatten_fields(fields || []).map((field) => [field.id, field]));
  return key_ids_of(tracking).map((id) => by_id.get(id)).filter(Boolean);
}

export function key_names(tracking, fields, language) {
  return key_fields_of(tracking, fields).map((field) => field_name(field, language)).join(" + ");
}

export function with_key_on_top(form) {
  const tracking = form && form.tracking;
  if (!form || !form.schema || !is_tracking_enabled(tracking)) return form;
  const key_ids = key_ids_of(tracking);
  const found = new Map();
  const strip = (list) =>
    (list || []).reduce((out, field) => {
      if (key_ids.includes(field.id)) {
        found.set(field.id, field);
        return out;
      }
      if ((field.type === "group" || field.type === "section") && Array.isArray(field.children)) {
        out.push(Object.assign({}, field, { children: strip(field.children) }));
        return out;
      }
      out.push(field);
      return out;
    }, []);
  const rest = strip(form.schema.fields);
  const top = key_ids
    .filter((id) => found.has(id))
    .map((id) => {
      const copy = Object.assign({}, found.get(id));
      delete copy.section_layout;
      return copy;
    });
  if (top.length === 0) return form;
  return Object.assign({}, form, { schema: Object.assign({}, form.schema, { fields: top.concat(rest) }) });
}

export function field_state(field, tracking, loaded) {
  if (!field || LAYOUT_FIELD_TYPES.includes(field.type)) return "layout";
  if (key_ids_of(tracking).includes(field.id)) return loaded ? "disabled" : "key";
  if (!loaded) return "disabled";
  const editable = tracking && Array.isArray(tracking.editable_field_ids) ? tracking.editable_field_ids : [];
  return editable.includes(field.id) ? "enabled" : "disabled";
}

const is_media_value = (value) => !!value && typeof value === "object" && !!(value.url || value.data_url || value.pending_file);

function answer_text(value) {
  if (value === undefined || value === null || value === "") return "";
  if (Array.isArray(value)) return value.map((entry) => answer_text(entry)).join("|");
  if (is_media_value(value)) return String(value.url || value.data_url || value.name || "");
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export function change_count(record) {
  const entries = record && Array.isArray(record.history) ? record.history : [];
  return entries.filter((entry) => entry && entry.kind !== "created").length;
}

export const has_history = (record) => change_count(record) > 0;

export const same_answer = (a, b) => answer_text(a) === answer_text(b);

export function has_editable_changes(tracking, loaded_data, values) {
  const editable = tracking && Array.isArray(tracking.editable_field_ids) ? tracking.editable_field_ids : [];
  const data = loaded_data || {};
  const current = values || {};
  return editable.some((id) => !same_answer(current[id], data[id]));
}

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
