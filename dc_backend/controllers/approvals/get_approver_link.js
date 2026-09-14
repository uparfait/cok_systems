const forms_model = require("../../models/forms_model.js");
const projects_model = require("../../models/projects_model.js");
const approval_requests_model = require("../../models/approval_requests_model.js");
const project_access = require("../../utilities/project_access.js");
const { resolve_client_origin } = require("../../utilities/approval_email.js");
const { issue_session } = require("../../utilities/batch_session.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * The approval link of one approver on a form's current batch, for an
 * admin who needs to hand it over themselves when the email did not
 * arrive. Only someone who may edit the form can ask, and only a step
 * still waiting on that approver has a link to give.
 *
 * The copied link carries a one-day session signature (?signature=...),
 * the same credential the emailed one-time code would have earned, so
 * whoever receives it from the admin opens the records straight away
 * without asking for a code. Copying again mints a fresh signature and
 * retires the previous one.
 */
async function get_approver_link(req, res) {
  try {
    const { form_group_id } = req.params;
    const email = (req.params.email || "").toString().trim().toLowerCase();

    const form_version = await forms_model.get_latest_version(form_group_id);
    if (!form_version) return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));

    const project = await projects_model.find_project_by_id(form_version.project_id);
    const management = await project_access.resolve_form_management(req.user, project, form_group_id);
    if (!management.edit_forms) return res.status(403).json(warning_response(req, "FORM_ACTION_FORBIDDEN"));

    const requests = await approval_requests_model.list_by_form_group(form_group_id, 10);
    const pending = requests.filter((entry) => entry.status === "pending");

    let step = null;
    let holder = null;
    for (const request of pending) {
      const found = (request.approvers || []).find((entry) => (entry.email || "").toLowerCase() === email && entry.status === "pending");
      if (found) {
        step = found;
        holder = request;
        break;
      }
    }

    if (!step) return res.status(404).json(warning_response(req, "APPROVAL_LINK_UNAVAILABLE"));

    const session = issue_session(step);
    await approval_requests_model.update_request(holder._id, { approvers: holder.approvers });

    const origin = (resolve_client_origin(req) || "").replace(/\/+$/, "");
    return res.status(200).json(
      success_response(req, "APPROVAL_LINK_READY", {
        link: `${origin}/dcs-batch-approval/${step.token}?signature=${encodeURIComponent(session.signature)}`,
        email: step.email,
        signature_expires_at: session.expires_at,
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_approver_link;
