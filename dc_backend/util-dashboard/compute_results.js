const { sanitize_widgets, sanitize_widget, sanitize_period_override } = require("./sanitize.js");
const { validate_dashboard } = require("./widget_validation.js");
const { compute_widget_data } = require("./widget_data.js");
const { effective_bounds } = require("./match_stage.js");
const { build_field_catalog } = require("./field_catalog.js");
const { kpi_skipped_rows } = require("./kpi_metrics.js");
const { LIMITS } = require("./constants.js");

const DEFAULT_PAGE = 20;
const MAX_PAGE = 50;

function bounded_int(value, fallback, min, max) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/**
 * The data computation shared by the signed-in dashboard and the public
 * share link: every widget of the payload is pinned to THIS form, validated
 * against the form's real schema and aggregated with a native MongoDB
 * pipeline (generated test data included). A broken widget comes back as a
 * per-widget error so one bad chart never takes the whole board down.
 */
async function compute_dashboard_results(body, form_group_id, form_version, project_id) {
  const widgets = sanitize_widgets(body.widgets)
    .slice(0, LIMITS.MAX_WIDGETS)
    .map((widget) => Object.assign(widget, { form_group_id }));
  const period_override = sanitize_period_override(body.period);
  const form_versions = new Map([[form_group_id, form_version]]);

  const results = [];
  for (const widget of widgets) {
    const check = validate_dashboard([widget], form_versions, project_id);
    if (!check.valid) {
      results.push({ widget_id: widget.id, error: "INVALID", messages: check.errors });
      continue;
    }
    try {
      const data = await compute_widget_data(widget, form_version, period_override);
      results.push(Object.assign({ widget_id: widget.id }, data));
    } catch (widget_error) {
      results.push({ widget_id: widget.id, error: "FAILED", messages: [widget_error.message] });
    }
  }
  return results;
}

/**
 * One page of the answers a numeric KPI widget skipped (not readable as
 * numbers) inside its window - shared by both the signed-in and the public
 * dashboard. Returns { invalid: [...] } when the widget itself is invalid.
 */
async function compute_skipped_page(body, form_group_id, form_version, project_id) {
  const widget = sanitize_widget(body.widget);
  if (!widget) return { invalid: ["widget missing"] };
  widget.form_group_id = form_group_id;
  const form_versions = new Map([[form_group_id, form_version]]);
  const check = validate_dashboard([widget], form_versions, project_id);
  if (!check.valid) return { invalid: check.errors };

  const period_override = sanitize_period_override(body.period);
  const bounds = effective_bounds(widget, period_override);
  const catalog = build_field_catalog(form_version.schema);
  const offset = bounded_int(body.offset, 0, 0, Number.MAX_SAFE_INTEGER);
  const limit = bounded_int(body.limit, DEFAULT_PAGE, 1, MAX_PAGE);
  const result = await kpi_skipped_rows(widget, bounds, limit, catalog, offset);
  return { result, offset, limit };
}

module.exports = {
  compute_dashboard_results,
  compute_skipped_page,
};
