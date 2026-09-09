const projects_model = require("../../models/projects_model.js");
const users_model = require("../../models/users_model.js");
const { strip_creator } = require("../../utilities/owner.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { is_valid_object_id } = require("../../utilities/object_id.js");

/**
 * Hands a project over to another employee. Only the current owner may
 * transfer it, and the new owner must be an existing account of the main
 * system - after the handover the previous owner keeps only whatever the
 * project's access rules grant them.
 */
async function transfer_project_ownership(req, res) {
  try {
    const { project_id } = req.params;
    const { user_id } = req.body || {};

    if (!is_valid_object_id(project_id)) {
      return res.status(400).json(warning_response(req, "INVALID_ID"));
    }

    const project = await projects_model.find_project_by_id(project_id);
    if (!project) {
      return res.status(404).json(warning_response(req, "PROJECT_NOT_FOUND"));
    }

    if (project.created_by !== req.user.user_id.toString()) {
      return res.status(403).json(warning_response(req, "OWNER_TRANSFER_FORBIDDEN"));
    }

    const new_owner = await users_model.find_user_by_id(user_id);
    if (!new_owner) {
      return res.status(400).json(warning_response(req, "OWNER_USER_NOT_FOUND"));
    }

    const updated_project = await projects_model.update_project(project_id, {
      created_by: new_owner.user_id,
      created_by_name: new_owner.full_name,
    });

    return res.status(200).json(
      success_response(
        req,
        "PROJECT_OWNER_TRANSFERRED",
        Object.assign({}, strip_creator(updated_project), { owner_name: new_owner.full_name }),
      ),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = transfer_project_ownership;
