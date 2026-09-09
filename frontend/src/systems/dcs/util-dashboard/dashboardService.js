import { dcs_request } from "../services/dcsApiClient.js";

/**
 * Fetches the project's saved dashboard configuration plus whether the
 * current viewer may edit it.
 */
export function get_dashboard(project_id) {
  return dcs_request(`/projects/${project_id}/dashboard`, "GET");
}

/**
 * Saves the whole dashboard (validated server-side against the real form
 * schemas).
 */
export function save_dashboard(project_id, widgets) {
  return dcs_request(`/projects/${project_id}/dashboard`, "PUT", { widgets });
}

/**
 * Computes the live aggregated data of the given widgets in one request -
 * also used by the builder's preview with a single draft widget. The
 * optional period overrides every widget's own window.
 */
export function get_dashboard_data(project_id, widgets, period) {
  return dcs_request(`/projects/${project_id}/dashboard/data`, "POST", { widgets, period: period || null });
}
