const approval_requests_model = require("../../models/approval_requests_model.js");
const submissions_model = require("../../models/submissions_model.js");
const forms_model = require("../../models/forms_model.js");
const { is_otp_valid, MAX_OTP_ATTEMPTS } = require("../../utilities/batch_approval.js");
const { issue_session } = require("../../utilities/batch_session.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Exchanges a correct one-time code for the batch's actual collected
 * records, so the approver can review the data before deciding. Every
 * wrong code burns one of a small fixed number of attempts; a locked
 * approver can never see the data through this link again.
 */
async function verify_batch_approval_otp(req, res) {
  try {
    const { token } = req.params;
    const { otp } = req.body || {};

    const request = await approval_requests_model.find_by_token(token);
    if (!request) return res.status(404).json(warning_response(req, "APPROVAL_NOT_FOUND"));

    const approver = request.approvers.find((entry) => entry.token === token);
    if (approver.otp_attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json(warning_response(req, "APPROVAL_OTP_LOCKED"));
    }

    if (!is_otp_valid(approver, otp)) {
      approver.otp_attempts += 1;
      await approval_requests_model.update_request(request._id, { approvers: request.approvers });
      return res.status(401).json(warning_response(req, "APPROVAL_OTP_INVALID", null, { attempts_left: MAX_OTP_ATTEMPTS - approver.otp_attempts }));
    }

    const [form_version, submissions] = await Promise.all([
      forms_model.get_latest_version(request.form_group_id),
      submissions_model.list_by_approval_request(request._id, 500),
    ]);

    // The code is spent here: from now on this approver carries a
    // one-day session signature instead of replaying the code.
    const session = issue_session(approver);
    approver.otp_attempts = 0;
    await approval_requests_model.update_request(request._id, { approvers: request.approvers });

    const decisions = approver.record_decisions || [];

    return res.status(200).json(
      success_response(req, "APPROVAL_OTP_VERIFIED", {
        signature: session.signature,
        // Ownership is proven now, so the full address may be shown back.
        email: approver.email,
        signature_expires_at: session.expires_at,
        schema: form_version ? form_version.schema : null,
        submissions: submissions.map((submission) => {
          const own = decisions.find((entry) => entry.submission_id === submission._id.toString());
          return {
            id: submission._id.toString(),
            data: submission.data,
            version: submission.version,
            submitted_at: submission.submitted_at,
            my_decision: own ? own.status : null,
            my_comment: own ? own.comment : null,
          };
        }),
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = verify_batch_approval_otp;
