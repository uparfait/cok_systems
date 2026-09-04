const approval_requests_model = require("../../models/approval_requests_model.js");
const { public_batch_trail, can_batch_step_act, MAX_OTP_ATTEMPTS } = require("../../utilities/batch_approval.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Public, no-auth batch approval page fetch behind /dcs-batch-approval/:token.
 * Deliberately returns no collected data - the approver only sees the
 * records after verifying the one-time code from their email.
 */
async function get_batch_approval_by_token(req, res) {
  try {
    const { token } = req.params;
    const request = await approval_requests_model.find_by_token(token);
    if (!request) return res.status(404).json(warning_response(req, "APPROVAL_NOT_FOUND"));

    const approver = request.approvers.find((entry) => entry.token === token);

    // The same approver's other still-pending batches, so the page can offer
    // switching between forms waiting on them. Only this approver's own step
    // tokens are ever handed out - each one still demands its own emailed
    // one-time code before any data shows.
    const siblings = await approval_requests_model.list_pending_by_approver_email(approver.email);
    const other_batches = siblings
      .filter((entry) => entry._id.toString() !== request._id.toString())
      .map((entry) => {
        const own_step = entry.approvers.find((step) => step.email === approver.email && step.status === "pending");
        return own_step
          ? { form_name: entry.form_name, token: own_step.token, submission_count: entry.submission_count, created_at: entry.created_at }
          : null;
      })
      .filter(Boolean);

    return res.status(200).json(
      success_response(req, "APPROVAL_FETCHED", {
        form_name: request.form_name,
        submission_count: request.submission_count,
        sent_at: request.created_at,
        overall_status: request.status,
        approver: {
          name: approver.name,
          role: approver.role,
          email: approver.email,
          message: approver.message || null,
          status: approver.status,
          comment: approver.comment,
          acted_at: approver.acted_at,
        },
        can_act: can_batch_step_act(request, approver),
        otp_locked: approver.otp_attempts >= MAX_OTP_ATTEMPTS,
        other_batches,
        trail: public_batch_trail(request),
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_batch_approval_by_token;
