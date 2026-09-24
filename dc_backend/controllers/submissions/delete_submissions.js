const submissions_model = require("../../models/submissions_model.js");
const projects_model = require("../../models/projects_model.js");
const project_access = require("../../utilities/project_access.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { is_valid_object_id } = require("../../utilities/object_id.js");

const MAX_PER_REQUEST = 500;

/**
 * Permanently deletes the records the data table currently has ticked.
 * Irreversible. Every id is resolved first and each distinct form behind
 * them is permission-checked once, so a selection spanning versions (or,
 * through a shared table, more than one form) can never delete a single
 * row the requesting user may not manage.
 */
async function delete_submissions(req, res) {
  try {
    const { submission_ids } = req.body || {};

    if (!Array.isArray(submission_ids) || submission_ids.length === 0) {
      return res.status(400).json(warning_response(req, "VALIDATION_FAILED"));
    }
    if (submission_ids.length > MAX_PER_REQUEST) {
      return res.status(400).json(warning_response(req, "VALIDATION_FAILED"));
    }
    if (submission_ids.some((id) => !is_valid_object_id(id))) {
      return res.status(400).json(warning_response(req, "INVALID_ID"));
    }

    const submissions = await submissions_model.find_submissions_by_ids(submission_ids);
    if (submissions.length === 0) {
      return res.status(404).json(warning_response(req, "SUBMISSION_NOT_FOUND"));
    }

    // One permission answer per form, not per row.
    const by_form = new Map();
    submissions.forEach((submission) => {
      if (!by_form.has(submission.form_group_id)) by_form.set(submission.form_group_id, submission.project_id);
    });
    for (const [form_group_id, project_id] of by_form) {
      const project = await projects_model.find_project_by_id(project_id);
      const management = await project_access.resolve_form_management(req.user, project, form_group_id);
      if (!management.edit_forms) {
        return res.status(403).json(warning_response(req, "FORM_ACTION_FORBIDDEN"));
      }
    }

    const deleted_count = await submissions_model.delete_submissions_by_ids(submissions.map((submission) => submission._id));
    return res.status(200).json(success_response(req, "SUBMISSIONS_DELETED", { deleted_count }, { count: deleted_count }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = delete_submissions;
