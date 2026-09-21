import { dcs_request } from "./dcsApiClient.js";

/**
 * Data-feed tokens: a form editor creates one, and any external tool
 * (Power BI, Excel, a script) reads the responses through its URL without
 * signing in. Tokens expire on a date or never, can be scoped to a version
 * and a date window, and can be renewed (new secret) or revoked.
 */
export function list_data_tokens(form_group_id) {
  return dcs_request(`/forms/${form_group_id}/data-tokens`, "GET");
}

export function create_data_token(form_group_id, fields) {
  return dcs_request(`/forms/${form_group_id}/data-tokens`, "POST", fields);
}

export function rotate_data_token(form_group_id, token_id) {
  return dcs_request(`/forms/${form_group_id}/data-tokens/${token_id}/rotate`, "POST");
}

export function delete_data_token(form_group_id, token_id) {
  return dcs_request(`/forms/${form_group_id}/data-tokens/${token_id}`, "DELETE");
}

/** The public feed URL a tool pastes: JSON pages by default, one CSV with format=csv. */
export function data_feed_url(token, format) {
  const base = `${window.location.origin}/dcs/api/public/data-feed/${token}`;
  return format === "csv" ? `${base}?format=csv` : format === "schema" ? `${base}/schema` : base;
}
