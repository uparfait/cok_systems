const projects_model = require("../../models/projects_model.js");
const forms_model = require("../../models/forms_model.js");
const submissions_model = require("../../models/submissions_model.js");
const project_access_model = require("../../models/project_access_model.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { is_valid_object_id } = require("../../utilities/object_id.js");

/**
 * Permanently deletes a project along with every form (all versions) and
 * every submission collected under it. Irreversible - there is no
 * soft-delete or recovery.
 */
async function delete_project(req, res) {
  try {
    const { project_id } = req.params;

    if (!is_valid_object_id(project_id)) {
      return res.status(400).json(warning_response(req, "INVALID_ID"));
    }

    const existing_project = await projects_model.find_project_by_id(project_id);
    if (!existing_project) {
      return res.status(404).json(warning_response(req, "PROJECT_NOT_FOUND"));
    }

    const form_group_ids = await forms_model.get_form_group_ids_by_project(project_id);
    await submissions_model.delete_by_form_group_ids(form_group_ids);
    await forms_model.delete_forms_by_project(project_id);
    await project_access_model.delete_access_by_project(project_id);
    await projects_model.delete_project(project_id);

    return res.status(200).json(success_response(req, "PROJECT_DELETED"));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = delete_project;
