import { compute_derived_values } from "../../renderer/formEngine.js";
import { validate_submission_client_side } from "../../jsonlogic/validateSubmission.js";
import { scroll_to_first_error } from "../../renderer/scrollToError.js";
import { generate_client_submission_id, upload_pending_files_for_data } from "../../offline/submissionQueue.js";
import { submit_public_follow_up, public_follow_up_upload_endpoint } from "../../services/followUpService.js";

/**
 * The public follow-up form's submit: validate against the follow-up
 * schema, upload any file still held locally, then save a NEW follow-up
 * record on the server that remembers which source record it started
 * from. No offline queue here - a follow-up record is written while
 * connected or not at all.
 */
export function useFollowUpSubmit({ form, follow_up_group_id, language, translate, values, respondent, source_submission_id, showSuccess, showError, set }) {
  const handle_submit = async () => {
    set.submitting(true);
    try {
      const derived_values = compute_derived_values(form.schema, values);
      const validation_result = validate_submission_client_side(form.schema, derived_values, language, translate);
      set.field_errors(validation_result.field_errors);
      set.field_valid_messages(validation_result.field_valid_messages);
      if (!validation_result.valid) {
        set.reveal_all_errors(true);
        set.submit_state("error");
        const unanswered = Object.keys(validation_result.field_errors || {});
        window.requestAnimationFrame(() => scroll_to_first_error(unanswered));
        return;
      }
      if (!window.navigator.onLine) {
        set.submit_state("error");
        showError(translate("DCS_FU_NEEDS_CONNECTION"));
        return;
      }

      let latest_data = validation_result.resolved_data;
      try {
        latest_data = await upload_pending_files_for_data(
          form.source_form_group_id,
          form.version,
          latest_data,
          ({ percent }) => set.file_upload_percent(percent),
          (next_data) => {
            latest_data = next_data;
          },
          public_follow_up_upload_endpoint(follow_up_group_id),
        );
        const response = await submit_public_follow_up(follow_up_group_id, {
          version: form.version,
          data: latest_data,
          source_submission_id: source_submission_id || null,
          client_submission_id: generate_client_submission_id(),
          respondent: respondent || null,
        });
        set.values({});
        set.field_errors({});
        set.field_valid_messages({});
        set.reveal_all_errors(false);
        set.source(null);
        set.render_reset_key((previous_key) => previous_key + 1);
        set.submit_state("success_submitted");
        showSuccess((response && response.message) || translate("DCS_PUBLIC_DATA_RECORDED"));
      } catch (submit_error) {
        set.values(latest_data);
        if (submit_error && submit_error.field_errors) {
          set.field_errors(submit_error.field_errors);
          set.reveal_all_errors(true);
        }
        set.submit_state("error");
        showError((submit_error && submit_error.message) || translate("DCS_ERROR_GENERIC"));
      } finally {
        set.file_upload_percent(null);
      }
    } catch (unexpected_error) {
      set.submit_state("error");
      showError(unexpected_error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      set.submitting(false);
    }
  };

  return { handle_submit };
}
