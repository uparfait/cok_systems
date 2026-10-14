const follow_up_forms_model = require("../../models/follow_up_forms_model.js");
const follow_up_submissions_model = require("../../models/follow_up_submissions_model.js");
const submissions_model = require("../../models/submissions_model.js");
const { validate_submission_data } = require("../../jsonlogic/validate_submission.js");
const { sanitize_respondent } = require("../../utilities/respondent.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { is_valid_object_id, to_object_id } = require("../../utilities/object_id.js");

/**
 * Public, no-auth submission of a follow-up record. The answers are
 * re-validated against the exact follow-up version the page fetched, with
 * the same rules as the browser. The record is stored as a NEW record of
 * the follow-up, remembering which record of the actual form it was
 * loaded from (source_submission_id, null when none was) - that record
 * itself is never changed. An offline retry carrying the same
 * client_submission_id gets the record already stored.
 */
async function submit_follow_up(req, res) {
  try {
    const { follow_up_group_id } = req.params;
    const { version, data, source_submission_id, client_submission_id, respondent } = req.body || {};

    if (!follow_up_group_id || version === undefined || version === null) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }

    if (client_submission_id) {
      const existing = await follow_up_submissions_model.find_by_client_submission_id(client_submission_id);
      if (existing) {
        return res.status(200).json(success_response(req, "SUBMISSION_CREATED", existing));
      }
    }

    const follow_up = await follow_up_forms_model.get_version(follow_up_group_id, version);
    if (!follow_up) {
      return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    }

    const validation_result = validate_submission_data(follow_up.schema, data || {}, req.language);
    if (!validation_result.valid) {
      return res.status(422).json(warning_response(req, "SUBMISSION_VALIDATION_FAILED", null, { field_errors: validation_result.field_errors }));
    }

    // The actual record this one follows up on: it has to exist and belong
    // to the follow-up's own source form.
    let source_id = null;
    if (source_submission_id !== undefined && source_submission_id !== null && source_submission_id !== "") {
      if (!is_valid_object_id(source_submission_id)) {
        return res.status(400).json(warning_response(req, "INVALID_ID"));
      }
      const source_record = await submissions_model.find_submission_by_id(source_submission_id);
      if (!source_record || source_record.form_group_id !== follow_up.source_form_group_id) {
        return res.status(404).json(warning_response(req, "SUBMISSION_NOT_FOUND"));
      }
      source_id = to_object_id(source_submission_id);
    }

    const submission = await follow_up_submissions_model.create({
      follow_up_group_id,
      version: Number(version),
      source_form_group_id: follow_up.source_form_group_id,
      source_submission_id: source_id,
      project_id: follow_up.project_id,
      data: validation_result.resolved_data,
      submitted_at: new Date(),
      updated_at: null,
      respondent: sanitize_respondent(respondent),
      client_submission_id: client_submission_id || null,
    });

    return res.status(201).json(success_response(req, "SUBMISSION_CREATED", submission));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = submit_follow_up;
