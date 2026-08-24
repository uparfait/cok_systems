const forms_model = require("../../models/forms_model.js");
const projects_model = require("../../models/projects_model.js");
const project_access = require("../../utilities/project_access.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Marks one version of a form as the active version. Only the active
 * version is ever served through the public data-collection link.
 */
async function set_active_version(req, res) {
  try {
    const { form_group_id } = req.params;
    const { version } = req.body || {};

    if (!form_group_id) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }
    if (version === undefined || version === null) {
      return res.status(400).json(warning_response(req, "FORM_SCHEMA_INVALID"));
    }

    // Switching the active version is an edit-level action on the form.
    const latest_version = await forms_model.get_latest_version(form_group_id);
    if (!latest_version) {
      return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    }
    const project = await projects_model.find_project_by_id(latest_version.project_id);
    const management = await project_access.resolve_form_management(req.user, project, form_group_id);
    if (!management.edit_forms) {
      return res.status(403).json(warning_response(req, "FORM_ACTION_FORBIDDEN"));
    }

    const active_form = await forms_model.set_active_version(form_group_id, version);
    if (!active_form) {
      return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    }

    return res.status(200).json(success_response(req, "FORM_ACTIVE_VERSION_SET", active_form));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = set_active_version;
