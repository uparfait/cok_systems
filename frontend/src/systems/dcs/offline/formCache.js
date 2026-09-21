import { storage_get, storage_set } from "./offlineStorage.js";

const FORM_CACHE_PREFIX = "dcs_form_cache_";

/**
 * Caches a fetched form document locally so the public collection page can
 * keep working fully offline once a form has been opened at least once.
 */
export async function cache_form(form_group_id, form_document) {
  await storage_set(`${FORM_CACHE_PREFIX}${form_group_id}`, form_document);
}

/**
 * Reads a previously cached form document, or null when nothing is cached.
 */
export async function get_cached_form(form_group_id) {
  const cached = await storage_get(`${FORM_CACHE_PREFIX}${form_group_id}`);
  return cached || null;
}
