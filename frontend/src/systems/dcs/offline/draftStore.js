import { get, set, del } from "idb-keyval";

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
  await set(draft_key(form_group_id), draft);
  return draft;
}

export async function get_form_draft(form_group_id) {
  const draft = await get(draft_key(form_group_id));
  return draft || null;
}

export async function clear_form_draft(form_group_id) {
  await del(draft_key(form_group_id));
}
