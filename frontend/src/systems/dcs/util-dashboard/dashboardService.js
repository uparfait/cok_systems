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
export function get_kpi_skipped(form_group_id, widget, period, offset, limit) {
  return dcs_request(`/forms/${form_group_id}/dashboard/kpi-skipped`, "POST", { widget, period: period || null, offset: offset || 0, limit: limit || 20 });
}

/** The form dashboard's public share links (form editors only). */
export function list_dashboard_links(form_group_id) {
  return dcs_request(`/forms/${form_group_id}/dashboard/links`, "GET");
}

export function create_dashboard_link(form_group_id, link) {
  return dcs_request(`/forms/${form_group_id}/dashboard/links`, "POST", link);
}

export function update_dashboard_link(form_group_id, link_id, link) {
  return dcs_request(`/forms/${form_group_id}/dashboard/links/${link_id}`, "PATCH", link);
}

export function delete_dashboard_link(form_group_id, link_id) {
  return dcs_request(`/forms/${form_group_id}/dashboard/links/${link_id}`, "DELETE");
}

/** The URL a share link opens - the public, read-only dashboard page. */
export function public_dashboard_url(token) {
  return `${window.location.origin}/dcs-dashboard/${token}`;
}

/**
 * The public, read-only dashboard behind a share token: no sign-in, the
 * same data endpoints shape as the signed-in board, nothing writable.
 */
export function get_public_dashboard(token) {
  return dcs_request(`/public/dashboard/${token}`, "GET");
}

export function get_public_dashboard_data(token, widgets, period) {
  return dcs_request(`/public/dashboard/${token}/data`, "POST", { widgets, period: period || null });
}

export function get_public_kpi_skipped(token, widget, period, offset, limit) {
  return dcs_request(`/public/dashboard/${token}/kpi-skipped`, "POST", { widget, period: period || null, offset: offset || 0, limit: limit || 20 });
}

/**
 * The human-readable reason a dashboard request failed: the server's own
 * translated message plus the first concrete violation when the response
 * carries them - never a bare generic toast when the server said more.
 */
export function request_error_text(error, fallback) {
  if (!error) return fallback;
  const detail = Array.isArray(error.errors) && error.errors.length > 0 ? ` (${error.errors[0]})` : "";
  return `${error.message || fallback}${detail}`;
}
