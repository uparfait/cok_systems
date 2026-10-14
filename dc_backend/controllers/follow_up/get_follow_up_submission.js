const follow_up_submissions_model = require("../../models/follow_up_submissions_model.js");
const { existing_viewer_context } = require("./context.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { is_valid_object_id } = require("../../utilities/object_id.js");

/**
 * One follow-up record, with the id of the actual record it was loaded
 * from (source_submission_id, null when it was filled in from scratch).
 */
async function get_follow_up_submission(req, res) {
  try {
    const context = await existing_viewer_context(req, res);
    if (!context) return undefined;
    const { submission_id } = req.params;
    if (!is_valid_object_id(submission_id)) {
      return res.status(400).json(warning_response(req, "INVALID_ID"));
    }
    const record = await follow_up_submissions_model.find_by_id(submission_id);
    if (!record || record.follow_up_group_id !== context.follow_up_group_id) {
      return res.status(404).json(warning_response(req, "SUBMISSION_NOT_FOUND"));
    }
    return res.status(200).json(success_response(req, "SUBMISSION_FETCHED", record));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_follow_up_submission;
