const { load_form_dashboard_context } = require("../form_context.js");
const { compute_widget_records } = require("../widget_records.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * The paged records behind one widget (see widget_records.js), for anyone
 * allowed to see the form's data: the widget, the board's period and
 * filters, and what was clicked come in the body.
 */
async function widget_records(req, res) {
  try {
    const { form_group_id } = req.params;
    if (!form_group_id) return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    const context = await load_form_dashboard_context(req.user, form_group_id);
    if (!context.found) return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    if (!context.allowed) return res.status(403).json(warning_response(req, "ACCESS_DENIED"));
    const result = await compute_widget_records(req.body || {}, form_group_id, context.form_version, context.project._id);
    if (result.invalid) return res.status(400).json(warning_response(req, "DASHBOARD_INVALID", null, { errors: result.invalid }));
    return res.status(200).json(success_response(req, "DASHBOARD_RECORDS_FETCHED", result));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = widget_records;
