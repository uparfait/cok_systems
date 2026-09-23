import { enqueue_submission, update_queue_item, remove_from_queue, list_queue, submit_direct, generate_client_submission_id } from "../offline/submissionQueue.js";
import { save_form_draft, clear_form_draft, has_meaningful_answers } from "../offline/draftStore.js";
import { compute_derived_values } from "../renderer/formEngine.js";
import { validate_submission_client_side } from "../jsonlogic/validateSubmission.js";
import { scroll_to_first_error } from "../renderer/scrollToError.js";
import { update_public_record } from "../tracking/trackingService.js";

/** Only the updatable fields' errors count when a loaded record is being updated - a locked field cannot be fixed. */
function editable_errors_only(field_errors, tracking) {
  const allowed = new Set((tracking.tracking && tracking.tracking.editable_field_ids) || []);
  const kept = {};
  Object.keys(field_errors || {}).forEach((field_id) => {
    if (allowed.has(field_id)) kept[field_id] = field_errors[field_id];
  });
  return kept;
}

const has_blocking = (field_errors) => Object.keys(field_errors).some((field_id) => field_errors[field_id].some((entry) => typeof entry === "string" || entry.severity === "error"));

/**
 * The public page's submit flow: validate, then either send straight to the
 * server, or - offline, or when the network fails mid-way - save the exact
 * response on the device for the sync loop, telling the respondent plainly
 * that it has NOT been sent yet. A definitive server rejection keeps the
 * response on the device as an error record to fix and resubmit. Every
 * response carries who filled it in (respondent).
 */
