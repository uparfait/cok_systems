const follow_up_submissions_model = require("../../models/follow_up_submissions_model.js");
const { existing_editor_context } = require("./context.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { is_valid_object_id } = require("../../utilities/object_id.js");

const MAX_PER_REQUEST = 500;

/**
 * Permanently deletes the follow-up records the table has ticked. Only
 * records of THIS form's follow-up are touched - an id from anywhere else
 * is simply left alone - and only form editors may do it.
 */
async function delete_follow_up_submissions(req, res) {
  try {
    const context = await existing_editor_context(req, res);
    if (!context) return undefined;
    const { submission_ids } = req.body || {};

    if (!Array.isArray(submission_ids) || submission_ids.length === 0 || submission_ids.length > MAX_PER_REQUEST) {
      return res.status(400).json(warning_response(req, "VALIDATION_FAILED"));
    }
    if (submission_ids.some((id) => !is_valid_object_id(id))) {
      return res.status(400).json(warning_response(req, "INVALID_ID"));
    }

    const records = await follow_up_submissions_model.find_by_ids(submission_ids);
    const own = records.filter((record) => record.follow_up_group_id === context.follow_up_group_id);
    if (own.length === 0) {
      return res.status(404).json(warning_response(req, "SUBMISSION_NOT_FOUND"));
    }

    const deleted_count = await follow_up_submissions_model.delete_by_ids(own.map((record) => record._id));
    return res.status(200).json(success_response(req, "SUBMISSIONS_DELETED", { deleted_count }, { count: deleted_count }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = delete_follow_up_submissions;
