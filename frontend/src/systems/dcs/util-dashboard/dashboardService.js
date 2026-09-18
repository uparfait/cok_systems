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

/**
 * Saves one dashboard's whole widget list (validated server-side against
 * the form's real schema) and, when they are given, its board filter
 * fields and its layout; callers that only touch widgets leave both as
 * they are.
 */
export function save_dashboard(scope, widgets, filters, layout) {
  const body = { widgets };
  if (Array.isArray(filters)) body.filters = filters;
  // How the board is arranged - the grid, or studio with every widget
  // placed by hand - rides along when the caller changed it.
  if (layout) body.layout = layout;
  return dcs_request(dashboard_path(scope), "PUT", body);
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
export function get_dashboard_data(form_group_id, widgets, period, filters) {
  return dcs_request(`/forms/${form_group_id}/dashboard/data`, "POST", { widgets, period: period || null, filters: filters || [] });
}

/**
 * The paged records behind one widget: its own filters, the board's period
 * and filters, and what was clicked (pick). body: { widget, period, filters, pick, page, limit }.
 */
/**
 * The boundary outlines a map widget draws: only the places it has data
 * for, by name, plus their parents and the country outline.
 */
export function get_map_shapes(form_group_id, names, parents, held) {
  const known = held || {};
  return dcs_request(`/forms/${form_group_id}/dashboard/map-shapes`, "POST", { names: names || [], parents: parents || [], have: known.have || [], have_level: known.have_level || "" });
}

export function get_widget_records(form_group_id, body) {
  return dcs_request(`/forms/${form_group_id}/dashboard/records`, "POST", body);
}

/**
 * Downloads the records behind a widget as Excel. The file is built on the
 * server and streamed back with its length, so on_progress (0-100) tracks
 * the real download. Resolves { blob, filename }.
 */
export function export_widget_records(form_group_id, body, on_progress) {
  return download_records(`/dcs/api/forms/${form_group_id}/dashboard/records/export`, body, on_progress, true);
}

export function export_public_widget_records(token, body, on_progress) {
  return download_records(`/dcs/api/public/dashboard/${token}/records/export`, body, on_progress, false);
}

function download_records(url, body, on_progress, authenticated) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.responseType = "blob";
    xhr.setRequestHeader("Content-Type", "application/json");
    if (authenticated) {
      const token = window.localStorage.getItem("accessToken");
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("X-Language", window.localStorage.getItem("dcs_language") || "en");
    } else {
      xhr.setRequestHeader("X-Language", "en");
    }
    xhr.onprogress = (event) => {
      if (event.lengthComputable && on_progress) on_progress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const disposition = xhr.getResponseHeader("Content-Disposition") || "";
        const match = disposition.match(/filename="?([^"]+)"?/);
        resolve({ blob: xhr.response, filename: match ? match[1] : "records.xlsx" });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const json = JSON.parse(reader.result);
          reject(new Error(json.message || `Export failed (${xhr.status})`));
        } catch {
          reject(new Error(`Export failed (${xhr.status})`));
        }
      };
      reader.onerror = () => reject(new Error(`Export failed (${xhr.status})`));
      reader.readAsText(xhr.response);
    };
    xhr.onerror = () => reject(new Error("Network error during export"));
    xhr.send(JSON.stringify(body || {}));
  });
}

/**
 * The values one board filter field can take right now: the distinct
 * answers under the period and the other applied filters, with counts.
 */
export function get_filter_values(form_group_id, field_id, filters, period) {
  return dcs_request(`/forms/${form_group_id}/dashboard/filter-values`, "POST", { field_id, filters: filters || [], period: period || null });
}

/**
 * Lists the answers a numeric KPI widget skipped (could not be read as
 * numbers) inside its current window, honoring the same period the
 * dashboard shows: { total, rows: [{submitted_at, raw}] }.
 */
export function get_kpi_skipped(form_group_id, widget, period, offset, limit, filters) {
  return dcs_request(`/forms/${form_group_id}/dashboard/kpi-skipped`, "POST", { widget, period: period || null, offset: offset || 0, limit: limit || 20, filters: filters || [] });
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

// A link may open several dashboards; dashboard_id says which one a request
// is about (left out: the link's own).
const with_dashboard = (body, dashboard_id) => (dashboard_id ? Object.assign({}, body, { dashboard_id }) : body);

export function get_public_dashboard(token, dashboard_id) {
  const query = dashboard_id ? `?dashboard_id=${encodeURIComponent(dashboard_id)}` : "";
  return dcs_request(`/public/dashboard/${token}${query}`, "GET", undefined, PUBLIC_CONFIG);
}

export function get_public_dashboard_data(token, widgets, period, filters, dashboard_id) {
  return dcs_request(`/public/dashboard/${token}/data`, "POST", with_dashboard({ widgets, period: period || null, filters: filters || [] }, dashboard_id), PUBLIC_CONFIG);
}

export function get_public_kpi_skipped(token, widget, period, offset, limit, filters, dashboard_id) {
  return dcs_request(`/public/dashboard/${token}/kpi-skipped`, "POST", with_dashboard({ widget, period: period || null, offset: offset || 0, limit: limit || 20, filters: filters || [] }, dashboard_id), PUBLIC_CONFIG);
}

export function get_public_widget_records(token, body) {
  return dcs_request(`/public/dashboard/${token}/records`, "POST", body, PUBLIC_CONFIG);
}

export function get_public_map_shapes(token, names, parents, held) {
  const known = held || {};
  return dcs_request(`/public/dashboard/${token}/map-shapes`, "POST", { names: names || [], parents: parents || [], have: known.have || [], have_level: known.have_level || "" }, PUBLIC_CONFIG);
}

export function get_public_filter_values(token, field_id, filters, period, dashboard_id) {
  return dcs_request(`/public/dashboard/${token}/filter-values`, "POST", with_dashboard({ field_id, filters: filters || [], period: period || null }, dashboard_id), PUBLIC_CONFIG);
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
