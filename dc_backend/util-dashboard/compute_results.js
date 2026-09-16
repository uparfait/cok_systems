const { get_db } = require("../db_connection/db.js");
const { sanitize_widgets, sanitize_widget, sanitize_period_override } = require("./sanitize.js");
const { validate_dashboard } = require("./widget_validation.js");
const { compute_widget_data } = require("./widget_data.js");
const { effective_bounds, build_match_stage } = require("./match_stage.js");
const { build_field_catalog, is_multi_value } = require("./field_catalog.js");
const { kpi_skipped_rows } = require("./kpi_metrics.js");
const { sanitize_applied_filters, merge_applied, apply_board_filters, FILTER_FIELD_TYPES, MAX_FILTER_VALUES } = require("./board_filters.js");
const { LIMITS } = require("./constants.js");

const DEFAULT_PAGE = 20;
const MAX_PAGE = 50;

function bounded_int(value, fallback, min, max) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/**
 * The board filters a request runs under: what the viewer applied, with a
 * share link's locked values (when given) always winning field by field.
 */
function applied_filters(body, forced_filters) {
  return merge_applied(sanitize_applied_filters(body.filters), forced_filters || []);
}

/**
 * The data computation shared by the signed-in dashboard and the public
 * share link: every widget of the payload is pinned to THIS form, validated
 * against the form's real schema, reshaped by the board's applied filters
 * (see board_filters.js) and aggregated with a native MongoDB pipeline
 * (generated test data included). A broken widget comes back as a
 * per-widget error so one bad chart never takes the whole board down.
 */
async function compute_dashboard_results(body, form_group_id, form_version, project_id, forced_filters) {
  const widgets = sanitize_widgets(body.widgets)
    .slice(0, LIMITS.MAX_WIDGETS)
    .map((widget) => Object.assign(widget, { form_group_id }));
  const period_override = sanitize_period_override(body.period);
  const filters = applied_filters(body, forced_filters);
  const form_versions = new Map([[form_group_id, form_version]]);
  const catalog = build_field_catalog(form_version.schema);

  const results = [];
  for (const widget of widgets) {
    const check = validate_dashboard([widget], form_versions, project_id);
    if (!check.valid) {
      results.push({ widget_id: widget.id, error: "INVALID", messages: check.errors });
      continue;
    }
    try {
      const shaped = apply_board_filters(widget, filters, catalog);
      const data = await compute_widget_data(shaped.widget, form_version, period_override);
      results.push(Object.assign({ widget_id: widget.id, board_context: shaped.context }, data));
    } catch (widget_error) {
      results.push({ widget_id: widget.id, error: "FAILED", messages: [widget_error.message] });
    }
  }
  return results;
}

/**
 * One page of the answers a numeric KPI widget skipped (not readable as
 * numbers) inside its window, under the same board filters the card shows -
 * shared by both the signed-in and the public dashboard. Returns
 * { invalid: [...] } when the widget itself is invalid.
 */
async function compute_skipped_page(body, form_group_id, form_version, project_id, forced_filters) {
  const widget = sanitize_widget(body.widget);
  if (!widget) return { invalid: ["widget missing"] };
  widget.form_group_id = form_group_id;
  const form_versions = new Map([[form_group_id, form_version]]);
  const check = validate_dashboard([widget], form_versions, project_id);
  if (!check.valid) return { invalid: check.errors };

  const period_override = sanitize_period_override(body.period);
  const catalog = build_field_catalog(form_version.schema);
  const shaped = apply_board_filters(widget, applied_filters(body, forced_filters), catalog).widget;
  const bounds = effective_bounds(shaped, period_override);
  const offset = bounded_int(body.offset, 0, 0, Number.MAX_SAFE_INTEGER);
  const limit = bounded_int(body.limit, DEFAULT_PAGE, 1, MAX_PAGE);
  const result = await kpi_skipped_rows(shaped, bounds, limit, catalog, offset);
  return { result, offset, limit };
}

/**
 * The values a filter field can take right now: the distinct answers stored
 * for it across the form's records inside the period and under the OTHER
 * applied filters - so a sector filter under a chosen district only lists
 * that district's sectors. Returns { invalid: "..." } for a field that
 * cannot filter.
 */
async function compute_filter_values(body, form_group_id, form_version, forced_filters) {
  const field_id = typeof body.field_id === "string" ? body.field_id.trim() : "";
  const catalog = build_field_catalog(form_version.schema);
  const field = catalog.fields_by_id.get(field_id);
  if (!field || !FILTER_FIELD_TYPES.includes(field.type)) return { invalid: "not a filter field" };
  const period_override = sanitize_period_override(body.period);
  const others = applied_filters(body, forced_filters).filter((entry) => entry.field_id !== field_id);
  const probe = { form_group_id, filters: others.map((entry) => ({ field_id: entry.field_id, operator: "eq", value: entry.value })) };
  const bounds = effective_bounds(probe, period_override);
  const pipeline = [
    build_match_stage(probe, bounds),
    ...(is_multi_value(catalog, field_id) ? [{ $unwind: { path: `$data.${field_id}`, preserveNullAndEmptyArrays: false } }] : []),
    { $match: { [`data.${field_id}`]: { $nin: [null, ""] } } },
    { $group: { _id: `$data.${field_id}`, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $limit: MAX_FILTER_VALUES },
  ];
  const rows = await get_db().collection("dcs_submissions").aggregate(pipeline).toArray();
  return { values: rows.map((row) => ({ value: row._id, count: row.count })) };
}

module.exports = {
  compute_dashboard_results,
  compute_skipped_page,
  compute_filter_values,
};
