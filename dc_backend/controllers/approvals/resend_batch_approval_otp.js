const approval_requests_model = require("../../models/approval_requests_model.js");
const { can_batch_step_act, notify_batch_steps, MAX_OTP_ATTEMPTS } = require("../../utilities/batch_approval.js");
const { mask_email } = require("../../utilities/batch_session.js");
const { resolve_client_origin } = require("../../utilities/approval_email.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Sends this approver's one-time code again, for when their session
 * signature expired. Only ever mails the address already on the step, and
 * only while it is actually their turn.
 */
async function resend_batch_approval_otp(req, res) {
  try {
    const { token } = req.params;

    const request = await approval_requests_model.find_by_token(token);
    if (!request) return res.status(404).json(warning_response(req, "APPROVAL_NOT_FOUND"));

    const approver = request.approvers.find((entry) => entry.token === token);
    if (approver.otp_attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json(warning_response(req, "APPROVAL_OTP_LOCKED"));
    }
    if (approver.status !== "pending" || request.status !== "pending") {
      return res.status(409).json(warning_response(req, "APPROVAL_ALREADY_DECIDED"));
    }
    if (!can_batch_step_act(request, approver)) {
      return res.status(409).json(warning_response(req, "APPROVAL_NOT_YOUR_TURN"));
    }

    approver.notified_at = null;
    await notify_batch_steps(request, [approver], resolve_client_origin(req));
    await approval_requests_model.update_request(request._id, { approvers: request.approvers });

    // The code itself is echoed back only outside production, matching the
    // backend console print used while the mail service is unreliable. In
    // production it never leaves the email.
    const payload = { email_masked: mask_email(approver.email) };
    if (process.env.NODE_ENV !== "production") payload.otp = approver.otp;

    return res.status(200).json(success_response(req, "APPROVAL_OTP_RESENT", payload));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = resend_batch_approval_otp;
