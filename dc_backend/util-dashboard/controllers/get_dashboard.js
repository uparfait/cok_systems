const dashboards_model = require("../dashboards_model.js");
const { load_form_dashboard_context } = require("../form_context.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Returns the FORM's saved dashboard configuration (an empty default when
 * none was ever saved) plus whether THIS viewer may edit it. The aggregated
 * data itself is fetched separately through the data endpoint.
 */
async function get_dashboard(req, res) {
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

    const dashboard = await dashboards_model.get_dashboard_by_form(form_group_id);

    return res.status(200).json(
      success_response(req, "DASHBOARD_FETCHED", {
        widgets: (dashboard && dashboard.widgets) || [],
        updated_at: dashboard ? dashboard.updated_at : null,
        can_edit: context.can_edit,
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_dashboard;
