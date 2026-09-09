const { load_form_dashboard_context } = require("../form_context.js");
const { sanitize_widgets, sanitize_period_override } = require("../sanitize.js");
const { validate_dashboard } = require("../widget_validation.js");
const { compute_widget_data } = require("../widget_data.js");
const { LIMITS } = require("../constants.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Computes the live data of the requested widgets of ONE form in a single
 * round trip - used by the dashboard view. Every aggregation runs as a
 * native MongoDB pipeline over everything the form holds (generated test
 * data included, same as the submissions chart), and every widget is pinned
 * to this form no matter what the payload claims. A broken widget comes
 * back as a per-widget error so one bad chart never takes the whole
 * dashboard down.
 */
async function dashboard_data(req, res) {
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
    const widgets = sanitize_widgets(body.widgets)
      .slice(0, LIMITS.MAX_WIDGETS)
      .map((widget) => Object.assign(widget, { form_group_id }));
    const period_override = sanitize_period_override(body.period);
    const form_versions = new Map([[form_group_id, context.form_version]]);

    const results = [];
    for (const widget of widgets) {
      const check = validate_dashboard([widget], form_versions, context.project._id);
      if (!check.valid) {
        results.push({ widget_id: widget.id, error: "INVALID", messages: check.errors });
        continue;
      }
      try {
        const data = await compute_widget_data(widget, context.form_version, period_override);
        results.push(Object.assign({ widget_id: widget.id }, data));
      } catch (widget_error) {
        results.push({ widget_id: widget.id, error: "FAILED", messages: [widget_error.message] });
      }
    }

    return res.status(200).json(success_response(req, "DASHBOARD_DATA_FETCHED", { results }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = dashboard_data;
