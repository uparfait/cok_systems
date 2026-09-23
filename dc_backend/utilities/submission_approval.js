const approval_schedules_model = require("../models/approval_schedules_model.js");
const { build_approval_state, get_active_steps } = require("./approval.js");
const { config_with_generated_for_submission } = require("./generated_approvers.js");
const { resolve_location_chain } = require("./approval_routing.js");
const { notify_approval_steps } = require("./approval_email.js");

/**
 * The approval a record needs under the form's flow RIGHT NOW - the same
 * routing a fresh submission gets (see controllers/submissions/
 * submit_response.js): an active batch schedule means no per-record
 * approval at all (the schedule collects the record later); otherwise the
 * form's approvers plus the generated ones the answers match, scoped by
 * the answered location.
 *
 * Returns { scheduled, approval }: scheduled true when a schedule is
 * running, approval null when nothing needs signing.
 */
async function approval_for_record(form_group_id, form_version, resolved_data) {
  const active_schedule = await approval_schedules_model.get_active_schedule(form_group_id);
  if (active_schedule) return { scheduled: true, approval: null };
  const effective_config = await config_with_generated_for_submission(form_group_id, form_version.approval_config, resolved_data);
  const location_chain = effective_config && effective_config.enabled === true ? await resolve_location_chain(resolved_data) : [];
  return { scheduled: false, approval: build_approval_state(effective_config, location_chain, resolved_data) };
}

/**
 * Emails every approver allowed to act now and stamps notified_at /
 * email_sent onto their steps. Returns the notified steps for the
 * submitter's view; an approval of null notifies nobody.
 */
async function notify_new_approval(req, form_name, approval) {
  if (!approval) return null;
  const steps_to_notify = get_active_steps(approval).filter((step) => !step.notified_at);
  const notified_steps = await notify_approval_steps(req, form_name, steps_to_notify);
  const sent_by_token = new Map(notified_steps.map((entry) => [entry.token, entry.email_sent]));
  approval.steps.forEach((step) => {
    if (sent_by_token.has(step.token)) {
      step.notified_at = new Date();
      step.email_sent = sent_by_token.get(step.token);
    }
  });
  return notified_steps;
}

module.exports = { approval_for_record, notify_new_approval };
