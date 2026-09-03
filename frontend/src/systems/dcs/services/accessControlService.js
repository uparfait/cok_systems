import { dcs_request } from "./dcsApiClient.js";

/**
 * Fetches a project's access rules (an empty default when never saved).
 */
export function get_project_access(project_id) {
  return dcs_request(`/access-control/project/${project_id}`, "GET");
}

/**
 * Saves who may view a project and which of its forms each grant exposes.
 */
export function save_project_access(project_id, rules) {
  return dcs_request(`/access-control/project/${project_id}`, "PUT", rules);
}

/**
 * Checks that an email belongs to a real account before it can be granted
 * access - resolves with { user_id, email, full_name } or rejects.
 */
export function check_access_email(email) {
  return dcs_request("/access-control/check-email", "POST", { email });
}

/**
 * Suggests existing accounts whose email or name contains the typed text -
 * resolves with a list of { user_id, email, full_name }.
 */
export function suggest_access_users(query) {
  return dcs_request("/access-control/suggest-users", "GET", null, { params: { query } });
}
