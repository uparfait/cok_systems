const crypto = require("crypto");
const forms_model = require("../models/forms_model.js");
const submissions_model = require("../models/submissions_model.js");
const approval_requests_model = require("../models/approval_requests_model.js");
const approval_schedules_model = require("../models/approval_schedules_model.js");
const { send_batch_approval_email } = require("./approval_email.js");
const config = require("../configurations/config.js");

const MAX_OTP_ATTEMPTS = 10;
const TRIGGER_TYPES = ["count", "datetime"];

/** A 6-digit one-time code the approver types back from their email to authorize a decision. */
function generate_otp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

/** Validates the trigger settings ("after N responses" or "at a date and time"). */
function validate_trigger(trigger) {
  const errors = [];
  if (!trigger || !TRIGGER_TYPES.includes(trigger.type)) {
    errors.push("trigger.type must be count or datetime");
    return { valid: false, errors };
  }
  if (trigger.type === "count" && (!Number.isFinite(Number(trigger.count)) || Number(trigger.count) < 1)) {
    errors.push("trigger.count must be a number of responses of at least 1");
  }
  if (trigger.type === "datetime") {
    const moment = new Date(trigger.datetime);
    if (Number.isNaN(moment.getTime())) errors.push("trigger.datetime must be a valid date and time");
    else if (moment.getTime() <= Date.now()) errors.push("trigger.datetime must be in the future");
  }
  return { valid: errors.length === 0, errors };
}

/**
 * The approvers a batch is routed to: exactly the ones the form author
 * configured (in order) in the form's approval flow settings - the
 * scheduling dialog never collects its own list. Location/condition
 * routing is per-submission by nature and doesn't apply to a whole batch,
 * so every configured approver joins.
 */
function get_form_batch_approvers(form_version) {
  const approval_config = form_version && form_version.approval_config;
  if (!approval_config || !Array.isArray(approval_config.approvers)) return [];
  return approval_config.approvers
    .filter((approver) => approver && approver.email)
    .map((approver) => ({
      name: (approver.name || "").toString().trim(),
      role: (approver.role || "").toString().trim(),
      email: approver.email.toString().trim().toLowerCase(),
      message: (approver.message || "").toString().trim(),
      force: approver.force !== false,
      on_reject: approver.on_reject === "continue" ? "continue" : "stop",
    }));
}

/** The origin batch links are built on when there is no browser request to read it from (interval runner, submit hook). */
function fallback_origin() {
  const configured = Array.isArray(config.client_url_set) ? config.client_url_set[0] : config.client_url_set;
  return (configured || "").replace(/\/+$/, "");
}

/**
 * Every batch approver currently allowed to act - same hierarchy rule as
 * the per-submission flow: approvers act in the order the form author
 * listed them, a pending force-ON approver gates everyone after them, and
 * a pending force-OFF approver lets the chain flow past.
 */
function get_active_batch_steps(request) {
  if (!request || request.status !== "pending") return [];
  const active = [];
  for (const approver of request.approvers) {
    if (approver.status !== "pending") continue;
    active.push(approver);
    if (approver.force !== false) break;
  }
  return active;
}

/** True when this batch approver is currently allowed to approve or reject. */
function can_batch_step_act(request, approver) {
  if (!request || request.status !== "pending" || approver.status !== "pending") return false;
  return get_active_batch_steps(request).some((entry) => entry.token === approver.token);
}

/**
 * Applies one batch approver's decision and resolves the overall batch
 * state, mirroring the per-submission flow: a rejection by a "stop"
 * approver rejects the whole batch and skips everyone still pending;
 * otherwise the chain moves on, and the batch is approved only when every
 * approver approved.
 */
function apply_batch_decision(request, approver, decision, comment) {
  approver.status = decision === "approve" ? "approved" : "rejected";
  approver.comment = comment || null;
  approver.acted_at = new Date();

  if (decision === "reject" && approver.on_reject === "stop") {
    request.status = "rejected";
    request.approvers.forEach((entry) => {
      if (entry.status === "pending") entry.status = "skipped";
    });
    return request;
  }

  if (request.approvers.some((entry) => entry.status === "pending")) return request;

  request.status = request.approvers.every((entry) => entry.status === "approved") ? "approved" : "rejected";
  return request;
}

/**
 * Emails the given batch approvers their link and one-time code, printing
 * each one to the backend console (development visibility while the mail
 * service is down), and stamps them notified. Mutates the given approver
 * objects; the caller persists the request.
 */
async function notify_batch_steps(request, steps, origin) {
  const base_origin = (origin || fallback_origin()).replace(/\/+$/, "");
  for (const approver of steps) {
    const link = `${base_origin}/dcs-batch-approval/${approver.token}`;
    console.log("\n========== BATCH APPROVAL LINK ==========");
    console.log(`Form:      ${request.form_name}`);
    console.log(`Records:   ${request.submission_count}`);
    console.log(`Approver:  ${approver.name || "-"} (${approver.role || "-"}) <${approver.email}>`);
    console.log(`Link:      ${link}`);
    console.log(`OTP:       ${approver.otp}`);

    const result = await send_batch_approval_email({
      to: approver.email,
      approver_name: approver.name,
      form_name: request.form_name,
      record_count: request.submission_count,
      link,
      otp: approver.otp,
      message: approver.message || "",
      origin: base_origin,
    });
    console.log(`Email:     ${result.success ? "sent" : `FAILED - ${result.error || "unknown error"}`}`);
    console.log("=========================================\n");

    approver.notified_at = new Date();
    approver.email_sent = result.success;
  }
}

