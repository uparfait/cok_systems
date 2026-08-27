import { dcs_request } from "./dcsApiClient.js";

/**
 * Lists every saved field template (name and description only) - backs the
 * templates list page and the "insert template" picker.
 */
export function get_templates() {
  return dcs_request("/templates", "GET");
}

/**
 * Fetches one template's document, including its fields. By default any
 * huge select_group/cascading_select field comes back lazily-stripped (see
 * dc_backend/jsonlogic/lazy_options.js) - fine for opening it in the
 * template editor, where each such field's real data is only ever loaded
 * once its own settings are opened. Pass { full: true } instead when the
 * fields are about to be cloned into a form or another template (see
 * AddComponentPanel.jsx) - cloning makes an independent copy on the spot,
 * so it always needs the complete, real data up front.
 */
export function get_template(template_id, options) {
  const query = options && options.full ? "?full=true" : "";
  return dcs_request(`/templates/${template_id}${query}`, "GET");
}

/**
 * Resolves the real option content for one lazily-loaded select_group/
 * cascading_select field of a saved template - omit parent_value to fetch
 * the field's complete data (used when an author opens its settings), or
 * pass the currently selected parent answer to fetch only the options that
 * actually belong to it (used by a rehearsal/review preview).
 */
export function get_template_field_options(template_id, field_id, parent_value) {
  const query = parent_value === undefined ? "" : `?parent_value=${encodeURIComponent(parent_value)}`;
  return dcs_request(`/templates/${template_id}/field-options/${field_id}${query}`, "GET");
}

/**
 * Creates a new field template.
 */
export function create_template(name, description, fields) {
  return dcs_request("/templates", "POST", { name, description, fields });
}

/**
 * Updates a template's name, description and/or fields.
 */
export function update_template(template_id, name, description, fields) {
  return dcs_request(`/templates/${template_id}`, "PUT", { name, description, fields });
}

/**
 * Permanently deletes a template. Never affects a form that already
 * inserted it earlier.
 */
export function delete_template(template_id) {
  return dcs_request(`/templates/${template_id}`, "DELETE");
}
