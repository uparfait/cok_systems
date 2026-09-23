const forms_model = require("../../models/forms_model.js");
const tracked_records_model = require("../../models/tracked_records_model.js");
const { validate_submission_data } = require("../../jsonlogic/validate_submission.js");
const { flatten_fields } = require("../../jsonlogic/dependency_graph.js");
const { approval_for_record, notify_new_approval } = require("../../utilities/submission_approval.js");
const { check_count_triggers } = require("../../utilities/batch_approval.js");
const { resolve_client_origin } = require("../../utilities/approval_email.js");
const { sanitize_respondent } = require("../../utilities/respondent.js");
const { is_enabled, diff_editable, next_periods } = require("../../utilities/tracking.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Public, no-auth update of ONE record of a tracked form: only the fields
 * the author marked as updatable may change, everything else the record
 * holds stays exactly as it was. The merged answers are re-validated with
 * the ACTIVE version's rules, and only errors on the updatable fields are
 * reported (a locked field cannot be fixed from here). Every change is
 * appended to the record's history with the moment it happened and who
 * made it, and each changed field's value period is closed and a new one
 * opened at that same moment - which is what the dashboards read when
 * asked for a value at a past date.
 *
 * When the form has an approval flow, the changed record goes through it
 * again, exactly like a fresh submission would.
 */
async function update_public_record(req, res) {
  try {
    const { form_group_id, submission_id } = req.params;
    const { data, respondent } = req.body || {};

    if (!form_group_id || !submission_id) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }

    const form_version = await forms_model.get_active_version(form_group_id);
    if (!form_version) {
      return res.status(404).json(warning_response(req, "FORM_PUBLIC_NOT_FOUND"));
    }
    const tracking = form_version.tracking;
    if (!is_enabled(tracking)) {
      return res.status(400).json(warning_response(req, "TRACKING_NOT_ENABLED"));
    }

    const record = await tracked_records_model.find_record(form_group_id, submission_id);
    if (!record) {
      return res.status(404).json(warning_response(req, "SUBMISSION_NOT_FOUND"));
    }

    // Only the updatable fields are read from the payload; the key and
    // every locked field keep the record's own stored answer.
    const incoming = data && typeof data === "object" ? data : {};
    const merged = Object.assign({}, record.data || {});
    (tracking.editable_field_ids || []).forEach((field_id) => {
      if (field_id in incoming) merged[field_id] = incoming[field_id];
    });

    const validation_result = validate_submission_data(form_version.schema, merged, req.language);
    const editable_errors = {};
    Object.keys(validation_result.field_errors || {}).forEach((field_id) => {
      if ((tracking.editable_field_ids || []).includes(field_id)) editable_errors[field_id] = validation_result.field_errors[field_id];
    });
    const blocking = Object.keys(editable_errors).some((field_id) => editable_errors[field_id].some((entry) => typeof entry === "string" || entry.severity === "error"));
    if (blocking) {
      return res.status(422).json(warning_response(req, "SUBMISSION_VALIDATION_FAILED", null, { field_errors: editable_errors }));
    }

    // The derived answers (computed fields) follow the merged data, but the
    // key and every other locked field are pinned back to what the record holds.
    const computed_ids = new Set(
      flatten_fields(form_version.schema.fields || [])
        .filter((field) => field && field.computed && field.computed.enabled === true)
        .map((field) => field.id),
    );
    const next_data = Object.assign({}, validation_result.resolved_data);
    Object.keys(record.data || {}).forEach((field_id) => {
      if (!(tracking.editable_field_ids || []).includes(field_id) && !computed_ids.has(field_id)) next_data[field_id] = record.data[field_id];
    });

    const changes = diff_editable(tracking, record.data || {}, next_data);
    if (changes.length === 0) {
      return res.status(400).json(warning_response(req, "TRACKING_NO_CHANGES"));
    }

    const now = new Date();
    const by = sanitize_respondent(respondent);
    const routing = await approval_for_record(form_group_id, form_version, next_data);
    const notified_steps = await notify_new_approval(req, form_version.form_name, routing.approval);

    await tracked_records_model.apply_record_update(record._id, {
      data: next_data,
      version: form_version.version,
      updated_at: now,
      tracking_periods: next_periods(record.tracking_periods, changes, now, record.submitted_at),
      history_entry: {
        at: now,
        kind: "updated",
        by,
        changes,
        approval_before: record.approval ? record.approval.status : null,
      },
      approval: routing.approval,
      clear_request: routing.scheduled,
    });

    // A running "after N responses" schedule counts the changed record again.
    await check_count_triggers(form_group_id, resolve_client_origin(req));

    const updated = await tracked_records_model.find_record(form_group_id, submission_id);
    const view = tracked_records_model.to_public_record(updated);
    if (routing.approval) {
      view.approval = {
        status: routing.approval.status,
        mode: routing.approval.mode,
        approver_count: routing.approval.steps.length,
        active_links: (notified_steps || []).map((step) => ({ level: step.level, name: step.name, role: step.role, email_sent: step.email_sent })),
      };
    }
    return res.status(200).json(success_response(req, "TRACKING_RECORD_UPDATED", view));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = update_public_record;
