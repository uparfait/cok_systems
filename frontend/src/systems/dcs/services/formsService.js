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
 * Hands the form (all versions) over to another employee - form owner or
 * project owner only.
 */
export function transfer_form_ownership(form_group_id, user_id) {
  return dcs_request(`/forms/${form_group_id}/owner`, "PUT", { user_id });
}

/**
 * Lists every version of a form.
 */
export function get_form_versions(form_group_id) {
  return dcs_request(`/forms/${form_group_id}/versions`, "GET");
}

/**
 * One page of the active version's approval-flow approvers - every
 * form-returning route strips the (possibly huge) approvers array, so the
 * approval page assembles it through this endpoint page by page, 20 at a
 * time, incrementing the page until total is reached.
 */
export function get_form_approvers(form_group_id, page, limit, group_fields) {
  const filter_query =
    Array.isArray(group_fields) && group_fields.length > 0 ? `&group_fields=${encodeURIComponent(group_fields.join(","))}` : "";
  return dcs_request(`/forms/${form_group_id}/approvers?page=${page || 1}&limit=${limit || 20}${filter_query}`, "GET");
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

/**
 * Resolves the real option content for one lazily-loaded select_group/
 * cascading_select field of a form's active version (see
 * dc_backend/jsonlogic/lazy_options.js) - omit parent_value to fetch the
 * field's complete data (used when an author opens its settings), or pass
 * the currently selected parent answer to fetch only the options that
 * actually belong to it.
 */
export function get_form_field_options(form_group_id, field_id, parent_value) {
  const query = parent_value === undefined ? "" : `?parent_value=${encodeURIComponent(parent_value)}`;
  return dcs_request(`/forms/${form_group_id}/field-options/${field_id}${query}`, "GET");
}

/**
 * Public, no-auth counterpart of get_form_field_options, used by the live
 * respondent-facing renderer.
 */
export function get_public_form_field_options(form_group_id, field_id, parent_value) {
  const query = parent_value === undefined ? "" : `?parent_value=${encodeURIComponent(parent_value)}`;
  return dcs_request(`/public/forms/${form_group_id}/field-options/${field_id}${query}`, "GET");
}

/**
 * Translation links: a form editor hands one to a translator, who opens the
 * whole form - hidden fields included - and rewrites its texts in every
 * language, except the kinds the link locks. The public side needs no
 * sign-in; the token is the whole authorization.
 */
export function list_translation_links(form_group_id) {
  return dcs_request(`/forms/${form_group_id}/translation-links`, "GET");
}

export function create_translation_link(form_group_id, link) {
  return dcs_request(`/forms/${form_group_id}/translation-links`, "POST", link);
}

export function delete_translation_link(form_group_id, link_id) {
  return dcs_request(`/forms/${form_group_id}/translation-links/${link_id}`, "DELETE");
}

export function translation_link_url(token) {
  return `${window.location.origin}/dcs-translate/${token}`;
}

export function get_public_translation(token) {
  return dcs_request(`/public/translate/${token}`, "GET");
}

export function save_public_translation(token, changes) {
  return dcs_request(`/public/translate/${token}`, "PUT", { changes });
}

export function list_translation_proposals(form_group_id, link_id) {
  return dcs_request(`/forms/${form_group_id}/translation-links/${link_id}/proposals`, "GET");
}

export function apply_translation_proposals(form_group_id, link_id, ids) {
  return dcs_request(`/forms/${form_group_id}/translation-links/${link_id}/proposals/apply`, "POST", { ids });
}

export function restore_translation_proposals(form_group_id, link_id, ids) {
  return dcs_request(`/forms/${form_group_id}/translation-links/${link_id}/proposals/restore`, "POST", { ids });
}

export function dismiss_translation_proposals(form_group_id, link_id, ids) {
  return dcs_request(`/forms/${form_group_id}/translation-links/${link_id}/proposals/dismiss`, "POST", { ids });
}
