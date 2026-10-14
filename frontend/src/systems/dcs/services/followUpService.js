import { dcs_request } from "./dcsApiClient.js";

/**
 * The follow-up form of one form: its versions, its own public link and
 * its own records (dcs_follow_up_submissions). Authenticated routes hang
 * under /forms/:form_group_id/follow-up, public ones under
 * /public/follow-up-forms/:follow_up_group_id.
 */

function range_params(params, options) {
  if (options && options.period) {
    params.append("period", options.period);
    if (options.period === "custom") {
      if (options.from) params.append("from", options.from);
      if (options.to) params.append("to", options.to);
    }
  }
}

/** { follow_up: active version | null, versions: [...] } */
export function get_follow_up(form_group_id) {
  return dcs_request(`/forms/${form_group_id}/follow-up`, "GET");
}

/** Creates version 1 from the source form's active version (409 when one exists). */
export function create_follow_up(form_group_id) {
  return dcs_request(`/forms/${form_group_id}/follow-up`, "POST", {});
}

/** A new version when the data field set changed, otherwise saved in place. */
export function update_follow_up(form_group_id, form_name, schema, ask_respondent) {
  return dcs_request(`/forms/${form_group_id}/follow-up`, "PUT", { form_name, schema, ask_respondent: ask_respondent !== false });
}

export function set_follow_up_active_version(form_group_id, version) {
  return dcs_request(`/forms/${form_group_id}/follow-up/active-version`, "PUT", { version });
}

export function delete_follow_up_version(form_group_id, version, delete_data) {
  return dcs_request(`/forms/${form_group_id}/follow-up/versions/${version}`, "DELETE", { delete_data });
}

/**
 * One page of follow-up records, the same shape as GET /submissions/:fg.
 * options: { period, from, to, search, sort, record, version }.
 */
export function get_follow_up_submissions(form_group_id, page, limit, options) {
  const params = new URLSearchParams();
  params.append("page", page || 1);
  params.append("limit", limit || 20);
  range_params(params, options);
  if (options && options.search) params.append("search", options.search);
  if (options && options.sort) params.append("sort", options.sort);
  if (options && options.record) params.append("record", options.record);
  if (options && options.version !== undefined && options.version !== null) params.append("version", options.version);
  return dcs_request(`/forms/${form_group_id}/follow-up/submissions?${params.toString()}`, "GET");
}

export function get_follow_up_submission(form_group_id, submission_id) {
  return dcs_request(`/forms/${form_group_id}/follow-up/submissions/${submission_id}`, "GET");
}

export function update_follow_up_submission(form_group_id, submission_id, data) {
  return dcs_request(`/forms/${form_group_id}/follow-up/submissions/${submission_id}`, "PUT", { data });
}

export function delete_selected_follow_up_submissions(form_group_id, submission_ids) {
  return dcs_request(`/forms/${form_group_id}/follow-up/submissions/delete-selected`, "POST", { submission_ids });
}

/** One page of the follow-up gallery, the same shape as /submissions/:fg/media. */
export function get_follow_up_media(form_group_id, page, limit, options) {
  const params = new URLSearchParams();
  params.append("page", page || 1);
  params.append("limit", limit || 10);
  range_params(params, options);
  return dcs_request(`/forms/${form_group_id}/follow-up/media?${params.toString()}`, "GET");
}

/**
 * Public, no-auth read of the active follow-up version:
 * { follow_up_group_id, source_form_group_id, form_name, version, schema,
 *   ask_respondent, searchable_field_ids }.
 */
export function get_public_follow_up_form(follow_up_group_id) {
  return dcs_request(`/public/follow-up-forms/${follow_up_group_id}`, "GET");
}

/** Source form records whose answer to field contains q: { items, page, pages, total }, 20 per page. */
export function search_public_follow_up_records(follow_up_group_id, field, q, page) {
  const params = new URLSearchParams();
  params.append("field", field);
  params.append("q", q);
  params.append("page", page || 1);
  return dcs_request(`/public/follow-up-forms/${follow_up_group_id}/search?${params.toString()}`, "GET");
}

/** One source record { _id, data, submitted_at }. */
export function get_public_follow_up_source_record(follow_up_group_id, submission_id) {
  return dcs_request(`/public/follow-up-forms/${follow_up_group_id}/records/${submission_id}`, "GET");
}

/** payload: { version, data, source_submission_id, client_submission_id, respondent } */
export function submit_public_follow_up(follow_up_group_id, payload) {
  return dcs_request(`/public/follow-up-forms/${follow_up_group_id}/submit`, "POST", payload);
}

/** Where the public follow-up form uploads a media answer (multipart: version, field_id, file). */
export function public_follow_up_upload_endpoint(follow_up_group_id) {
  return `/dcs/api/public/follow-up-forms/${follow_up_group_id}/upload`;
}

export function get_public_follow_up_record(submission_id) {
  return dcs_request(`/public/follow-up-records/${submission_id}`, "GET");
}

export function update_public_follow_up_record(submission_id, payload) {
  return dcs_request(`/public/follow-up-records/${submission_id}`, "PUT", payload);
}

export function follow_up_public_url(follow_up_group_id) {
  return `${window.location.origin}/dcs-form/follow-up/${follow_up_group_id}`;
}
