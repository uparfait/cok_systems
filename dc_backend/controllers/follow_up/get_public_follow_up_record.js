const follow_up_forms_model = require("../../models/follow_up_forms_model.js");
const follow_up_submissions_model = require("../../models/follow_up_submissions_model.js");
const { strip_lazy_options_from_fields } = require("../../jsonlogic/lazy_options.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { is_valid_object_id } = require("../../utilities/object_id.js");

/** The follow-up version as the public editor renders it: schema and identity, never the author. */
function public_form_of(version) {
  return {
    follow_up_group_id: version.follow_up_group_id,
    source_form_group_id: version.source_form_group_id,
    form_name: version.form_name,
    version: version.version,
    is_active: version.is_active,
    schema: Object.assign({}, version.schema, { fields: strip_lazy_options_from_fields(version.schema.fields) }),
    ask_respondent: version.ask_respondent !== false,
  };
}

/** The record as the public editor receives it. */
function public_record_of(record) {
  return {
    _id: record._id,
    version: record.version,
    source_submission_id: record.source_submission_id || null,
    submitted_at: record.submitted_at,
    updated_at: record.updated_at || null,
    data: record.data || {},
    respondent: record.respondent || null,
  };
}

/**
 * Public, no-auth read of ONE follow-up record with the follow-up version
 * it was collected against - what /dcs-form/follow-up/edit/:id opens. The
 * record's OWN version is returned (the active one only when that version
 * is gone), so every stored answer still has a field to sit in.
 */
async function get_public_follow_up_record(req, res) {
  try {
    const { submission_id } = req.params;
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

    return res.status(200).json(success_response(req, "SUBMISSION_FETCHED", { form: public_form_of(version), record: public_record_of(record) }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_public_follow_up_record;
module.exports.public_record_of = public_record_of;
