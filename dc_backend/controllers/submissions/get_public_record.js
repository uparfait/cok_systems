const forms_model = require("../../models/forms_model.js");
const submissions_model = require("../../models/submissions_model.js");
const tracked_records_model = require("../../models/tracked_records_model.js");
const { strip_lazy_options_from_fields } = require("../../jsonlogic/lazy_options.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { is_valid_object_id } = require("../../utilities/object_id.js");
const { is_enabled } = require("../../utilities/tracking.js");

/**
 * Public, no-auth read of ONE collected record together with the form
 * version it was collected against - what /dcs-form/edit/:id opens. The
 * record's OWN version is returned, not the form's current active one, so
 * the page that comes up is the very page the answers were given on and
 * every stored answer still has a field to sit in.
 *
 * A tracked record also carries its value periods and its history, so the
 * editor can look at what the record held on a chosen date before
 * changing it.
 */
async function get_public_record(req, res) {
  try {
    const { submission_id } = req.params;

    if (!is_valid_object_id(submission_id)) {
      return res.status(400).json(warning_response(req, "INVALID_ID"));
    }

    const submission = await submissions_model.find_submission_by_id(submission_id);
    if (!submission) {
      return res.status(404).json(warning_response(req, "SUBMISSION_NOT_FOUND"));
    }

    const form_version =
      (await forms_model.get_version_document(submission.form_group_id, submission.version)) ||
      (await forms_model.get_active_version(submission.form_group_id));
    if (!form_version) {
      return res.status(404).json(warning_response(req, "FORM_PUBLIC_NOT_FOUND"));
    }

    // Exactly what the public renderer is given elsewhere: the schema and
    // the version identity, never the approval flow or the author.
    const form = {
      form_group_id: form_version.form_group_id,
      form_name: form_version.form_name,
      version: form_version.version,
      is_active: form_version.is_active,
      schema: Object.assign({}, form_version.schema, { fields: strip_lazy_options_from_fields(form_version.schema.fields) }),
      tracking: form_version.tracking || null,
      ask_respondent: form_version.ask_respondent !== false,
    };

    const record = tracked_records_model.to_public_record(submission);
    record.respondent = submission.respondent || null;
    record.is_tracked = is_enabled(form_version.tracking);

    return res.status(200).json(success_response(req, "SUBMISSION_FETCHED", { form, record }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_public_record;
