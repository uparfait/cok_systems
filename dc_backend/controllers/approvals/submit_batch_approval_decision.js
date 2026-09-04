const approval_requests_model = require("../../models/approval_requests_model.js");
const {
  is_otp_valid,
  can_batch_step_act,
  apply_batch_decision,
  get_active_batch_steps,
  notify_batch_steps,
  public_batch_trail,
  MAX_OTP_ATTEMPTS,
} = require("../../utilities/batch_approval.js");
const { resolve_client_origin } = require("../../utilities/approval_email.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

const MAX_COMMENT_LENGTH = 1000;

/**
 * Records one approver's batch decision. The link token identifies the
 * approver; the one-time code from their email authorizes the decision
 * itself. The form's approver hierarchy is enforced: an approver can only
 * act when it is their turn, and their approval is what releases the link
 * and code email to whoever comes next in the chain.
 */
async function submit_batch_approval_decision(req, res) {
  try {
    const { token } = req.params;
    const { otp, decision, comment } = req.body || {};

    if (decision !== "approve" && decision !== "reject") {
      return res.status(400).json(warning_response(req, "APPROVAL_DECISION_INVALID"));
    }

    const request = await approval_requests_model.find_by_token(token);
    if (!request) return res.status(404).json(warning_response(req, "APPROVAL_NOT_FOUND"));

    const approver = request.approvers.find((entry) => entry.token === token);
    if (request.status !== "pending" || approver.status !== "pending") {
      return res.status(409).json(warning_response(req, "APPROVAL_ALREADY_DECIDED"));
    }
    if (!can_batch_step_act(request, approver)) {
      return res.status(409).json(warning_response(req, "APPROVAL_NOT_YOUR_TURN"));
    }
    if (approver.otp_attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json(warning_response(req, "APPROVAL_OTP_LOCKED"));
    }
    if (!is_otp_valid(approver, otp)) {
      approver.otp_attempts += 1;
      await approval_requests_model.update_request(request._id, { approvers: request.approvers });
      return res.status(401).json(warning_response(req, "APPROVAL_OTP_INVALID", null, { attempts_left: MAX_OTP_ATTEMPTS - approver.otp_attempts }));
    }

    apply_batch_decision(request, approver, decision, comment ? comment.toString().trim().slice(0, MAX_COMMENT_LENGTH) : null);

    // The chain advances: whoever just became able to act gets their link and one-time code now (never re-emailing anyone).
    if (request.status === "pending") {
      const steps_to_notify = get_active_batch_steps(request).filter((entry) => !entry.notified_at);
      if (steps_to_notify.length > 0) await notify_batch_steps(request, steps_to_notify, resolve_client_origin(req));
    }

    await approval_requests_model.update_request(request._id, { approvers: request.approvers, status: request.status });

    console.log(`[BATCH APPROVAL] ${approver.email} ${approver.status} "${request.form_name}" (${request.submission_count} records) -> batch ${request.status}`);

    return res.status(200).json(
      success_response(req, "APPROVAL_DECISION_RECORDED", {
        overall_status: request.status,
        decision: approver.status,
        trail: public_batch_trail(request),
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = submit_batch_approval_decision;
