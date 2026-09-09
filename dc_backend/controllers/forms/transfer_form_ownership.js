const forms_model = require("../../models/forms_model.js");
const projects_model = require("../../models/projects_model.js");
const users_model = require("../../models/users_model.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Hands a form (all of its versions at once) over to another employee. The
 * form's current owner or the owner of the project it lives in may transfer
 * it, and the new owner must be an existing account of the main system.
 */
async function transfer_form_ownership(req, res) {
  try {
    const { form_group_id } = req.params;
    const { user_id } = req.body || {};

    if (!form_group_id) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }

    const form = await forms_model.get_latest_version(form_group_id);
    if (!form) {
      return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    }

    const requester_id = req.user.user_id.toString();
    const owns_form = await forms_model.is_form_group_created_by(form_group_id, requester_id);
    const project = await projects_model.find_project_by_id(form.project_id);
    const owns_project = !!project && project.created_by === requester_id;
    if (!owns_form && !owns_project) {
      return res.status(403).json(warning_response(req, "OWNER_TRANSFER_FORBIDDEN"));
    }

    const new_owner = await users_model.find_user_by_id(user_id);
    if (!new_owner) {
      return res.status(400).json(warning_response(req, "OWNER_USER_NOT_FOUND"));
    }

    await forms_model.set_form_owner(form_group_id, new_owner);

    return res.status(200).json(
      success_response(req, "FORM_OWNER_TRANSFERRED", {
        form_group_id,
        owner_name: new_owner.full_name,
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = transfer_form_ownership;
