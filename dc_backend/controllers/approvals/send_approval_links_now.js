const forms_model = require("../../models/forms_model.js");
const projects_model = require("../../models/projects_model.js");
const project_access = require("../../utilities/project_access.js");
const { validate_batch_approvers, fire_batch_approval } = require("../../utilities/batch_approval.js");
const { resolve_client_origin } = require("../../utilities/approval_email.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * The scheduling dialog's "send now" action: immediately emails every
 * given approver a batch approval link and one-time code covering all the
 * data collected so far that no previous batch already covers.
 */
async function send_approval_links_now(req, res) {
  try {
    const { form_group_id } = req.params;
    const { approvers } = req.body || {};

    const form_version = await forms_model.get_latest_version(form_group_id);
    if (!form_version) return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));

    const project = await projects_model.find_project_by_id(form_version.project_id);
    const management = await project_access.resolve_form_management(req.user, project, form_group_id);
    if (!management.edit_forms) return res.status(403).json(warning_response(req, "FORM_ACTION_FORBIDDEN"));

    const approvers_check = validate_batch_approvers(approvers);
    if (!approvers_check.valid) {
      return res.status(422).json(warning_response(req, "APPROVAL_SCHEDULE_INVALID", null, { errors: approvers_check.errors }));
    }

    const result = await fire_batch_approval({
      form_group_id,
      approvers,
      origin: resolve_client_origin(req),
      source: "manual",
      created_by: req.user.email,
    });

    if (!result.sent) {
      return res.status(409).json(warning_response(req, "APPROVAL_NO_DATA_TO_SEND"));
    }

    return res.status(200).json(
      success_response(req, "APPROVAL_LINKS_SENT", {
        sent_count: result.sent_count,
        approvers: result.request.approvers.map((approver) => ({ name: approver.name, email: approver.email, email_sent: approver.email_sent })),
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = send_approval_links_now;
