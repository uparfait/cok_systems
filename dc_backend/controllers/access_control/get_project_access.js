const projects_model = require("../../models/projects_model.js");
const project_access_model = require("../../models/project_access_model.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { is_valid_object_id } = require("../../utilities/object_id.js");

/**
 * Returns a project's saved access rules, or an empty default when none
 * have been saved yet, for the access-control tab to edit.
 */
async function get_project_access(req, res) {
  try {
    const { project_id } = req.params;

    if (!is_valid_object_id(project_id)) {
      return res.status(400).json(warning_response(req, "INVALID_ID"));
    }

    const project = await projects_model.find_project_by_id(project_id);
    if (!project) {
      return res.status(404).json(warning_response(req, "PROJECT_NOT_FOUND"));
    }

    const access = await project_access_model.get_access_by_project(project_id);
    const rules = access || { project_id, enabled: false, departments: [], individuals: [] };

    return res.status(200).json(success_response(req, "ACCESS_RULES_FETCHED", rules));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_project_access;
