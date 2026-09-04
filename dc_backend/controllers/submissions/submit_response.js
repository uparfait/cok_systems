const forms_model = require("../../models/forms_model.js");
const submissions_model = require("../../models/submissions_model.js");
const { validate_submission_data } = require("../../jsonlogic/validate_submission.js");
const { build_approval_state, get_active_steps } = require("../../utilities/approval.js");
const { resolve_location_chain } = require("../../utilities/approval_routing.js");
const { notify_approval_steps, resolve_client_origin } = require("../../utilities/approval_email.js");
const { check_count_triggers } = require("../../utilities/batch_approval.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/** Strips every step token; a failed email's link is only ever printed to the backend console, never handed to the browser. */
function to_submitter_view(submission, notified_steps) {
  if (!submission.approval) return submission;
  const active_links = (notified_steps || get_active_steps(submission.approval).map((step) => Object.assign({ email_sent: true }, step))).map(
    (step) => ({
      level: step.level,
      name: step.name,
      role: step.role,
      email_sent: step.email_sent,
    }),
  );
  const approval = {
    status: submission.approval.status,
    mode: submission.approval.mode,
    approver_count: submission.approval.steps.length,
    active_links,
  };
  return Object.assign({}, submission, { approval });
}

/**
 * Public, no-auth submission endpoint. Re-validates the payload against the
 * exact form version the client originally fetched, using the same
 * JSONLogic rules as the browser, so tampered or offline-stale submissions
 * can never bypass validation.
 */
async function submit_response(req, res) {
  try {
    const { form_group_id } = req.params;
    const { version, data, client_submission_id } = req.body || {};

    if (!form_group_id || version === undefined || version === null) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }

    if (client_submission_id) {
      const existing_submission = await submissions_model.find_by_client_submission_id(client_submission_id);
      if (existing_submission) {
        return res.status(200).json(success_response(req, "SUBMISSION_CREATED", to_submitter_view(existing_submission)));
      }
    }

    const form_version = await forms_model.get_version_document(form_group_id, version);
    if (!form_version) {
      return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    }

    const validation_result = validate_submission_data(form_version.schema, data || {}, req.language);
    if (!validation_result.valid) {
      return res.status(422).json(
        warning_response(req, "SUBMISSION_VALIDATION_FAILED", null, { field_errors: validation_result.field_errors }),
      );
    }

    // The submission's answered location names resolve to its location_id chain, which picks the approvers responsible for it.
    const location_chain = form_version.approval_config && form_version.approval_config.enabled === true
      ? await resolve_location_chain(validation_result.resolved_data)
      : [];

    const submission = await submissions_model.create_submission({
      form_group_id,
      version: Number(version),
      project_id: form_version.project_id,
      data: validation_result.resolved_data,
      client_submission_id: client_submission_id || null,
      approval: build_approval_state(form_version.approval_config, location_chain, validation_result.resolved_data),
    });

    // The system itself emails every approver allowed to act right away - the first one,
    // plus each one after any force-OFF approver (they are notified at the same time).
    let notified_steps = null;
    if (submission.approval) {
      const steps_to_notify = get_active_steps(submission.approval).filter((step) => !step.notified_at);
      notified_steps = await notify_approval_steps(req, form_version.form_name, steps_to_notify);
      const sent_by_token = new Map(notified_steps.map((entry) => [entry.token, entry.email_sent]));
      submission.approval.steps.forEach((step) => {
        if (sent_by_token.has(step.token)) {
          step.notified_at = new Date();
          step.email_sent = sent_by_token.get(step.token);
        }
      });
      await submissions_model.update_submission_approval(submission._id, submission.approval);
    }

    // Fires any waiting "after N responses" approval schedule this submission just satisfied; never fails the submission.
    await check_count_triggers(form_group_id, resolve_client_origin(req));

    return res.status(201).json(success_response(req, "SUBMISSION_CREATED", to_submitter_view(submission, notified_steps)));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = submit_response;
