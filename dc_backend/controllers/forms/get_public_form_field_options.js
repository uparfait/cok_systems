const forms_model = require("../../models/forms_model.js");
const { resolve_field_options } = require("../../jsonlogic/lazy_options.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Public, no-auth counterpart of get_form_field_options.js - lets a
 * respondent's browser fetch only the options that belong to whichever
 * parent answer they actually picked (e.g. only the cells belonging to the
 * one sector they selected), instead of the public form payload ever
 * carrying every cell in the country up front.
 */
async function get_public_form_field_options(req, res) {
  try {
    const { form_group_id, field_id } = req.params;
    const has_parent_value = Object.prototype.hasOwnProperty.call(req.query, "parent_value");
    const parent_value = req.query.parent_value;

    if (!form_group_id || !field_id) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }

    const form = await forms_model.get_active_version(form_group_id);
    if (!form) {
      return res.status(404).json(warning_response(req, "FORM_PUBLIC_NOT_FOUND"));
    }

    const resolved = resolve_field_options((form.schema && form.schema.fields) || [], field_id, has_parent_value, parent_value);
    if (!resolved) {
      return res.status(404).json(warning_response(req, "FIELD_NOT_FOUND"));
    }

    return res.status(200).json(success_response(req, "FORM_FETCHED", resolved));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_public_form_field_options;
