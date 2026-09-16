import { dcs_request } from "../services/dcsApiClient.js";

/**
 * Where a dashboard read or save goes. A form holds any number of NAMED
 * dashboards: a form object carrying dashboard_id means exactly that one;
 * a bare form id (or a form object without dashboard_id) means the form's
 * first dashboard through the older single-board route.
 */
function dashboard_path(scope) {
  const form_group_id = typeof scope === "string" ? scope : scope.form_group_id;
  const dashboard_id = typeof scope === "string" ? "" : scope.dashboard_id || "";
  return dashboard_id ? `/forms/${form_group_id}/dashboards/${dashboard_id}` : `/forms/${form_group_id}/dashboard`;
}

/** One dashboard's saved widgets plus whether the current viewer may edit it. */
export function get_dashboard(scope) {
  return dcs_request(dashboard_path(scope), "GET");
}

/** Saves one dashboard's whole widget list (validated server-side against the form's real schema). */
export function save_dashboard(scope, widgets) {
  return dcs_request(dashboard_path(scope), "PUT", { widgets });
}

/** The form's named dashboards: { dashboards: [{id, name, widgets_count}], can_edit }. */
export function list_dashboards(form_group_id) {
  return dcs_request(`/forms/${form_group_id}/dashboards`, "GET");
}

export function create_dashboard(form_group_id, name) {
  return dcs_request(`/forms/${form_group_id}/dashboards`, "POST", { name });
}

export function rename_dashboard(form_group_id, dashboard_id, name) {
  return dcs_request(`/forms/${form_group_id}/dashboards/${dashboard_id}`, "PATCH", { name });
}

/** Deletes one dashboard together with its share links. */
export function delete_dashboard(form_group_id, dashboard_id) {
  return dcs_request(`/forms/${form_group_id}/dashboards/${dashboard_id}`, "DELETE");
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

/** The public share links of ONE dashboard (form editors only); all of the form's when no dashboard id is given. */
export function list_dashboard_links(form_group_id, dashboard_id) {
  const query = dashboard_id ? `?dashboard_id=${encodeURIComponent(dashboard_id)}` : "";
  return dcs_request(`/forms/${form_group_id}/dashboard/links${query}`, "GET");
}

/** Creates a link to the dashboard named by link.dashboard_id. */
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
  return `${window.location.origin}/XdP/${token}`;
}

/**
 * The public, read-only dashboard behind a share token: no sign-in, the
 * same data endpoints shape as the signed-in board, nothing writable. The
 * shared page carries no language control, so every server message it can
 * show (an expired or unknown link) is asked for in English.
 */
const PUBLIC_CONFIG = { headers: { "X-Language": "en" } };

export function get_public_dashboard(token) {
  return dcs_request(`/public/dashboard/${token}`, "GET", undefined, PUBLIC_CONFIG);
}

export function get_public_dashboard_data(token, widgets, period) {
  return dcs_request(`/public/dashboard/${token}/data`, "POST", { widgets, period: period || null }, PUBLIC_CONFIG);
}

export function get_public_kpi_skipped(token, widget, period, offset, limit) {
  return dcs_request(`/public/dashboard/${token}/kpi-skipped`, "POST", { widget, period: period || null, offset: offset || 0, limit: limit || 20 }, PUBLIC_CONFIG);
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
