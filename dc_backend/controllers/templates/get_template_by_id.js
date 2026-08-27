const templates_model = require("../../models/templates_model.js");
const { strip_lazy_options_from_fields } = require("../../jsonlogic/lazy_options.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { is_valid_object_id } = require("../../utilities/object_id.js");

/**
 * Returns one template's document, including its fields - used both to open
 * it for editing (lazy fields stripped down to a marker, see
 * lazy_options.js - each is fetched back on demand as its own settings are
 * opened) and, with ?full=true, to fetch it completely real/unstripped for
 * cloning its fields into another form or template (the only way a
 * template's data ever leaves this document, so it must be whole).
 */
async function get_template_by_id(req, res) {
  try {
    const { template_id } = req.params;
    const wants_full = req.query.full === "true" || req.query.full === "1";

    if (!is_valid_object_id(template_id)) {
      return res.status(400).json(warning_response(req, "INVALID_ID"));
    }

    const template = await templates_model.get_template_by_id(template_id);
    if (!template) {
      return res.status(404).json(warning_response(req, "TEMPLATE_NOT_FOUND"));
    }

    const response_template = wants_full
      ? template
      : Object.assign({}, template, { fields: strip_lazy_options_from_fields(template.fields) });

    return res.status(200).json(success_response(req, "TEMPLATE_FETCHED", response_template));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_template_by_id;
