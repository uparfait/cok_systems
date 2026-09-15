const { load_form_dashboard_context } = require("../form_context.js");
const { sanitize_widget, sanitize_period_override } = require("../sanitize.js");
const { validate_dashboard } = require("../widget_validation.js");
const { effective_bounds } = require("../match_stage.js");
const { build_field_catalog } = require("../field_catalog.js");
const { kpi_skipped_rows } = require("../kpi_metrics.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

const DEFAULT_PAGE = 20;
const MAX_PAGE = 50;

function bounded_int(value, fallback, min, max) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/**
 * Lists, in full detail, the answers a numeric KPI widget SKIPPED inside
 * its current window - answers that could not be read as numbers (free text
 * typed into what the formula needs as a number). Returns one page (offset
 * + limit, 20 by default, newest first) of when each record was submitted
 * and exactly what was entered, plus the true total and whether more
 * pages follow, honoring the same period the dashboard is showing.
 */
async function kpi_skipped(req, res) {
  try {
    const { form_group_id } = req.params;

    if (!form_group_id) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }

    const context = await load_form_dashboard_context(req.user, form_group_id);
    if (!context.found) {
      return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    }
    if (!context.allowed) {
      return res.status(403).json(warning_response(req, "ACCESS_DENIED"));
    }

    const body = req.body || {};
    const widget = sanitize_widget(body.widget);
    if (!widget) {
      return res.status(400).json(warning_response(req, "DASHBOARD_INVALID"));
    }
    widget.form_group_id = form_group_id;

    const form_versions = new Map([[form_group_id, context.form_version]]);
    const check = validate_dashboard([widget], form_versions, context.project._id);
    if (!check.valid) {
      return res.status(400).json(warning_response(req, "DASHBOARD_INVALID", null, { errors: check.errors }));
    }

    const period_override = sanitize_period_override(body.period);
    const bounds = effective_bounds(widget, period_override);
    const catalog = build_field_catalog(context.form_version.schema);
    const offset = bounded_int(body.offset, 0, 0, Number.MAX_SAFE_INTEGER);
    const limit = bounded_int(body.limit, DEFAULT_PAGE, 1, MAX_PAGE);
    const result = await kpi_skipped_rows(widget, bounds, limit, catalog, offset);

    return res.status(200).json(
      success_response(req, "DASHBOARD_SKIPPED_FETCHED", {
        total: result.total,
        rows: result.rows,
        offset,
        limit,
        has_more: offset + result.rows.length < result.total,
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = kpi_skipped;
