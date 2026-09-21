import { get_public_form_field_options } from "../services/formsService.js";
import { cache_form } from "./formCache.js";

/**
 * Every field anywhere in the schema (recursing into group/section
 * children) still marked lazy_options - see dc_backend/jsonlogic/
 * lazy_options.js - i.e. one whose real options this device has never
 * actually fetched yet.
 */
function collect_lazy_field_ids(fields, accumulator) {
  const ids = accumulator || [];
  (fields || []).forEach((field) => {
    if (!field) return;
    if (field.lazy_options) ids.push(field.id);
    if ((field.type === "group" || field.type === "section") && Array.isArray(field.children)) {
      collect_lazy_field_ids(field.children, ids);
    }
  });
  return ids;
}

/**
 * Splices each lazy field's now-fully-resolved data (keyed by field id) back
 * into the schema, dropping the lazy_options marker - used to turn the
 * lazily-loaded schema this page started with into the complete one it
 * hands to the offline cache.
 */
function apply_full_field_data(fields, data_by_id) {
  return (fields || []).map((field) => {
    if (!field) return field;
    if ((field.type === "group" || field.type === "section") && Array.isArray(field.children)) {
      return Object.assign({}, field, { children: apply_full_field_data(field.children, data_by_id) });
    }
    if (field.lazy_options && data_by_id.has(field.id)) {
      return Object.assign({}, field, data_by_id.get(field.id), { lazy_options: undefined, options_count: undefined });
    }
    return field;
  });
}

/**
 * Best-effort background warm-up: fully resolves every lazy field's real
 * options and re-caches the whole form with them filled in, so a session
 * that goes offline after this finishes - or one that never had a live
 * connection to begin with, on a device that already loaded this form once
 * before - still has everything available, never stuck on a field this
 * device has never actually fetched. Fires immediately after a successful
 * online load without blocking it; a failure here (e.g. going offline right
 * away) just means this device's offline copy stays lazy for now, exactly
 * as any offline-first cache already behaves before its first full sync.
 */
export async function warm_offline_cache(form_group_id, loaded_form) {
  const lazy_field_ids = collect_lazy_field_ids(loaded_form.schema.fields);
  if (lazy_field_ids.length === 0) return;
  try {
    const resolved_entries = await Promise.all(
      lazy_field_ids.map((field_id) =>
        get_public_form_field_options(form_group_id, field_id).then((response) => [field_id, response.data]),
      ),
    );
    const data_by_id = new Map(resolved_entries);
    const full_fields = apply_full_field_data(loaded_form.schema.fields, data_by_id);
    await cache_form(
      form_group_id,
      Object.assign({}, loaded_form, { schema: Object.assign({}, loaded_form.schema, { fields: full_fields }) }),
    );
  } catch (warm_error) {
    console.error(warm_error);
  }
}
