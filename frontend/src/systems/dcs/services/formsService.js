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
export function create_form(project_id, form_name, schema, approval_config) {
  return dcs_request(`/forms/project/${project_id}`, "POST", { form_name, schema, approval_config });
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
export function update_form(form_group_id, form_name, schema, approval_config) {
  return dcs_request(`/forms/${form_group_id}`, "PUT", { form_name, schema, approval_config });
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
 * Submissions time-series for a form, bucketed server-side into a
 * granularity (hour/day/week/month/year) chosen from the selected period.
 * params: { period: "today"|"this_month"|"this_year"|"custom", from, to }.
 */
export function get_form_submission_stats(form_group_id, params) {
  const search_params = new URLSearchParams(
    Object.fromEntries(Object.entries(params || {}).filter(([, value]) => value !== undefined && value !== null && value !== "")),
  );
  return dcs_request(`/forms/${form_group_id}/stats?${search_params.toString()}`, "GET");
}

/**
 * Searches form names across every project the user has any access to -
 * backs the sidebar's combined project/form search box. Access-filtered
 * entirely on the backend, the same way a single project's form list is.
 */
export function search_forms(query) {
  return dcs_request(`/forms/search?q=${encodeURIComponent(query)}`, "GET");
}

/**
 * Public, no-auth fetch of a form's active version, used by /dcs-form/:id.
 */
export function get_public_form(form_group_id) {
  return dcs_request(`/public/forms/${form_group_id}`, "GET");
}
