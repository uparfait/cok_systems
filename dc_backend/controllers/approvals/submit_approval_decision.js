const submissions_model = require("../../models/submissions_model.js");
const forms_model = require("../../models/forms_model.js");
const { can_step_act, apply_approval_decision, get_active_steps, public_approval_trail } = require("../../utilities/approval.js");
const { notify_approval_steps } = require("../../utilities/approval_email.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

const SIGNATURE_KINDS = ["drawn", "certificate"];

/** A valid approval signature references an already-uploaded file by URL - bytes are never embedded in the document. */
function is_valid_signature(signature) {
  if (!signature || typeof signature !== "object") return false;
  if (!SIGNATURE_KINDS.includes(signature.kind)) return false;
  const file = signature.file;
  if (!file || typeof file !== "object" || typeof file.url !== "string") return false;
  return file.url.startsWith("/dcs/api/uploads/approvals/");
}

/**
 the unguessable step token is the Approving always requires a signature (drawn
 * or an uploaded digital certificate)
 */
async function submit_approval_decision(req, res) {
  try {
    const { token } = req.params;
    const { decision, comment, signature } = req.body || {};

    if (decision !== "approve" && decision !== "reject") {
      return res.status(400).json(warning_response(req, "APPROVAL_DECISION_INVALID"));
    }

    const submission = await submissions_model.find_by_approval_token(token);
    if (!submission || !submission.approval) {
      return res.status(404).json(warning_response(req, "APPROVAL_NOT_FOUND"));
    }

    const approval = submission.approval;
    const step = approval.steps.find((entry) => entry.token === token);

    if (approval.status !== "pending" || step.status !== "pending") {
      return res.status(409).json(warning_response(req, "APPROVAL_ALREADY_DECIDED"));
    }
    if (!can_step_act(approval, step)) {
      return res.status(409).json(warning_response(req, "APPROVAL_NOT_YOUR_TURN"));
    }
    if (decision === "approve" && !is_valid_signature(signature)) {
      return res.status(422).json(warning_response(req, "APPROVAL_SIGNATURE_REQUIRED"));
    }

    const clean_signature =
      decision === "approve"
        ? {
            kind: signature.kind,
            file: {
              name: (signature.file.name || "signature").toString(),
              type: (signature.file.type || "").toString(),
              size: Number(signature.file.size) || 0,
              url: signature.file.url,
            },
          }
        : null;

    apply_approval_decision(approval, step, decision, comment ? comment.toString().trim() : null, clean_signature);

    // The system itself emails whoever just became able to act (never re-emailing anyone);
    // every link is also printed to the backend console by notify_approval_steps. Legacy
    // parallel flows were fully notified at submit time, so nothing new is ever sent here.
    let next_approvers = [];
    if (approval.mode !== "parallel" && approval.status === "pending") {
      const steps_to_notify = get_active_steps(approval).filter((entry) => !entry.notified_at);
      if (steps_to_notify.length > 0) {
        const form_version = await forms_model.get_version_document(submission.form_group_id, submission.version);
        const notified = await notify_approval_steps(req, (form_version && form_version.form_name) || "Form", steps_to_notify);
        const sent_by_token = new Map(notified.map((entry) => [entry.token, entry.email_sent]));
        approval.steps.forEach((entry) => {
          if (sent_by_token.has(entry.token)) {
            entry.notified_at = new Date();
            entry.email_sent = sent_by_token.get(entry.token);
          }
        });
        // A failed email's link is only ever printed to the backend console, never handed to the browser.
        next_approvers = notified.map((entry) => ({
          level: entry.level,
          name: entry.name,
          role: entry.role,
          email_sent: entry.email_sent,
        }));
      }
    }
    await submissions_model.update_submission_approval(submission._id, approval);

    return res.status(200).json(
      success_response(req, "APPROVAL_DECISION_RECORDED", {
        overall_status: approval.status,
        decision: step.status,
        next_approvers,
        trail: public_approval_trail(approval),
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = submit_approval_decision;
