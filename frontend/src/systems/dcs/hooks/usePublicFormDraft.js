import { useCallback, useEffect, useState } from "react";
import { save_form_draft, get_form_draft, clear_form_draft, has_meaningful_answers, strip_geolocation_values } from "../offline/draftStore.js";
import { compute_derived_values } from "../renderer/formEngine.js";
import { validate_submission_client_side } from "../jsonlogic/validateSubmission.js";

export function usePublicFormDraft({ form, form_group_id, values, ready, reviewing_queue_id_ref, loaded_record, language, translate, load_values_for_review, showSuccess }) {
  const [draft, setDraft] = useState(null);
  const [pending_check, setPendingCheck] = useState(null);
  const [resume_prompt_visible, setResumePromptVisible] = useState(false);

  const refresh_draft = useCallback(async () => {
    try {
      const stored_draft = await get_form_draft(form_group_id);
      setDraft(stored_draft);
      return stored_draft;
    } catch (draft_error) {
      console.error(draft_error);
      return null;
    }
  }, [form_group_id]);

  useEffect(() => {
    if (!form || !ready) return undefined;
    let alive = true;
    refresh_draft().then((stored_draft) => {
      if (alive && stored_draft) setPendingCheck(stored_draft);
    });
    return () => {
      alive = false;
    };
  }, [form, ready, refresh_draft]);

  useEffect(() => {
    if (!form || !pending_check) return;
    setPendingCheck(null);
    if (!has_meaningful_answers(pending_check.data, form.schema)) {
      clear_form_draft(form_group_id).then(() => refresh_draft());
      return;
    }
    if (!loaded_record && !has_meaningful_answers(values, form.schema)) setResumePromptVisible(true);
  }, [form, pending_check]);

  useEffect(() => {
    if (!form || !ready || loaded_record || reviewing_queue_id_ref.current || !has_meaningful_answers(values, form.schema)) return;
    save_form_draft(form_group_id, form.version, values).then(() => refresh_draft());
  }, [values]);

  const handle_save_draft_click = async () => {
    if (reviewing_queue_id_ref.current) return;
    const derived_values = compute_derived_values(form.schema, values);
    const validation_result = validate_submission_client_side(form.schema, derived_values, language, translate);
    await save_form_draft(form_group_id, form.version, validation_result.resolved_data);
    await refresh_draft();
    showSuccess(translate("DCS_TOAST_DRAFT_SAVED"));
  };

  const handle_resume_draft = () => {
    reviewing_queue_id_ref.current = null;
    load_values_for_review(strip_geolocation_values(draft.data));
    setResumePromptVisible(false);
  };

  const handle_discard_draft = async () => {
    await clear_form_draft(form_group_id);
    await refresh_draft();
    setResumePromptVisible(false);
  };

  return { draft, refresh_draft, resume_prompt_visible, handle_save_draft_click, handle_resume_draft, handle_discard_draft };
}
