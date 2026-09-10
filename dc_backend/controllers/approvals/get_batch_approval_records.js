const approval_requests_model = require("../../models/approval_requests_model.js");
const submissions_model = require("../../models/submissions_model.js");
const forms_model = require("../../models/forms_model.js");
const { is_session_valid, read_session_signature } = require("../../utilities/batch_session.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * The batch's collected records, for an approver who already exchanged
 * their one-time code for a session signature. Lets a reload reopen the
 * data without burning a new code, and refuses outright without a valid
 * signature - no data ever leaves here on the token alone.
 */
async function get_batch_approval_records(req, res) {
  try {
    const { token } = req.params;
    const signature = read_session_signature(req);

    const request = await approval_requests_model.find_by_token(token);
    if (!request) return res.status(404).json(warning_response(req, "APPROVAL_NOT_FOUND"));

    const approver = request.approvers.find((entry) => entry.token === token);
    if (!is_session_valid(approver, signature)) {
      return res.status(401).json(warning_response(req, "APPROVAL_SESSION_INVALID", null, { signature_required: true }));
    }

    const [form_version, submissions] = await Promise.all([
      forms_model.get_latest_version(request.form_group_id),
      submissions_model.list_by_approval_request(request._id, 500),
    ]);

    return res.status(200).json(
      success_response(req, "APPROVAL_OTP_VERIFIED", {
        email: approver.email,
        schema: form_version ? form_version.schema : null,
        submissions: submissions.map((submission) => ({
          data: submission.data,
          version: submission.version,
          submitted_at: submission.submitted_at,
        })),
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_batch_approval_records;
