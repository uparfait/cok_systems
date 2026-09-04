const crypto = require("crypto");
const forms_model = require("../models/forms_model.js");
const submissions_model = require("../models/submissions_model.js");
const approval_requests_model = require("../models/approval_requests_model.js");
const approval_schedules_model = require("../models/approval_schedules_model.js");
const { send_batch_approval_email } = require("./approval_email.js");
const config = require("../configurations/config.js");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BATCH_APPROVERS = 20;
const MAX_OTP_ATTEMPTS = 10;
const TRIGGER_TYPES = ["count", "datetime"];

/** A 6-digit one-time code the approver types back from their email to authorize a decision. */
function generate_otp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

/** Validates the approvers list a form author entered in the scheduling dialog. */
function validate_batch_approvers(approvers) {
  const errors = [];
  if (!Array.isArray(approvers) || approvers.length === 0) {
    errors.push("at least one approver email is required");
    return { valid: false, errors };
  }
  if (approvers.length > MAX_BATCH_APPROVERS) errors.push(`approvers cannot exceed ${MAX_BATCH_APPROVERS}`);
  const seen_emails = new Set();
  approvers.forEach((approver, index) => {
    const email = approver && approver.email ? approver.email.toString().trim().toLowerCase() : "";
    if (!EMAIL_REGEX.test(email)) errors.push(`approver ${index + 1} is missing a valid email`);
    if (seen_emails.has(email)) errors.push(`approver ${index + 1} repeats the email ${email}`);
    seen_emails.add(email);
  });
  return { valid: errors.length === 0, errors };
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

/** Exact storage shape of an approvers list: trimmed name, lowercased email. */
function normalize_batch_approvers(approvers) {
  return approvers.map((approver) => ({
    name: (approver.name || "").toString().trim(),
    email: approver.email.toString().trim().toLowerCase(),
  }));
}

/** The origin batch links are built on when there is no browser request to read it from (interval runner, submit hook). */
function fallback_origin() {
  const configured = Array.isArray(config.client_url_set) ? config.client_url_set[0] : config.client_url_set;
  return (configured || "").replace(/\/+$/, "");
}

/**
 * Fires one batch approval request: gathers every submission of the form
 * not yet covered by a previous batch, mints a link token and one-time
 * code per approver, emails each approver their link and code, and stamps
 * the covered submissions. Returns { sent: false } when there is nothing
 * to approve, so a scheduled fire on an empty form quietly sends nothing.
 */
async function fire_batch_approval({ form_group_id, approvers, origin, source, created_by }) {
  const form_version = await forms_model.get_latest_version(form_group_id);
  if (!form_version) return { sent: false, reason: "form_not_found" };

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
    approvers: normalize_batch_approvers(approvers).map((approver) => ({
      name: approver.name,
      email: approver.email,
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

  const base_origin = (origin || fallback_origin()).replace(/\/+$/, "");
  for (const approver of request.approvers) {
    const link = `${base_origin}/dcs-batch-approval/${approver.token}`;
    // Development visibility: the exact email, link and one-time code of every approver, straight in the backend console.
    console.log("\n========== BATCH APPROVAL LINK ==========");
    console.log(`Form:      ${form_version.form_name}`);
    console.log(`Records:   ${submission_ids.length}`);
    console.log(`Approver:  ${approver.name || "-"} <${approver.email}>`);
    console.log(`Link:      ${link}`);
    console.log(`OTP:       ${approver.otp}`);
    console.log("=========================================\n");

    const result = await send_batch_approval_email({
      to: approver.email,
      approver_name: approver.name,
      form_name: form_version.form_name,
      record_count: submission_ids.length,
      link,
      otp: approver.otp,
      origin: base_origin,
    });
    approver.notified_at = new Date();
    approver.email_sent = result.success;
  }
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
      approvers: schedule.approvers,
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

/** Resolves a batch's overall status after a decision: any rejection rejects it, unanimous approval approves it. */
function resolve_request_status(request) {
  if (request.approvers.some((approver) => approver.status === "rejected")) return "rejected";
  if (request.approvers.every((approver) => approver.status === "approved")) return "approved";
  return "pending";
}

/** Public trail of a batch's approvers - never exposes any token or one-time code. */
function public_batch_trail(request) {
  return request.approvers.map((approver) => ({
    name: approver.name,
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
  validate_batch_approvers,
  validate_trigger,
  normalize_batch_approvers,
  fire_batch_approval,
  fire_claimed_schedule,
  check_count_triggers,
  is_otp_valid,
  resolve_request_status,
  public_batch_trail,
};
