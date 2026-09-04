const forms_model = require("../../models/forms_model.js");
const projects_model = require("../../models/projects_model.js");
const approval_schedules_model = require("../../models/approval_schedules_model.js");
const project_access = require("../../utilities/project_access.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/** Cancels a form's waiting approval schedule so it will never fire. */
async function cancel_approval_schedule(req, res) {
  try {
    const { form_group_id } = req.params;

    const form_version = await forms_model.get_latest_version(form_group_id);
    if (!form_version) return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));

    const project = await projects_model.find_project_by_id(form_version.project_id);
    const management = await project_access.resolve_form_management(req.user, project, form_group_id);
    if (!management.edit_forms) return res.status(403).json(warning_response(req, "FORM_ACTION_FORBIDDEN"));

    const cancelled = await approval_schedules_model.cancel_schedule(form_group_id);
    if (!cancelled) return res.status(404).json(warning_response(req, "APPROVAL_SCHEDULE_NOT_FOUND"));

    return res.status(200).json(success_response(req, "APPROVAL_SCHEDULE_CANCELLED"));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = cancel_approval_schedule;
