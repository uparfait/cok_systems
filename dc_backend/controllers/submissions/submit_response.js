const forms_model = require("../../models/forms_model.js");
const submissions_model = require("../../models/submissions_model.js");
const { validate_submission_data } = require("../../jsonlogic/validate_submission.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Public, no-auth submission endpoint. Re-validates the payload against the
 * exact form version the client originally fetched, using the same
 * JSONLogic rules as the browser, so tampered or offline-stale submissions
 * can never bypass validation.
 */
async function submit_response(req, res) {
  try {
    const { form_group_id } = req.params;
    const { version, data, client_submission_id } = req.body || {};

    if (!form_group_id || version === undefined || version === null) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }

    if (client_submission_id) {
      const existing_submission = await submissions_model.find_by_client_submission_id(client_submission_id);
      if (existing_submission) {
        return res.status(200).json(success_response(req, "SUBMISSION_CREATED", existing_submission));
      }
    }

    const form_version = await forms_model.get_version_document(form_group_id, version);
    if (!form_version) {
      return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    }

    const validation_result = validate_submission_data(form_version.schema, data || {}, req.language);
    if (!validation_result.valid) {
      return res.status(422).json(
        warning_response(req, "SUBMISSION_VALIDATION_FAILED", null, { field_errors: validation_result.field_errors }),
      );
    }

    const submission = await submissions_model.create_submission({
      form_group_id,
      version: Number(version),
      project_id: form_version.project_id,
      data: validation_result.resolved_data,
      client_submission_id: client_submission_id || null,
    });

    return res.status(201).json(success_response(req, "SUBMISSION_CREATED", submission));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = submit_response;
