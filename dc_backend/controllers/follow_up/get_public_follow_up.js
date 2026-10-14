const forms_model = require("../../models/forms_model.js");
const follow_up_forms_model = require("../../models/follow_up_forms_model.js");
const { strip_lazy_options_from_fields } = require("../../jsonlogic/lazy_options.js");
const { searchable_field_ids } = require("./searchable_fields.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Public, no-auth endpoint behind /dcs-form/follow-up/:id: the follow-up's
 * active version and the fields a respondent may search the actual form's
 * records by (text, number and long text fields of the actual form's
 * ACTIVE version that the follow-up also carries).
 */
async function get_public_follow_up(req, res) {
  try {
    const { follow_up_group_id } = req.params;
    if (!follow_up_group_id) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }

    const active = await follow_up_forms_model.get_active(follow_up_group_id);
    if (!active) {
      const any_version = await follow_up_forms_model.get_latest(follow_up_group_id);
      if (!any_version) {
        return res.status(404).json(warning_response(req, "FORM_PUBLIC_NOT_FOUND"));
      }
      return res.status(409).json(warning_response(req, "FORM_PUBLIC_NO_ACTIVE_VERSION"));
    }

    const source = await forms_model.get_active_version(active.source_form_group_id);
    return res.status(200).json(
      success_response(req, "FORM_FETCHED", {
        follow_up_group_id: active.follow_up_group_id,
        source_form_group_id: active.source_form_group_id,
        form_name: active.form_name,
        version: active.version,
        is_active: active.is_active,
        schema: Object.assign({}, active.schema, { fields: strip_lazy_options_from_fields(active.schema.fields) }),
        ask_respondent: active.ask_respondent !== false,
        searchable_field_ids: source ? searchable_field_ids(source.schema, active.schema) : [],
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_public_follow_up;
