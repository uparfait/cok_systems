const follow_up_forms_model = require("../../models/follow_up_forms_model.js");
const follow_up_submissions_model = require("../../models/follow_up_submissions_model.js");
const { existing_editor_context } = require("./context.js");
const { validate_submission_data } = require("../../jsonlogic/validate_submission.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { is_valid_object_id } = require("../../utilities/object_id.js");

/**
 * Rewrites one follow-up record's answers from the data table. The merged
 * answers are validated like a submission against the record's own
 * follow-up version (the active one when that version is gone), and the
 * record is stamped updated_at.
 */
async function update_follow_up_submission(req, res) {
  try {
    const context = await existing_editor_context(req, res);
    if (!context) return undefined;
    const { submission_id } = req.params;
    const { data } = req.body || {};
    if (!is_valid_object_id(submission_id)) {
      return res.status(400).json(warning_response(req, "INVALID_ID"));
    }

    const record = await follow_up_submissions_model.find_by_id(submission_id);
    if (!record || record.follow_up_group_id !== context.follow_up_group_id) {
      return res.status(404).json(warning_response(req, "SUBMISSION_NOT_FOUND"));
    }

    const version = (await follow_up_forms_model.get_version(record.follow_up_group_id, record.version)) || context.active;
    if (!version) {
      return res.status(409).json(warning_response(req, "FOLLOW_UP_NO_ACTIVE_VERSION"));
    }

    const incoming = data && typeof data === "object" && !Array.isArray(data) ? data : {};
    const merged = Object.assign({}, record.data || {}, incoming);
    const validation_result = validate_submission_data(version.schema, merged, req.language);
    if (!validation_result.valid) {
      return res.status(422).json(warning_response(req, "SUBMISSION_VALIDATION_FAILED", null, { field_errors: validation_result.field_errors }));
    }

    const updated = await follow_up_submissions_model.update_data(record._id, validation_result.resolved_data);
    return res.status(200).json(success_response(req, "SUBMISSION_UPDATED", updated));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = update_follow_up_submission;
