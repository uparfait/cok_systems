import { dcs_request } from "./dcsApiClient.js";

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
