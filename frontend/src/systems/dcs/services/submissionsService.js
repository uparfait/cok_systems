import { dcs_request } from "./dcsApiClient.js";

/**
 * Paginated, authenticated list of collected submissions for a form,
 * optionally scoped to a single version and/or a date range. Leaving
 * version out returns submissions across every version of the form.
 */
export function get_submissions(form_group_id, version, page, limit, date_range) {
  const params = new URLSearchParams();
  if (version !== undefined && version !== null) params.append("version", version);
  params.append("page", page || 1);
  params.append("limit", limit || 20);
  if (date_range && date_range.period) {
    params.append("period", date_range.period);
    if (date_range.period === "custom") {
      if (date_range.from) params.append("from", date_range.from);
      if (date_range.to) params.append("to", date_range.to);
    }
  }
  return dcs_request(`/submissions/${form_group_id}?${params.toString()}`, "GET");
}

/**
 * Public, no-auth submission of a response. The server re-validates
 * everything against the exact version submitted.
 */
export function submit_response(form_group_id, payload) {
  return dcs_request(`/public/forms/${form_group_id}/submit`, "POST", payload);
}
