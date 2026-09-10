import { dcs_request } from "../services/dcsApiClient.js";

/**
 * Fetches the FORM's saved dashboard configuration plus whether the current
 * viewer may edit it - every form owns its own dashboard.
 */
export function get_dashboard(form_group_id) {
  return dcs_request(`/forms/${form_group_id}/dashboard`, "GET");
}

/**
 * Saves the form's whole dashboard (validated server-side against the
 * form's real schema).
 */
export function save_dashboard(form_group_id, widgets) {
  return dcs_request(`/forms/${form_group_id}/dashboard`, "PUT", { widgets });
}

/**
 * Computes the live aggregated data of the given widgets in one request -
 * also used by the builder's preview with a single draft widget. The
 * optional period overrides every widget's own window.
 */
export function get_dashboard_data(form_group_id, widgets, period) {
  return dcs_request(`/forms/${form_group_id}/dashboard/data`, "POST", { widgets, period: period || null });
}

/**
 * Lists the answers a numeric KPI widget skipped (could not be read as
 * numbers) inside its current window, honoring the same period the
 * dashboard shows: { total, rows: [{submitted_at, raw}] }.
 */
export function get_kpi_skipped(form_group_id, widget, period) {
  return dcs_request(`/forms/${form_group_id}/dashboard/kpi-skipped`, "POST", { widget, period: period || null });
}
