const follow_up_forms_model = require("../../models/follow_up_forms_model.js");
const follow_up_submissions_model = require("../../models/follow_up_submissions_model.js");
const { validate_submission_data } = require("../../jsonlogic/validate_submission.js");
const { sanitize_respondent } = require("../../utilities/respondent.js");
const { public_record_of } = require("./get_public_follow_up_record.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { is_valid_object_id } = require("../../utilities/object_id.js");

/**
 * Public, no-auth full edit of ONE follow-up record - what the edit page
 * saves. Every field may change; the merged answers are re-validated
 * against the record's own follow-up version (the active one when that
 * version is gone) and the record is stamped updated_at. The actual
 * form's record the follow-up was loaded from is never touched.
 */
async function update_public_follow_up_record(req, res) {
  try {
    const { submission_id } = req.params;
    const { data, respondent } = req.body || {};
    if (!is_valid_object_id(submission_id)) {
      return res.status(400).json(warning_response(req, "INVALID_ID"));
    }

    const record = await follow_up_submissions_model.find_by_id(submission_id);
    if (!record) {
      return res.status(404).json(warning_response(req, "SUBMISSION_NOT_FOUND"));
    }

    const version =
      (await follow_up_forms_model.get_version(record.follow_up_group_id, record.version)) ||
      (await follow_up_forms_model.get_active(record.follow_up_group_id));
    if (!version) {
      return res.status(404).json(warning_response(req, "FORM_PUBLIC_NOT_FOUND"));
    }

    const incoming = data && typeof data === "object" && !Array.isArray(data) ? data : {};
    const merged = Object.assign({}, record.data || {}, incoming);
    const validation_result = validate_submission_data(version.schema, merged, req.language);
    if (!validation_result.valid) {
      return res.status(422).json(warning_response(req, "SUBMISSION_VALIDATION_FAILED", null, { field_errors: validation_result.field_errors }));
    }

    const by = sanitize_respondent(respondent) || record.respondent || null;
    const updated = await follow_up_submissions_model.update_data(record._id, validation_result.resolved_data, by);
    return res.status(200).json(success_response(req, "SUBMISSION_UPDATED", public_record_of(updated)));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = update_public_follow_up_record;
