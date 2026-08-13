const forms_model = require("../../models/forms_model.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Lists every version of a form (version number + title), newest first,
 * each linking to its own collected-data view.
 */
async function get_form_versions(req, res) {
  try {
    const { form_group_id } = req.params;

    if (!form_group_id) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }

    const versions = await forms_model.get_versions_by_group(form_group_id);
    if (versions.length === 0) {
      return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    }

    return res.status(200).json(success_response(req, "FORM_VERSIONS_FETCHED", versions));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_form_versions;
