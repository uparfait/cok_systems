const submissions_model = require("../../models/submissions_model.js");
const projects_model = require("../../models/projects_model.js");
const project_access = require("../../utilities/project_access.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { is_valid_object_id } = require("../../utilities/object_id.js");

/**
 * Permanently deletes one specific collected response. Irreversible - the
 * requesting user must hold edit access on the form it belongs to.
 */
async function delete_submission(req, res) {
  try {
    const { submission_id } = req.params;

    if (!is_valid_object_id(submission_id)) {
      return res.status(400).json(warning_response(req, "INVALID_ID"));
    }

    const submission = await submissions_model.find_submission_by_id(submission_id);
    if (!submission) {
      return res.status(404).json(warning_response(req, "SUBMISSION_NOT_FOUND"));
    }

    const project = await projects_model.find_project_by_id(submission.project_id);
    const management = await project_access.resolve_form_management(req.user, project, submission.form_group_id);
    if (!management.edit_forms) {
      return res.status(403).json(warning_response(req, "FORM_ACTION_FORBIDDEN"));
    }

    await submissions_model.delete_submission_by_id(submission_id);

    return res.status(200).json(success_response(req, "SUBMISSION_DELETED"));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = delete_submission;
