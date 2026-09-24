const forms_model = require("../../models/forms_model.js");
const submissions_model = require("../../models/submissions_model.js");
const tracked_records_model = require("../../models/tracked_records_model.js");
const { validate_submission_data } = require("../../jsonlogic/validate_submission.js");
const { approval_for_record, notify_new_approval } = require("../../utilities/submission_approval.js");
const { check_count_triggers } = require("../../utilities/batch_approval.js");
const { resolve_client_origin } = require("../../utilities/approval_email.js");
const { sanitize_respondent } = require("../../utilities/respondent.js");
const { is_enabled, record_key_of, next_periods } = require("../../utilities/tracking.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { is_valid_object_id } = require("../../utilities/object_id.js");

/**
 * Public, no-auth full edit of ONE collected record - what the pen icon
 * on the data table opens at /dcs-form/edit/:id. Unlike the tracked
 * respondent update (controllers/submissions/update_public_record.js,
 * which may only touch the fields an author marked updatable), EVERY
 * field of the record may change here.
 *
 * The answers are re-validated against the record's own form version, so
 * an edit is held to the same rules the response was collected under.
 * Every changed field is written into the record's history with the
 * moment it happened, and on a tracked form each change also closes the
 * field's open value period and opens the next one - which is what the
 * dashboards read when asked for a value at a past date.
 *
 * A changed record goes through the form's approval flow again, exactly
 * as a fresh submission would: an edit that kept an old "approved" stamp
 * would be a signature on answers nobody signed off on.
 */

/** Every field whose answer actually differs, old and new value kept. */
function diff_all(previous_data, next_data) {
  const field_ids = new Set([...Object.keys(previous_data || {}), ...Object.keys(next_data || {})]);
  const changes = [];
  field_ids.forEach((field_id) => {
    const from = previous_data && previous_data[field_id] !== undefined ? previous_data[field_id] : null;
    const to = next_data && next_data[field_id] !== undefined ? next_data[field_id] : null;
    if (JSON.stringify(from) !== JSON.stringify(to)) changes.push({ field_id, from, to });
  });
  return changes;
}

async function update_record_full(req, res) {
  try {
    const { submission_id } = req.params;
    const { data, respondent } = req.body || {};

    if (!is_valid_object_id(submission_id)) {
      return res.status(400).json(warning_response(req, "INVALID_ID"));
    }

    const record = await submissions_model.find_submission_by_id(submission_id);
    if (!record) {
      return res.status(404).json(warning_response(req, "SUBMISSION_NOT_FOUND"));
    }

    const form_version =
      (await forms_model.get_version_document(record.form_group_id, record.version)) ||
      (await forms_model.get_active_version(record.form_group_id));
    if (!form_version) {
      return res.status(404).json(warning_response(req, "FORM_PUBLIC_NOT_FOUND"));
    }

    const incoming = data && typeof data === "object" && !Array.isArray(data) ? data : {};
    const merged = Object.assign({}, record.data || {}, incoming);

    const validation_result = validate_submission_data(form_version.schema, merged, req.language);
    if (!validation_result.valid) {
      return res.status(422).json(
        warning_response(req, "SUBMISSION_VALIDATION_FAILED", null, { field_errors: validation_result.field_errors }),
      );
    }

    const next_data = validation_result.resolved_data;
    const changes = diff_all(record.data || {}, next_data);
    if (changes.length === 0) {
      return res.status(400).json(warning_response(req, "TRACKING_NO_CHANGES"));
    }

    const tracking = form_version.tracking;
    const tracked = is_enabled(tracking);
    // A tracked form's key must stay unique when the author asked for it.
    if (tracked && tracking.key_unique) {
      const next_key = record_key_of(next_data[tracking.key_field_id]);
      if (next_key && next_key !== record.record_key) {
        const taken = await tracked_records_model.count_by_record_key(record.form_group_id, next_key);
        if (taken > 0) return res.status(409).json(warning_response(req, "TRACKING_KEY_EXISTS", { field: tracking.key_field_id }));
      }
    }

    const now = new Date();
    const by = sanitize_respondent(respondent) || record.respondent || null;
    const routing = await approval_for_record(record.form_group_id, form_version, next_data);
    const notified_steps = await notify_new_approval(req, form_version.form_name, routing.approval);

    // Only the fields the author actually tracks carry value periods; the
    // rest of an edit lives in the history entry alone.
    const tracked_changes = tracked ? changes.filter((change) => (tracking.editable_field_ids || []).includes(change.field_id)) : [];

    await tracked_records_model.apply_record_update(record._id, {
      data: next_data,
      version: form_version.version,
      updated_at: now,
      tracking_periods: tracked
        ? next_periods(record.tracking_periods, tracked_changes, now, record.submitted_at)
        : record.tracking_periods || {},
      history_entry: {
        at: now,
        kind: "edited",
        by,
        changes,
        approval_before: record.approval ? record.approval.status : null,
      },
      approval: routing.approval,
      clear_request: routing.scheduled,
    });

    if (tracked) {
      await tracked_records_model.apply_record_key(record._id, record_key_of(next_data[tracking.key_field_id]));
    }

    await check_count_triggers(record.form_group_id, resolve_client_origin(req));

    const updated = await submissions_model.find_submission_by_id(submission_id);
    const view = tracked_records_model.to_public_record(updated);
    if (routing.approval) {
      view.approval = {
        status: routing.approval.status,
        mode: routing.approval.mode,
        approver_count: routing.approval.steps.length,
        active_links: (notified_steps || []).map((step) => ({ level: step.level, name: step.name, role: step.role, email_sent: step.email_sent })),
      };
    }
    return res.status(200).json(success_response(req, "SUBMISSION_UPDATED", view));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = update_record_full;
