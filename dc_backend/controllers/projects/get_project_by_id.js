const projects_model = require("../../models/projects_model.js");
const project_access = require("../../utilities/project_access.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { is_valid_object_id } = require("../../utilities/object_id.js");

/**
 * Returns a single project's details, used by the project settings page.
 */
async function get_project_by_id(req, res) {
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

    // Tells the frontend which tabs and form actions to show this viewer.
    const viewer_can_manage_access = await project_access.can_manage_access(req.user, project);
    const viewer_form_permissions = await project_access.resolve_form_management(req.user, project);

    return res
      .status(200)
      .json(
        success_response(
          req,
          "PROJECT_FETCHED",
          Object.assign({}, project, { viewer_can_manage_access, viewer_form_permissions }),
        ),
      );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_project_by_id;
