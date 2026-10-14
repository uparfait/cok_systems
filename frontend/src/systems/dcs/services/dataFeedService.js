import { dcs_request } from "./dcsApiClient.js";
import { viewer_zone } from "./viewerZone.js";

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

/**
 * The public feed URL a tool pastes: JSON pages by default, one CSV with
 * format=csv. The zone of whoever made the link rides along, so the feed's
 * date window is read in their day rather than the server's.
 */
export function data_feed_url(token, format) {
  const base = `${window.location.origin}/dcs/api/public/data-feed/${token}`;
  if (format === "schema") return `${base}/schema`;
  const zone = `tz=${encodeURIComponent(viewer_zone())}`;
  return format === "csv" ? `${base}?format=csv&${zone}` : `${base}?${zone}`;
}
