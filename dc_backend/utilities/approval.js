const crypto = require("crypto");

const APPROVAL_MODES = ["sequential", "parallel"];
const ON_REJECT_OPTIONS = ["stop", "continue"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_APPROVERS = 20;

/** Validates the optional approval_config a form author attached; absent/disabled configs are always valid. */
function validate_approval_config(config) {
  const errors = [];
  if (config === undefined || config === null || config.enabled !== true) return { valid: true, errors };

  if (!APPROVAL_MODES.includes(config.mode)) errors.push("approval_config.mode must be 'sequential' or 'parallel'");
  if (!Array.isArray(config.approvers) || config.approvers.length === 0) {
    errors.push("approval_config.approvers must contain at least one approver");
  } else if (config.approvers.length > MAX_APPROVERS) {
    errors.push(`approval_config.approvers cannot exceed ${MAX_APPROVERS} approvers`);
  } else {
    config.approvers.forEach((approver, index) => {
      if (!approver || typeof approver !== "object") {
        errors.push(`approver ${index + 1} is not valid`);
        return;
      }
      if (!approver.name || !approver.name.toString().trim()) errors.push(`approver ${index + 1} is missing a name`);
      if (!approver.role || !approver.role.toString().trim()) errors.push(`approver ${index + 1} is missing a role`);
      if (!approver.email || !EMAIL_REGEX.test(approver.email.toString().trim())) errors.push(`approver ${index + 1} is missing a valid email`);
      if (approver.on_reject !== undefined && !ON_REJECT_OPTIONS.includes(approver.on_reject)) {
        errors.push(`approver ${index + 1} has an invalid on_reject value`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

/** Reduces a raw approval_config to its exact storage shape, or null when the feature is off. */
function normalize_approval_config(config) {
  if (!config || config.enabled !== true) return null;
  return {
    enabled: true,
    mode: config.mode,
    approvers: config.approvers.map((approver) => ({
      name: approver.name.toString().trim(),
      role: approver.role.toString().trim(),
      email: approver.email.toString().trim().toLowerCase(),
      on_reject: ON_REJECT_OPTIONS.includes(approver.on_reject) ? approver.on_reject : "stop",
    })),
  };
}

/** Builds a fresh per-submission approval state, minting one unguessable token per approver. */
function build_approval_state(config) {
  if (!config || config.enabled !== true) return null;
  return {
    status: "pending",
    mode: config.mode,
    current_level: 0,
    steps: config.approvers.map((approver, index) => ({
      level: index,
      name: approver.name,
      role: approver.role,
      email: approver.email,
      on_reject: approver.on_reject,
      token: crypto.randomBytes(24).toString("hex"),
      status: "pending",
      comment: null,
      signature: null,
      acted_at: null,
    })),
  };
}

/** True when this step's approver is currently allowed to approve or reject. */
function can_step_act(approval, step) {
  if (!approval || approval.status !== "pending" || step.status !== "pending") return false;
  return approval.mode === "parallel" || step.level === approval.current_level;
}

/** Applies one approver's decision and resolves the overall flow state; mutates and returns the approval object. */
function apply_approval_decision(approval, step, decision, comment, signature) {
  step.status = decision === "approve" ? "approved" : "rejected";
  step.comment = comment || null;
  step.signature = decision === "approve" ? signature : null;
  step.acted_at = new Date();

  if (decision === "reject" && step.on_reject === "stop") {
    approval.status = "rejected";
    approval.steps.forEach((entry) => {
      if (entry.status === "pending") entry.status = "skipped";
    });
    return approval;
  }

  if (approval.mode === "sequential") {
    const next_pending = approval.steps.find((entry) => entry.level > step.level && entry.status === "pending");
    if (next_pending) {
      approval.current_level = next_pending.level;
      return approval;
    }
  } else if (approval.steps.some((entry) => entry.status === "pending")) {
    return approval;
  }

  // Flow complete: finalized as approved only when every approver approved.
  approval.status = approval.steps.every((entry) => entry.status === "approved") ? "approved" : "rejected";
  return approval;
}

/** Sequential flows reveal the next actionable link only after the previous level acted. */
function get_active_steps(approval) {
  if (!approval || approval.status !== "pending") return [];
  if (approval.mode === "parallel") return approval.steps.filter((step) => step.status === "pending");
  const current = approval.steps.find((step) => step.level === approval.current_level && step.status === "pending");
  return current ? [current] : [];
}

/** Public trail view of every step - never exposes any step's token. */
function public_approval_trail(approval) {
  return approval.steps.map((step) => ({
    level: step.level,
    name: step.name,
    role: step.role,
    status: step.status,
    comment: step.comment,
    signature: step.signature ? { kind: step.signature.kind, file: step.signature.file } : null,
    acted_at: step.acted_at,
  }));
}

module.exports = {
  validate_approval_config,
  normalize_approval_config,
  build_approval_state,
  can_step_act,
  apply_approval_decision,
  get_active_steps,
  public_approval_trail,
};
