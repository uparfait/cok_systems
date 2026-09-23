const forms_model = require("../../models/forms_model.js");
const tracked_records_model = require("../../models/tracked_records_model.js");
const { is_enabled, record_key_of } = require("../../utilities/tracking.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Public, no-auth lookup of a tracked form's records by their key: the
 * respondent types the key next to the key field and every record holding
 * it comes back, newest first, each with its answers, its dates and its
 * whole change history. Anyone with the form link may search, exactly as
 * anyone may fill the form in.
 */
async function search_public_records(req, res) {
  try {
    const { form_group_id } = req.params;
    const key = record_key_of((req.query || {}).key);

    if (!form_group_id) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }
    if (!key) {
      return res.status(400).json(warning_response(req, "TRACKING_KEY_REQUIRED"));
    }

    const active_form = await forms_model.get_active_version(form_group_id);
    if (!active_form) {
      return res.status(404).json(warning_response(req, "FORM_PUBLIC_NOT_FOUND"));
    }
    if (!is_enabled(active_form.tracking)) {
      return res.status(400).json(warning_response(req, "TRACKING_NOT_ENABLED"));
    }

    const records = await tracked_records_model.list_by_record_key(form_group_id, key);
    return res.status(200).json(
      success_response(req, "TRACKING_RECORDS_FETCHED", {
        key,
        key_field_id: active_form.tracking.key_field_id,
        editable_field_ids: active_form.tracking.editable_field_ids || [],
        records: records.map((record) => tracked_records_model.to_public_record(record)),
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = search_public_records;
