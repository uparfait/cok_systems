import { enqueue_submission, update_queue_item, remove_from_queue, list_queue, submit_direct, generate_client_submission_id } from "../offline/submissionQueue.js";
import { save_form_draft, clear_form_draft } from "../offline/draftStore.js";
import { compute_derived_values } from "../renderer/formEngine.js";
import { validate_submission_client_side } from "../jsonlogic/validateSubmission.js";
import { scroll_to_first_error } from "../renderer/scrollToError.js";

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
    set,
  } = context;

  const handle_submit = async () => {
    set.submitting(true);
    try {
      const derived_values = compute_derived_values(form.schema, values);
      const validation_result = validate_submission_client_side(form.schema, derived_values, language, translate);
      const resolved_values = validation_result.resolved_data;
      set.field_errors(validation_result.field_errors);
      set.field_valid_messages(validation_result.field_valid_messages);
      if (!validation_result.valid) {
        set.reveal_all_errors(true);
        set.submit_state("error");
        const unanswered = Object.keys(validation_result.field_errors || {});
        window.requestAnimationFrame(() => scroll_to_first_error(unanswered));
        if (!reviewing_queue_id_ref.current) {
          await save_form_draft(form_group_id, form.version, resolved_values);
          await refresh_draft();
        }
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
          await store_for_later(failed_data);
          reset_after_submit(false);
          return;
        }

        const server_field_errors = (direct_error && direct_error.field_errors) || null;
        if (reviewing_record) {
          await update_queue_item(reviewing_record.id, {
            data: failed_data,
            version: form.version,
            status: "error",
            field_errors: server_field_errors,
            updated_at: new Date().toISOString(),
          });
        } else {
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
