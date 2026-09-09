const projects_model = require("../../models/projects_model.js");
const project_access = require("../../utilities/project_access.js");
const { sanitize_widgets, sanitize_period_override } = require("../sanitize.js");
const { validate_dashboard } = require("../widget_validation.js");
const { compute_widget_data } = require("../widget_data.js");
const { load_form_versions } = require("./save_dashboard.js");
const { LIMITS } = require("../constants.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { is_valid_object_id } = require("../../utilities/object_id.js");

/**
 * Computes the live data of the requested widgets in one round trip - used
 * by the dashboard view and by the builder's preview. Every aggregation
 * runs as a native MongoDB pipeline, always excluding generated test data.
 * A widget on a form this viewer's access does not expose comes back as
 * locked, with no data leaking; a broken widget comes back as a per-widget
 * error so one bad chart never takes the whole dashboard down.
 */
async function dashboard_data(req, res) {
  try {
    const { project_id } = req.params;

    if (!is_valid_object_id(project_id)) {
      return res.status(400).json(warning_response(req, "INVALID_ID"));
    }

    const project = await projects_model.find_project_by_id(project_id);
    if (!project) {
      return res.status(404).json(warning_response(req, "PROJECT_NOT_FOUND"));
    }

    const access = await project_access.resolve_project_access(req.user, project);
    if (!access.can_view) {
      return res.status(403).json(warning_response(req, "ACCESS_DENIED"));
    }

    const body = req.body || {};
    const widgets = sanitize_widgets(body.widgets).slice(0, LIMITS.MAX_WIDGETS);
    const period_override = sanitize_period_override(body.period);
    const form_versions = await load_form_versions(widgets);

    const results = [];
    for (const widget of widgets) {
      if (!project_access.access_allows_form(access, widget.form_group_id)) {
        results.push({ widget_id: widget.id, locked: true });
        continue;
      }
      const form_version = form_versions.get(widget.form_group_id);
      if (!form_version || form_version.project_id !== project_id.toString()) {
        results.push({ widget_id: widget.id, error: "FORM_NOT_FOUND" });
        continue;
      }
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

    return res.status(200).json(success_response(req, "DASHBOARD_DATA_FETCHED", { results }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = dashboard_data;