export function usePublicSubmit(context) {
  const {
    form,
    form_group_id,
    language,
    translate,
    values,
    respondent,
    reviewing_queue_id_ref,
    refresh_queue,
    refresh_draft,
    showSuccess,
    showError,
    showWarning,
    tracking,
    set,
  } = context;

  // A record loaded from the tracked records is UPDATED in place: only the
  // updatable fields travel, the server keeps every change with its time.
  // It needs the connection - there is no offline queue for an update.
  const handle_update = async (resolved_values, field_errors) => {
    const editable_errors = editable_errors_only(field_errors, tracking);
    set.field_errors(editable_errors);
    if (has_blocking(editable_errors)) {
      set.reveal_all_errors(true);
      set.submit_state("error");
      window.requestAnimationFrame(() => scroll_to_first_error(Object.keys(editable_errors)));
      return;
    }
    if (!window.navigator.onLine) {
      showError(translate("DCS_TRACKING_UPDATE_NEEDS_CONNECTION"));
      return;
    }
    set.is_syncing(true);
    set.sync_kind("direct");
    try {
      const response = await update_public_record(form_group_id, tracking.loaded_record._id, resolved_values, respondent);
      const record = response.data || null;
      if (record && record.approval && Array.isArray(record.approval.active_links) && record.approval.active_links.length > 0) {
        set.approval_notices((previous) => previous.concat([{ form_group_id, mode: record.approval.mode, links: record.approval.active_links }]));
      }
      if (record) tracking.record_updated(record);
      set.reveal_all_errors(false);
      set.submit_state("success_updated");
      showSuccess(response.message || translate("DCS_TRACKING_UPDATED_TITLE"));
    } catch (update_error) {
      if (update_error && update_error.field_errors) {
        set.field_errors(update_error.field_errors);
        set.reveal_all_errors(true);
      }
      set.submit_state("error");
      showError((update_error && update_error.message) || translate("DCS_ERROR_GENERIC"));
    } finally {
      set.is_syncing(false);
      set.sync_kind(null);
    }
  };

  const handle_submit = async () => {
    set.submitting(true);
    try {
      const derived_values = compute_derived_values(form.schema, values);
      const validation_result = validate_submission_client_side(form.schema, derived_values, language, translate);
      const resolved_values = validation_result.resolved_data;
      set.field_errors(validation_result.field_errors);
      set.field_valid_messages(validation_result.field_valid_messages);
      const is_tracked = !!(tracking && tracking.enabled);
      if (is_tracked && tracking.loaded_record) {
        await handle_update(resolved_values, validation_result.field_errors);
        return;
      }
      if (!validation_result.valid) {
        set.reveal_all_errors(true);
        set.submit_state("error");
        const unanswered = Object.keys(validation_result.field_errors || {});
        window.requestAnimationFrame(() => scroll_to_first_error(unanswered));
        if (!reviewing_queue_id_ref.current && !is_tracked && has_meaningful_answers(resolved_values, form.schema)) {
          await save_form_draft(form_group_id, form.version, resolved_values);
          await refresh_draft();
        }
        return;
      }

      // A tracked form's record is created on the server in one go, while
      // connected: nothing is queued or kept for later, the answers stay on
      // screen and the person retries until it goes through.
      if (is_tracked && !window.navigator.onLine) {
        set.submit_state("error");
        showError(translate("DCS_TRACKING_SUBMIT_NEEDS_CONNECTION"));
        return;
      }

      const reviewing_id = reviewing_queue_id_ref.current;
      let reviewing_record = null;
      if (reviewing_id) {
        const current_queue = await list_queue();
        reviewing_record = current_queue.find((item) => item.id === reviewing_id) || null;
      }
      const client_submission_id = reviewing_record ? reviewing_record.client_submission_id : generate_client_submission_id();

      const store_for_later = async (data_to_store) => {
        if (reviewing_record) {
          await update_queue_item(reviewing_record.id, {
            data: data_to_store,
            version: form.version,
            respondent: respondent || reviewing_record.respondent || null,
            status: "pending",
            field_errors: null,
            updated_at: new Date().toISOString(),
          });
        } else {
          await enqueue_submission(form_group_id, form.version, data_to_store, { client_submission_id, respondent });
          await clear_form_draft(form_group_id);
          await refresh_draft();
        }
        await refresh_queue();
      };

      const reset_after_submit = (was_sent_immediately) => {
        reviewing_queue_id_ref.current = null;
        set.values({});
        set.field_errors({});
        set.field_valid_messages({});
        set.reveal_all_errors(false);
        set.render_reset_key((previous_key) => previous_key + 1);
        set.submit_state(was_sent_immediately ? "success_submitted" : "success_offline");
        if (was_sent_immediately) {
          showSuccess(translate("DCS_PUBLIC_DATA_RECORDED"));
        } else {
          set.queued_notice_visible(true);
        }
      };

      if (!window.navigator.onLine) {
        await store_for_later(resolved_values);
        reset_after_submit(false);
        return;
      }

      set.is_syncing(true);
      set.sync_kind("direct");
      try {
        const direct_result = await submit_direct(
          form_group_id,
          form.version,
          resolved_values,
          client_submission_id,
          ({ percent }) => set.file_upload_percent(percent),
          respondent,
        );

        if (reviewing_record) {
          await remove_from_queue(reviewing_record.id);
        } else {
          await clear_form_draft(form_group_id);
          await refresh_draft();
        }
        await refresh_queue();

        const approval = direct_result.response && direct_result.response.data && direct_result.response.data.approval;
        if (approval && Array.isArray(approval.active_links) && approval.active_links.length > 0) {
          set.approval_notices((previous) => previous.concat([{ form_group_id, mode: approval.mode, links: approval.active_links }]));
        }

        reset_after_submit(true);
      } catch (direct_error) {
        const failed_data = (direct_error && direct_error.partial_data) || resolved_values;

        if (direct_error && direct_error.is_network_error) {
          if (is_tracked) {
            set.values(failed_data);
            set.submit_state("error");
            showError(translate("DCS_TRACKING_SUBMIT_RETRY"));
            return;
          }
          await store_for_later(failed_data);
          reset_after_submit(false);
          return;
        }

        // A tracked form whose key must be unique already holds a record
        // with this key: nothing is queued, the record finder opens on it
        // so the existing record can be loaded and updated instead.
        if (direct_error && direct_error.status_code === 409 && direct_error.record_key && tracking) {
          // Not a mistake, a redirection: the answers stay, the finder opens.
          set.values(failed_data);
          set.field_errors({});
          set.submit_state("idle");
          showWarning(direct_error.message || translate("DCS_TRACKING_KEY_EXISTS"));
          tracking.open_lookup(direct_error.record_key);
          return;
        }

        const server_field_errors = (direct_error && direct_error.field_errors) || null;
        // A tracked form keeps no error record either: it is fixed and resubmitted here.
        if (!is_tracked && reviewing_record) {
          await update_queue_item(reviewing_record.id, {
            data: failed_data,
            version: form.version,
            status: "error",
            field_errors: server_field_errors,
            updated_at: new Date().toISOString(),
          });
        } else if (!is_tracked) {
          const error_item = await enqueue_submission(form_group_id, form.version, failed_data, {
            client_submission_id,
            respondent,
            status: "error",
            field_errors: server_field_errors,
          });
          reviewing_queue_id_ref.current = error_item.id;
          await clear_form_draft(form_group_id);
          await refresh_draft();
        }
        await refresh_queue();

        set.values(failed_data);
        set.field_errors(server_field_errors || {});
        set.field_valid_messages({});
        set.reveal_all_errors(true);
        set.submit_state("error");
        showError((direct_error && direct_error.message) || translate("DCS_ERROR_GENERIC"));
      } finally {
        set.is_syncing(false);
        set.sync_kind(null);
        set.file_upload_percent(null);
      }
    } catch (submit_error) {
      set.submit_state("error");
      showError(submit_error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      set.submitting(false);
    }
  };

  return { handle_submit };
}
