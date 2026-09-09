const projects_model = require("../../models/projects_model.js");
const { strip_creator } = require("../../utilities/owner.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Creates a new data collection project. Departments are not stored on the
 * project itself - who may see it is managed entirely by its access-control
 * rules, so a fresh project starts visible to its creator alone.
 */
async function create_project(req, res) {
  try {
    const { name, description = "" } = req.body || {};

    if (!name || !name.toString().trim()) {
      return res.status(400).json(warning_response(req, "PROJECT_NAME_REQUIRED"));
    }

    const project = await projects_model.create_project({
      name: name.toString().trim(),
      description: description ? description.toString().trim() : "",
      access_control_enabled: false,
      dashboard_enabled: false,
      created_by: req.user.user_id.toString(),
      created_by_name: req.user.full_name,
    });

    return res.status(201).json(success_response(req, "PROJECT_CREATED", strip_creator(project)));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = create_project;
