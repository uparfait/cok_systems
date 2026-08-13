const forms_model = require("../../models/forms_model.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Returns the latest version of a form by its stable group id, used by the
 * form details / settings pages inside the authenticated builder.
 */
async function get_form_by_id(req, res) {
  try {
    const { form_group_id } = req.params;

    if (!form_group_id) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }

    const form = await forms_model.get_latest_version(form_group_id);
    if (!form) {
      return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    }

    return res.status(200).json(success_response(req, "FORM_FETCHED", form));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_form_by_id;
