const follow_up_forms_model = require("../../models/follow_up_forms_model.js");
const submissions_model = require("../../models/submissions_model.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { is_valid_object_id } = require("../../utilities/object_id.js");

/**
 * Public, no-auth read of ONE record of the actual form, as the follow-up
 * page loads it into the form: its answers and when it was submitted.
 * Only a record of the follow-up's own source form is ever returned.
 */
async function get_follow_up_source_record(req, res) {
  try {
    const { follow_up_group_id, submission_id } = req.params;
    if (!follow_up_group_id) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }
    if (!is_valid_object_id(submission_id)) {
      return res.status(400).json(warning_response(req, "INVALID_ID"));
    }

    const follow_up = await follow_up_forms_model.get_latest(follow_up_group_id);
    if (!follow_up) {
      return res.status(404).json(warning_response(req, "FORM_PUBLIC_NOT_FOUND"));
    }

    const record = await submissions_model.find_submission_by_id(submission_id);
    if (!record || record.form_group_id !== follow_up.source_form_group_id) {
      return res.status(404).json(warning_response(req, "SUBMISSION_NOT_FOUND"));
    }

    const data = Object.assign({}, record.data || {});
    delete data[submissions_model.TEST_DATA_FLAG];
    return res.status(200).json(success_response(req, "SUBMISSION_FETCHED", { _id: record._id, data, submitted_at: record.submitted_at }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_follow_up_source_record;
