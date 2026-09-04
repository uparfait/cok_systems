const approval_requests_model = require("../../models/approval_requests_model.js");
const { is_otp_valid, resolve_request_status, public_batch_trail, MAX_OTP_ATTEMPTS } = require("../../utilities/batch_approval.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

const MAX_COMMENT_LENGTH = 1000;

/**
 * Records one approver's batch decision. The link token identifies the
 * approver; the one-time code from their email authorizes the decision
 * itself. Approvers act independently: any rejection rejects the batch,
 * unanimous approval approves it.
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
    if (approver.status !== "pending") {
      return res.status(409).json(warning_response(req, "APPROVAL_ALREADY_DECIDED"));
    }
    if (approver.otp_attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json(warning_response(req, "APPROVAL_OTP_LOCKED"));
    }
    if (!is_otp_valid(approver, otp)) {
      approver.otp_attempts += 1;
      await approval_requests_model.update_request(request._id, { approvers: request.approvers });
      return res.status(401).json(warning_response(req, "APPROVAL_OTP_INVALID", null, { attempts_left: MAX_OTP_ATTEMPTS - approver.otp_attempts }));
    }

    approver.status = decision === "approve" ? "approved" : "rejected";
    approver.comment = comment ? comment.toString().trim().slice(0, MAX_COMMENT_LENGTH) : null;
    approver.acted_at = new Date();
    const overall_status = resolve_request_status(request);

    await approval_requests_model.update_request(request._id, { approvers: request.approvers, status: overall_status });

    console.log(`[BATCH APPROVAL] ${approver.email} ${approver.status} "${request.form_name}" (${request.submission_count} records) -> batch ${overall_status}`);

    return res.status(200).json(
      success_response(req, "APPROVAL_DECISION_RECORDED", {
        overall_status,
        decision: approver.status,
        trail: public_batch_trail(request),
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = submit_batch_approval_decision;