/**
 * Fires one batch approval request: gathers every submission of the form
 * not yet covered by a previous batch, builds the approver chain from the
 * form's own approval flow settings (same order, force and on-reject
 * rules), and notifies only the approvers whose turn it is - the rest are
 * emailed as the chain advances. Returns { sent: false } when there is
 * nothing to approve or the form has no approvers configured.
 */
async function fire_batch_approval({ form_group_id, origin, source, created_by }) {
  const form_version = await forms_model.get_latest_version(form_group_id);
  if (!form_version) return { sent: false, reason: "form_not_found" };

  const configured_approvers = get_form_batch_approvers(form_version);
  if (configured_approvers.length === 0) return { sent: false, reason: "no_approvers" };

  const submission_ids = await submissions_model.list_ids_without_approval_request(form_group_id);
  if (submission_ids.length === 0) return { sent: false, reason: "no_data" };

  const request = await approval_requests_model.create_request({
    form_group_id,
    project_id: form_version.project_id,
    form_name: form_version.form_name,
    submission_count: submission_ids.length,
    status: "pending",
    source: source || "manual",
    created_by: created_by || null,
    approvers: configured_approvers.map((approver, index) => ({
      level: index,
      name: approver.name,
      role: approver.role,
      email: approver.email,
      message: approver.message || null,
      force: approver.force,
      on_reject: approver.on_reject,
      token: crypto.randomBytes(24).toString("hex"),
      otp: generate_otp(),
      otp_attempts: 0,
      status: "pending",
      comment: null,
      acted_at: null,
      notified_at: null,
      email_sent: null,
    })),
  });

  await submissions_model.assign_approval_request(submission_ids, request._id);

  // Only whoever may act right now is notified - the hierarchy decides who hears about it next, and when.
  await notify_batch_steps(request, get_active_batch_steps(request), origin);
  await approval_requests_model.update_request(request._id, { approvers: request.approvers });

  return { sent: true, request, sent_count: submission_ids.length };
}

/**
 * Fires one claimed schedule and records its outcome; on an unexpected
 * failure the claim is released so the schedule can fire again later.
 */
async function fire_claimed_schedule(schedule, origin) {
  try {
    const result = await fire_batch_approval({
      form_group_id: schedule.form_group_id,
      origin,
      source: schedule.trigger.type,
      created_by: schedule.created_by || null,
    });
    await approval_schedules_model.mark_schedule_sent(schedule._id, result.request ? result.request._id : null, result.sent_count || 0);
    return result;
  } catch (error) {
    console.error("Batch approval schedule fire failed:", error.message);
    await approval_schedules_model.release_schedule(schedule._id);
    return { sent: false, reason: "error" };
  }
}

/**
 * Called after every stored submission: fires any waiting "after N
 * responses" schedule of this form whose threshold the form has now
 * reached. Never throws - a trigger failure must never fail the
 * submission itself.
 */
async function check_count_triggers(form_group_id, origin) {
  try {
    const schedules = await approval_schedules_model.find_count_schedules(form_group_id);
    if (schedules.length === 0) return;
    const total = await submissions_model.count_by_form_group_id(form_group_id);
    for (const schedule of schedules) {
      if (total < Number(schedule.trigger.count)) continue;
      const claimed = await approval_schedules_model.claim_schedule_for_sending(schedule._id);
      if (claimed) await fire_claimed_schedule(schedule, origin);
    }
  } catch (error) {
    console.error("Batch approval count trigger check failed:", error.message);
  }
}

/** True when this approver still has attempts left and the given code is theirs. */
function is_otp_valid(approver, otp) {
  return approver.otp_attempts < MAX_OTP_ATTEMPTS && String(otp || "").trim() === approver.otp;
}

/** Public trail of a batch's approvers - never exposes any token or one-time code. */
function public_batch_trail(request) {
  return request.approvers.map((approver) => ({
    level: approver.level,
    name: approver.name,
    role: approver.role,
    email: approver.email,
    status: approver.status,
    comment: approver.comment,
    acted_at: approver.acted_at,
    notified_at: approver.notified_at,
    email_sent: approver.email_sent,
  }));
}

module.exports = {
  MAX_OTP_ATTEMPTS,
  validate_trigger,
  get_form_batch_approvers,
  get_active_batch_steps,
  can_batch_step_act,
  apply_batch_decision,
  notify_batch_steps,
  fire_batch_approval,
  fire_claimed_schedule,
  check_count_triggers,
  is_otp_valid,
  public_batch_trail,
};
