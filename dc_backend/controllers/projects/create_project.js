const projects_model = require("../../models/projects_model.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Creates a new data collection project. Department and department unit are
 * optional - a project can exist without being tied to any department.
 */
async function create_project(req, res) {
  try {
    const {
      name,
      description = "",
      department_id = null,
      department_name = null,
      department_unit_id = null,
      department_unit_name = null,
    } = req.body || {};

    if (!name || !name.toString().trim()) {
      return res.status(400).json(warning_response(req, "PROJECT_NAME_REQUIRED"));
    }

    const project = await projects_model.create_project({
      name: name.toString().trim(),
      description: description ? description.toString().trim() : "",
      department_id,
      department_name,
      department_unit_id,
      department_unit_name,
      access_control_enabled: false,
      dashboard_enabled: false,
      created_by: req.user.user_id.toString(),
      created_by_name: req.user.full_name,
    });

    return res.status(201).json(success_response(req, "PROJECT_CREATED", project));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = create_project;
