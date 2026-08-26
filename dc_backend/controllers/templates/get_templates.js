const templates_model = require("../../models/templates_model.js");
const { success_response, error_response } = require("../../utilities/response.js");

/**
 * Lists every template (name and description only) - backs the templates
 * list page and the "insert template" picker.
 */
async function get_templates(req, res) {
  try {
    const templates = await templates_model.list_templates();
    return res.status(200).json(success_response(req, "TEMPLATES_FETCHED", templates));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_templates;
