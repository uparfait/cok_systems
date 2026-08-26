const templates_model = require("../../models/templates_model.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { is_valid_object_id } = require("../../utilities/object_id.js");

/**
 * Permanently deletes a template. Never affects a form that already
 * inserted it earlier, since that form kept its own copy of the fields.
 */
async function delete_template(req, res) {
  try {
    const { template_id } = req.params;

    if (!is_valid_object_id(template_id)) {
      return res.status(400).json(warning_response(req, "INVALID_ID"));
    }

    const deleted = await templates_model.delete_template(template_id);
    if (!deleted) {
      return res.status(404).json(warning_response(req, "TEMPLATE_NOT_FOUND"));
    }

    return res.status(200).json(success_response(req, "TEMPLATE_DELETED"));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = delete_template;
