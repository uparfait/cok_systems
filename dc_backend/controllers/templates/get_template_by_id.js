const templates_model = require("../../models/templates_model.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { is_valid_object_id } = require("../../utilities/object_id.js");

/**
 * Returns one template's full document, including its fields - used to
 * open it for editing and to populate the "insert template" field picker.
 */
async function get_template_by_id(req, res) {
  try {
    const { template_id } = req.params;

    if (!is_valid_object_id(template_id)) {
      return res.status(400).json(warning_response(req, "INVALID_ID"));
    }

    const template = await templates_model.get_template_by_id(template_id);
    if (!template) {
      return res.status(404).json(warning_response(req, "TEMPLATE_NOT_FOUND"));
    }

    return res.status(200).json(success_response(req, "TEMPLATE_FETCHED", template));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_template_by_id;
