const projects_model = require("../../models/projects_model.js");
const project_access = require("../../utilities/project_access.js");
const dashboards_model = require("../dashboards_model.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { is_valid_object_id } = require("../../utilities/object_id.js");

/**
 * Returns the project's saved dashboard configuration (an empty default
 * when none was ever saved) plus whether THIS viewer may edit it. The
 * aggregated data itself is fetched separately through the data endpoint.
 */
async function get_dashboard(req, res) {
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

    const management = await project_access.resolve_form_management(req.user, project);
    const dashboard = await dashboards_model.get_dashboard_by_project(project_id);

    return res.status(200).json(
      success_response(req, "DASHBOARD_FETCHED", {
        widgets: (dashboard && dashboard.widgets) || [],
        updated_at: dashboard ? dashboard.updated_at : null,
        can_edit: management.edit_project === true,
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_dashboard;
