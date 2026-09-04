const forms_model = require("../../models/forms_model.js");
const projects_model = require("../../models/projects_model.js");
const approval_schedules_model = require("../../models/approval_schedules_model.js");
const project_access = require("../../utilities/project_access.js");
const { validate_batch_approvers, validate_trigger, normalize_batch_approvers } = require("../../utilities/batch_approval.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Creates or replaces a form's approval schedule: who gets the approval
 * links, and whether they fire after N collected responses or at a chosen
 * date and time. A form only ever holds one waiting schedule.
 */
async function save_approval_schedule(req, res) {
  try {
    const { form_group_id } = req.params;
    const { approvers, trigger } = req.body || {};

    const form_version = await forms_model.get_latest_version(form_group_id);
    if (!form_version) return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));

    const project = await projects_model.find_project_by_id(form_version.project_id);
    const management = await project_access.resolve_form_management(req.user, project, form_group_id);
    if (!management.edit_forms) return res.status(403).json(warning_response(req, "FORM_ACTION_FORBIDDEN"));

    const approvers_check = validate_batch_approvers(approvers);
    const trigger_check = validate_trigger(trigger);
    if (!approvers_check.valid || !trigger_check.valid) {
      return res
        .status(422)
        .json(warning_response(req, "APPROVAL_SCHEDULE_INVALID", null, { errors: approvers_check.errors.concat(trigger_check.errors) }));
    }

    const schedule = await approval_schedules_model.upsert_schedule(form_group_id, {
      project_id: form_version.project_id,
      approvers: normalize_batch_approvers(approvers),
      trigger:
        trigger.type === "count"
          ? { type: "count", count: Number(trigger.count) }
          : { type: "datetime", datetime: new Date(trigger.datetime) },
      created_by: req.user.email,
    });

    return res.status(200).json(
      success_response(req, "APPROVAL_SCHEDULE_SAVED", {
        schedule: { approvers: schedule.approvers, trigger: schedule.trigger },
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = save_approval_schedule;
