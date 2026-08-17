import { dcs_request } from "./dcsApiClient.js";

/**
 * Lists the forms belonging to a project (one entry per form group).
 */
export function get_forms_by_project(project_id) {
  return dcs_request(`/forms/project/${project_id}`, "GET");
}

/**
 * Creates a brand new form (version 1) under a project. form_name is an
 * internal-only label used to tell forms apart when listing them - never
 * shown to a respondent - and must be unique within the project.
 */
export function create_form(project_id, form_name, schema) {
  return dcs_request(`/forms/project/${project_id}`, "POST", { form_name, schema });
}

/**
 * Fetches the latest version of a form for the authenticated builder.
 */
export function get_form(form_group_id) {
  return dcs_request(`/forms/${form_group_id}`, "GET");
}

/**
 * Publishes an edit as a brand new form version. form_name can rename the
 * form (still checked for uniqueness within its project).
 */
export function update_form(form_group_id, form_name, schema) {
  return dcs_request(`/forms/${form_group_id}`, "PUT", { form_name, schema });
}

/**
 * Lists every version of a form.
 */
export function get_form_versions(form_group_id) {
  return dcs_request(`/forms/${form_group_id}/versions`, "GET");
}

/**
 * Marks one version as the active version.
 */
export function set_active_version(form_group_id, version) {
  return dcs_request(`/forms/${form_group_id}/active-version`, "PUT", { version });
}

/**
 * Permanently deletes one specific, non-active version of a form.
 * deleteData also removes every submission collected against it.
 */
export function delete_form_version(form_group_id, version, delete_data) {
  return dcs_request(`/forms/${form_group_id}/versions/${version}`, "DELETE", { delete_data });
}

/**
 * Public, no-auth fetch of a form's active version, used by /dcs-form/:id.
 */
export function get_public_form(form_group_id) {
  return dcs_request(`/public/forms/${form_group_id}`, "GET");
}
