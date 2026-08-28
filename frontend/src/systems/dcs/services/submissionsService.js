import { dcs_request } from "./dcsApiClient.js";

/**
 * Fetches ALL collected submissions for a form (no pagination) within an
 * optional date range - backs the Excel export feature. Returns the raw
 * submission records so the caller can build the spreadsheet.
 */
export function export_submissions(form_group_id, period, from, to) {
  const params = new URLSearchParams();
  if (period && period !== "all") {
    params.append("period", period);
    if (period === "custom") {
      if (from) params.append("from", from);
      if (to) params.append("to", to);
    }
  }
  const query = params.toString();
  return dcs_request(`/submissions/export/${form_group_id}${query ? "?" + query : ""}`, "GET");
}

/**
 * Paginated, authenticated list of collected submissions for a form,
 * optionally scoped to a single version, a date range, a free-text search
 * (matched against every string/number field value within that range) and
 * a sort direction (newest/oldest). Leaving version out returns
 * submissions across every version of the form.
 */
export function get_submissions(form_group_id, version, page, limit, options) {
  const params = new URLSearchParams();
  if (version !== undefined && version !== null) params.append("version", version);
  params.append("page", page || 1);
  params.append("limit", limit || 20);
  if (options && options.period) {
    params.append("period", options.period);
    if (options.period === "custom") {
      if (options.from) params.append("from", options.from);
      if (options.to) params.append("to", options.to);
    }
  }
  if (options && options.search) params.append("search", options.search);
  if (options && options.sort) params.append("sort", options.sort);
  return dcs_request(`/submissions/${form_group_id}?${params.toString()}`, "GET");
}

/**
 * Public, no-auth submission of a response. The server re-validates
 * everything against the exact version submitted.
 */
export function submit_response(form_group_id, payload) {
  return dcs_request(`/public/forms/${form_group_id}/submit`, "POST", payload);
}

/**
 * Permanently deletes one specific collected response. Irreversible.
 */
export function delete_submission(submission_id) {
  return dcs_request(`/submissions/record/${submission_id}`, "DELETE");
}
