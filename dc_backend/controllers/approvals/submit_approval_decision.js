const submissions_model = require("../../models/submissions_model.js");
const { can_step_act, apply_approval_decision, get_active_steps, public_approval_trail } = require("../../utilities/approval.js");
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
    await submissions_model.update_submission_approval(submission._id, approval);

    // Sequential flows hand the next approver's link back so whoever just acted can pass it on.
    const next_steps = get_active_steps(approval).map((entry) => ({
      level: entry.level,
      name: entry.name,
      role: entry.role,
      email: entry.email,
      token: entry.token,
    }));

    return res.status(200).json(
      success_response(req, "APPROVAL_DECISION_RECORDED", {
        overall_status: approval.status,
        decision: step.status,
        next_links: approval.mode === "sequential" ? next_steps : [],
        trail: public_approval_trail(approval),
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = submit_approval_decision;
