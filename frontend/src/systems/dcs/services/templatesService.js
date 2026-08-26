import { dcs_request } from "./dcsApiClient.js";

/**
 * Lists every saved field template (name and description only) - backs the
 * templates list page and the "insert template" picker.
 */
export function get_templates() {
  return dcs_request("/templates", "GET");
}

/**
 * Fetches one template's full document, including its fields.
 */
export function get_template(template_id) {
  return dcs_request(`/templates/${template_id}`, "GET");
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
