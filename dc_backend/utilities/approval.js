const crypto = require("crypto");

const ON_REJECT_OPTIONS = ["stop", "continue"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_APPROVERS = 20;
const MAX_APPROVER_MESSAGE_LENGTH = 500;
const APPROVER_LEVELS = ["VILLAGE", "CELL", "SECTOR", "DISTRICT", "PROVINCE"];

/** Case-insensitive trimmed equality, the same rule the simulation project used for category matching. */
function eq_answer(answer, value) {
  const normalize = (entry) => String(entry === undefined || entry === null ? "" : entry).trim().toLowerCase();
  if (Array.isArray(answer)) return answer.some((entry) => normalize(entry) === normalize(value));
  return normalize(answer) === normalize(value);
}

/** True when every "field equals value" condition holds against the submitted data. */
function matches_conditions(conditions, data) {
  if (!Array.isArray(conditions) || conditions.length === 0) return true;
  return conditions.every((condition) => eq_answer(data ? data[condition.field_id] : undefined, condition.value));
}

/** An approver is location-scoped only when both a level and a location were set. */
function has_location(approver) {
  return APPROVER_LEVELS.includes(approver.level) && Number.isFinite(Number(approver.location_id));
}

/** Old configs (pre-location) carry a mode instead of per-approver levels; they must keep working untouched. */
function is_legacy_config(config) {
  return !!config && config.mode !== undefined;
}

/** Validates the optional approval_config a form author attached; absent/disabled configs are always valid. */
function validate_approval_config(config) {
  const errors = [];
  if (config === undefined || config === null || config.enabled !== true) return { valid: true, errors };

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
      if (approver.message !== undefined && approver.message !== null && approver.message.toString().trim().length > MAX_APPROVER_MESSAGE_LENGTH) {
        errors.push(`approver ${index + 1} message cannot exceed ${MAX_APPROVER_MESSAGE_LENGTH} characters`);
      }
      if (!is_legacy_config(config)) {
        // Location is optional, but a half-set one (level without a place, or vice versa) is a mistake.
        const level_set = approver.level !== undefined && approver.level !== null && `${approver.level}` !== "";
        const location_set = approver.location_id !== undefined && approver.location_id !== null && `${approver.location_id}` !== "";
        if (level_set && !APPROVER_LEVELS.includes(approver.level)) errors.push(`approver ${index + 1} has an invalid administrative level`);
        if (level_set !== location_set || (level_set && location_set && !Number.isFinite(Number(approver.location_id)))) {
          errors.push(`approver ${index + 1} has an incomplete location`);
        }
        if (approver.conditions !== undefined) {
          if (!Array.isArray(approver.conditions)) {
            errors.push(`approver ${index + 1} has invalid conditions`);
          } else {
            approver.conditions.forEach((condition, condition_index) => {
              const field_ok = condition && condition.field_id && condition.field_id.toString().trim();
              const value_ok = condition && condition.value !== undefined && condition.value !== null && condition.value.toString().trim();
              if (!field_ok || !value_ok) errors.push(`approver ${index + 1} condition ${condition_index + 1} needs a field and a value`);
            });
          }
        }
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

/** Reduces a raw approval_config to its exact storage shape, or null when the feature is off. */
function normalize_approval_config(config) {
  if (!config || config.enabled !== true) return null;
  if (is_legacy_config(config)) {
    return {
      enabled: true,
      mode: config.mode,
      approvers: config.approvers.map((approver) => ({
        name: approver.name.toString().trim(),
        role: approver.role.toString().trim(),
        email: approver.email.toString().trim().toLowerCase(),
        message: (approver.message || "").toString().trim(),
        on_reject: ON_REJECT_OPTIONS.includes(approver.on_reject) ? approver.on_reject : "stop",
      })),
    };
  }
  return {
    enabled: true,
    approvers: config.approvers.map((approver) => {
      const located = has_location(approver);
      return {
        name: approver.name.toString().trim(),
        role: approver.role.toString().trim(),
        email: approver.email.toString().trim().toLowerCase(),
        message: (approver.message || "").toString().trim(),
        level: located ? approver.level : null,
        location_id: located ? Number(approver.location_id) : null,
        location_name: located ? (approver.location_name || "").toString().trim() : "",
        conditions: Array.isArray(approver.conditions)
          ? approver.conditions.map((condition) => ({
              field_id: condition.field_id.toString().trim(),
              value: condition.value.toString().trim(),
            }))
          : [],
        force: approver.force !== false,
        on_reject: ON_REJECT_OPTIONS.includes(approver.on_reject) ? approver.on_reject : "stop",
      };
    }),
  };
}

/**
 * Builds a fresh per-submission approval state, minting one unguessable token per approver.
 * An approver joins the flow when their location (if set) is in the submission's
 * location_chain AND every "field equals value" condition (if any) matches the submitted
 * data; an approver with neither always joins. The signing order is exactly the order the
 * form author listed the approvers in. Returns null when nothing needs approval.
 */
function build_approval_state(config, location_chain, submission_data) {
  if (!config || config.enabled !== true) return null;

  let selected = config.approvers;
  if (!is_legacy_config(config)) {
    const chain_ids = new Set((location_chain || []).map(Number));
    selected = config.approvers.filter(
      (approver) =>
        (!has_location(approver) || chain_ids.has(Number(approver.location_id))) &&
        matches_conditions(approver.conditions, submission_data),
    );
    if (selected.length === 0) return null;
  }

  return {
    status: "pending",
    mode: config.mode,
    current_level: 0,
    steps: selected.map((approver, index) => ({
      level: index,
      name: approver.name,
      role: approver.role,
      email: approver.email,
      message: approver.message || null,
      level_type: approver.level || null,
      location: has_location(approver) ? { id: Number(approver.location_id), name: approver.location_name || "" } : null,
      conditions: Array.isArray(approver.conditions) ? approver.conditions : [],
      force: approver.force !== false,
      on_reject: approver.on_reject,
      token: crypto.randomBytes(24).toString("hex"),
      status: "pending",
      comment: null,
      signature: null,
      acted_at: null,
      notified_at: null,
      email_sent: null,
    })),
  };
}

/**
 * Every step currently allowed to act. A pending force-ON step gates everything after it;
 * a pending force-OFF step lets the chain flow past it, so its successor is active at the
 * same time. Legacy states: parallel keeps everyone active, and sequential steps have no
 * force flag, which reads as force ON - exactly the old one-at-a-time behavior.
 */
function get_active_steps(approval) {
  if (!approval || approval.status !== "pending") return [];
  if (approval.mode === "parallel") return approval.steps.filter((step) => step.status === "pending");
  const active = [];
  for (const step of approval.steps) {
    if (step.status !== "pending") continue;
    active.push(step);
    if (step.force !== false) break;
  }
  return active;
}

/** True when this step's approver is currently allowed to approve or reject. */
function can_step_act(approval, step) {
  if (!approval || approval.status !== "pending" || step.status !== "pending") return false;
  return get_active_steps(approval).some((entry) => entry.token === step.token);
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

  const next_pending = approval.steps.find((entry) => entry.status === "pending");
  if (next_pending) {
    approval.current_level = next_pending.level;
    return approval;
  }

  // Flow complete: finalized as approved only when every approver approved.
  approval.status = approval.steps.every((entry) => entry.status === "approved") ? "approved" : "rejected";
  return approval;
}

/** Public trail view of every step - never exposes any step's token. */
function public_approval_trail(approval) {
  return approval.steps.map((step) => ({
    level: step.level,
    name: step.name,
    role: step.role,
    level_type: step.level_type || null,
    location: step.location || null,
    conditions: step.conditions || [],
    force: step.force !== false,
    status: step.status,
    comment: step.comment,
    signature: step.signature ? { kind: step.signature.kind, file: step.signature.file } : null,
    acted_at: step.acted_at,
  }));
}

module.exports = {
  APPROVER_LEVELS,
  validate_approval_config,
  normalize_approval_config,
  build_approval_state,
  can_step_act,
  apply_approval_decision,
  get_active_steps,
  public_approval_trail,
};
