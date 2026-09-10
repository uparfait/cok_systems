const approval_requests_model = require("../../models/approval_requests_model.js");
const submissions_model = require("../../models/submissions_model.js");
const {
  can_batch_step_act,
  apply_batch_decision,
  get_active_batch_steps,
  notify_batch_steps,
  check_count_triggers,
} = require("../../utilities/batch_approval.js");
const { is_session_valid, read_session_signature, read_idempotency_key } = require("../../utilities/batch_session.js");
const { resolve_client_origin } = require("../../utilities/approval_email.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

const MAX_COMMENT_LENGTH = 1000;

/**
 * One record of a batch decided on its own, so an approver can work
 * through the batch instead of accepting or refusing all of it at once.
 * The batch-wide step only closes once every record carries a decision:
 * approved when they all are, rejected as soon as one is refused.
 */
async function submit_batch_record_decision(req, res) {
  try {
    const { token, submission_id } = req.params;
    const { decision, comment, signature: approver_signature } = req.body || {};
    const signature = read_session_signature(req);
    const idempotency_key = read_idempotency_key(req);

    if (decision !== "approve" && decision !== "reject") {
      return res.status(400).json(warning_response(req, "APPROVAL_DECISION_INVALID"));
    }

    const request = await approval_requests_model.find_by_token(token);
    if (!request) return res.status(404).json(warning_response(req, "APPROVAL_NOT_FOUND"));

    const approver = request.approvers.find((entry) => entry.token === token);
    if (!is_session_valid(approver, signature)) {
      return res.status(401).json(warning_response(req, "APPROVAL_SESSION_INVALID", null, { signature_required: true }));
    }
    if (!idempotency_key) {
      return res.status(400).json(warning_response(req, "APPROVAL_IDEMPOTENCY_REQUIRED"));
    }

    approver.record_decisions = approver.record_decisions || [];
    const existing = approver.record_decisions.find((entry) => entry.submission_id === submission_id);

    // The same click arriving twice answers with what was already stored.
    if (existing && existing.idempotency_key === idempotency_key) {
      return res.status(200).json(
        success_response(req, "APPROVAL_DECISION_RECORDED", {
          submission_id,
          decision: existing.status,
          overall_status: request.status,
          repeated: true,
        }),
      );
    }
    // A record this approver already settled can never be flipped.
    if (existing) {
      return res.status(409).json(warning_response(req, "APPROVAL_ALREADY_DECIDED", null, { decision: existing.status }));
    }

    if (request.status !== "pending" || approver.status !== "pending") {
      return res.status(409).json(warning_response(req, "APPROVAL_ALREADY_DECIDED"));
    }
    if (!can_batch_step_act(request, approver)) {
      return res.status(409).json(warning_response(req, "APPROVAL_NOT_YOUR_TURN"));
    }

    approver.record_decisions.push({
      submission_id,
      status: decision === "approve" ? "approved" : "rejected",
      comment: comment ? comment.toString().trim().slice(0, MAX_COMMENT_LENGTH) : null,
      acted_at: new Date(),
      idempotency_key,
      signature: approver_signature && approver_signature.file ? { kind: approver_signature.kind || "drawn", file: approver_signature.file } : null,
    });

    // Once every record of the batch has a decision, the approver's own
    // step closes with the outcome those decisions add up to.
    const all_ids = await submissions_model.list_ids_by_approval_request(request._id);
    const decided_ids = new Set(approver.record_decisions.map((entry) => entry.submission_id));
    const all_decided = all_ids.length > 0 && all_ids.every((id) => decided_ids.has(id.toString()));

    if (all_decided) {
      const any_rejected = approver.record_decisions.some((entry) => entry.status === "rejected");
      apply_batch_decision(request, approver, any_rejected ? "reject" : "approve", null);
      if (request.status === "pending") {
        const steps_to_notify = get_active_batch_steps(request).filter((entry) => !entry.notified_at);
        if (steps_to_notify.length > 0) await notify_batch_steps(request, steps_to_notify, resolve_client_origin(req));
      }
    }

    await approval_requests_model.update_request(request._id, { approvers: request.approvers, status: request.status });

    if (all_decided && request.status !== "pending") {
      await check_count_triggers(request.form_group_id, resolve_client_origin(req));
    }

    return res.status(200).json(
      success_response(req, "APPROVAL_DECISION_RECORDED", {
        submission_id,
        decision: decision === "approve" ? "approved" : "rejected",
        overall_status: request.status,
        step_status: approver.status,
        decided_count: approver.record_decisions.length,
        total_count: all_ids.length,
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = submit_batch_record_decision;
