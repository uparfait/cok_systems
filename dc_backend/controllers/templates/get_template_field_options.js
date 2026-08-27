const templates_model = require("../../models/templates_model.js");
const { resolve_field_options } = require("../../jsonlogic/lazy_options.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { is_valid_object_id } = require("../../utilities/object_id.js");

/**
 * Template counterpart of get_form_field_options.js - resolves the real
 * option content for one select_group/cascading_select field of a saved
 * template, deferred out of the template's own payload whenever it carries
 * more than the lazy threshold (see lazy_options.js).
 */
async function get_template_field_options(req, res) {
  try {
    const { template_id, field_id } = req.params;
    const has_parent_value = Object.prototype.hasOwnProperty.call(req.query, "parent_value");
    const parent_value = req.query.parent_value;

    if (!is_valid_object_id(template_id) || !field_id) {
      return res.status(400).json(warning_response(req, "INVALID_ID"));
    }

    const template = await templates_model.get_template_by_id(template_id);
    if (!template) {
      return res.status(404).json(warning_response(req, "TEMPLATE_NOT_FOUND"));
    }

    const resolved = resolve_field_options(template.fields || [], field_id, has_parent_value, parent_value);
    if (!resolved) {
      return res.status(404).json(warning_response(req, "FIELD_NOT_FOUND"));
    }

    return res.status(200).json(success_response(req, "TEMPLATE_FETCHED", resolved));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_template_field_options;
