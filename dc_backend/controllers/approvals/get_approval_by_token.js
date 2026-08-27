const submissions_model = require("../../models/submissions_model.js");
const forms_model = require("../../models/forms_model.js");
const { can_step_act, public_approval_trail } = require("../../utilities/approval.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Public, no-auth approval page fetch behind /dcs-approval/:token. The
 * token alone identifies both the submission and which approver is looking
 * at it; nothing here ever exposes any other step's token.
 */
async function get_approval_by_token(req, res) {
  try {
    const { token } = req.params;
    const submission = await submissions_model.find_by_approval_token(token);
    if (!submission || !submission.approval) {
      return res.status(404).json(warning_response(req, "APPROVAL_NOT_FOUND"));
    }

    const approval = submission.approval;
    const step = approval.steps.find((entry) => entry.token === token);
    const form_version = await forms_model.get_version_document(submission.form_group_id, submission.version);
    if (!form_version) {
      return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    }

    return res.status(200).json(
      success_response(req, "APPROVAL_FETCHED", {
        form_name: form_version.form_name,
        schema: form_version.schema,
        submitted_at: submission.submitted_at,
        data: submission.data,
        overall_status: approval.status,
        mode: approval.mode,
        approver: { level: step.level, name: step.name, role: step.role, email: step.email, status: step.status },
        can_act: can_step_act(approval, step),
        trail: public_approval_trail(approval),
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_approval_by_token;
