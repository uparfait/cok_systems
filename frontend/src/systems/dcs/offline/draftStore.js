import { storage_get, storage_set, storage_del } from "./offlineStorage.js";
import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import { preset_config } from "../fields/presetFields.js";

const AUTO_FILLED_TYPES = ["geolocation", "hidden", "section", "paragraph", "header", "file", "group", "image_block", "horizontal_line"];

/**
 * One saved draft per form, ever - never a growing list. Filling in the
 * same form again just overwrites this same slot, which is what "don't
 * store more than one draft" means in practice: the respondent's current
 * in-progress entry, not a history of every entry they've ever started.
 * Deliberately a separate store from submissionQueue.js's "ready to
 * submit" records - a draft is not yet a response and must never be
 * uploaded, so it can never end up mixed into that queue by accident.
 */
function draft_key(form_group_id) {
  return `dcs_draft_${form_group_id}`;
}

export async function save_form_draft(form_group_id, version, data) {
  const draft = { form_group_id, version, data, updated_at: new Date().toISOString() };
  await storage_set(draft_key(form_group_id), draft);
  return draft;
}

export async function get_form_draft(form_group_id) {
  const draft = await storage_get(draft_key(form_group_id));
  return draft || null;
}

export async function clear_form_draft(form_group_id) {
  await storage_del(draft_key(form_group_id));
}

/** A geolocation answer, as GeolocationField stores it. */
export function is_geolocation_value(value) {
  return !!value && typeof value === "object" && value.__map__location__data === true;
}

function is_empty_answer(value) {
  if (value === null || value === undefined || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * The ids of the fields a respondent actually answers: everything except
 * the location (detected on its own), hidden and computed fields and
 * preset defaults, which the engine fills in without anyone typing.
 */
function respondent_field_ids(schema) {
  if (!schema || !Array.isArray(schema.fields)) return null;
  return new Set(
    flatten_fields(schema.fields)
      .filter((field) => field && !AUTO_FILLED_TYPES.includes(field.type) && !(field.computed && field.computed.enabled) && !preset_config(field))
      .map((field) => field.id),
  );
}

/**
 * Whether saved answers are worth offering back: at least one respondent
 * field holds a real answer. A draft holding nothing but the auto-detected
 * position (plus whatever the engine derived from it) was never typed by
 * anyone - and the position will have changed anyway.
 */
export function has_meaningful_answers(data, schema) {
  const ids = respondent_field_ids(schema);
  return Object.entries(data || {}).some(([field_id, value]) => (!ids || ids.has(field_id)) && !is_empty_answer(value) && !is_geolocation_value(value));
}

/**
 * The draft's answers without any stored coordinates: a resumed draft gets
 * a fresh position detected instead of yesterday's.
 */
export function strip_geolocation_values(data) {
  const next = {};
  Object.entries(data || {}).forEach(([field_id, value]) => {
    if (!is_geolocation_value(value)) next[field_id] = value;
  });
  return next;
}
