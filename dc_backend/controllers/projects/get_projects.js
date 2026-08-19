const projects_model = require("../../models/projects_model.js");
const project_access = require("../../utilities/project_access.js");
const { success_response, error_response } = require("../../utilities/response.js");

/**
 * Lists the projects the requesting user may see, for the sidebar and the
 * projects landing page - restricted projects are filtered out here.
 */
async function get_projects(req, res) {
  try {
    const projects = await projects_model.list_projects();
    const visible_projects = await project_access.filter_projects_for_user(req.user, projects);
    return res.status(200).json(success_response(req, "PROJECTS_FETCHED", visible_projects));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_projects;
