const projects_model = require("../../models/projects_model.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { is_valid_object_id } = require("../../utilities/object_id.js");

const EDITABLE_FIELDS = ["name", "description", "department_id", "department_name", "department_unit_id", "department_unit_name"];

/**
 * Updates a project's details (name, description, department assignment).
 * Access-control and dashboard flags stay read-only here - those sections
 * are still under development.
 */
async function update_project(req, res) {
  try {
    const { project_id } = req.params;

    if (!is_valid_object_id(project_id)) {
      return res.status(400).json(warning_response(req, "INVALID_ID"));
    }

    const existing_project = await projects_model.find_project_by_id(project_id);
    if (!existing_project) {
      return res.status(404).json(warning_response(req, "PROJECT_NOT_FOUND"));
    }

    if (req.body.name !== undefined && !req.body.name.toString().trim()) {
      return res.status(400).json(warning_response(req, "PROJECT_NAME_REQUIRED"));
    }

    const updates = {};
    EDITABLE_FIELDS.forEach((field_name) => {
      if (req.body[field_name] !== undefined) updates[field_name] = req.body[field_name];
    });

    const updated_project = await projects_model.update_project(project_id, updates);
    return res.status(200).json(success_response(req, "PROJECT_UPDATED", updated_project));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = update_project;
