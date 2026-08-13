const projects_model = require("../../models/projects_model.js");
const { success_response, error_response } = require("../../utilities/response.js");

/**
 * Lists every project for the sidebar and the projects landing page.
 */
async function get_projects(req, res) {
  try {
    const projects = await projects_model.list_projects();
    return res.status(200).json(success_response(req, "PROJECTS_FETCHED", projects));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_projects;
