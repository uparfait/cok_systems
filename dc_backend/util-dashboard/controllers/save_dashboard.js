const dashboards_model = require("../dashboards_model.js");
const { load_form_dashboard_context } = require("../form_context.js");
const { sanitize_widgets } = require("../sanitize.js");
const { validate_dashboard } = require("../widget_validation.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Saves the FORM's whole dashboard in one document. Only users allowed to
 * edit this form may save; every widget is stripped to known keys, pinned
 * to this very form (whatever form id a client claims) and re-validated
 * against the form's real schema before anything is stored.
 */
async function save_dashboard(req, res) {
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
    if (!context.can_edit) {
      return res.status(403).json(warning_response(req, "DASHBOARD_EDIT_FORBIDDEN"));
    }

    const widgets = sanitize_widgets((req.body || {}).widgets).map((widget) => Object.assign(widget, { form_group_id }));
    const form_versions = new Map([[form_group_id, context.form_version]]);
    const check = validate_dashboard(widgets, form_versions, context.project._id);
    if (!check.valid) {
      return res.status(400).json(warning_response(req, "DASHBOARD_INVALID", { errors: check.errors }));
    }

    const saved = await dashboards_model.save_dashboard(form_group_id, context.project._id, widgets);
    return res.status(200).json(
      success_response(req, "DASHBOARD_SAVED", {
        widgets: saved.widgets,
        updated_at: saved.updated_at,
        can_edit: true,
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = save_dashboard;
