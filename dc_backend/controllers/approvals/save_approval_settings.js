const forms_model = require("../../models/forms_model.js");
const projects_model = require("../../models/projects_model.js");
const approval_settings_model = require("../../models/approval_settings_model.js");
const project_access = require("../../utilities/project_access.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Saves only a form's approver-dashboard settings - how long an already
 * decided record keeps showing. Deliberately separate from the schedule
 * endpoint so changing this never creates a schedule and never sends any
 * approval link.
 */
async function save_approval_settings(req, res) {
  try {
    const { form_group_id } = req.params;
    const { approved_retention } = req.body || {};

    if (!approval_settings_model.is_valid_retention(approved_retention)) {
      return res.status(422).json(warning_response(req, "APPROVAL_SCHEDULE_INVALID", null, { errors: ["approved_retention"] }));
    }

    const form_version = await forms_model.get_latest_version(form_group_id);
    if (!form_version) return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));

    const project = await projects_model.find_project_by_id(form_version.project_id);
    const management = await project_access.resolve_form_management(req.user, project, form_group_id);
    if (!management.edit_forms) return res.status(403).json(warning_response(req, "FORM_ACTION_FORBIDDEN"));

    const saved = await approval_settings_model.save_approved_retention(form_group_id, approved_retention, req.user.email);

    return res.status(200).json(success_response(req, "APPROVAL_SETTINGS_SAVED", { approved_retention: saved }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = save_approval_settings;
