const forms_model = require("../../models/forms_model.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { is_valid_object_id } = require("../../utilities/object_id.js");

/**
 * Lists the forms that belong to a project, one entry per form group using
 * its latest version - rendered by the frontend as links, never a table.
 */
async function get_forms_by_project(req, res) {
  try {
    const { project_id } = req.params;

    if (!is_valid_object_id(project_id)) {
      return res.status(400).json(warning_response(req, "INVALID_ID"));
    }

    const forms = await forms_model.get_latest_forms_by_project(project_id);
    return res.status(200).json(success_response(req, "FORM_VERSIONS_FETCHED", forms));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_forms_by_project;
