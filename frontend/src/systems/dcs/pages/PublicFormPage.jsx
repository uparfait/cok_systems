import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { DcsLanguageProvider, useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { get_public_form, get_public_form_field_options } from "../services/formsService.js";
import { useLazyFieldResolvers } from "../hooks/useLazyFieldResolvers.js";
import { usePublicSubmit } from "../hooks/usePublicSubmit.js";
import { cache_form, get_cached_form } from "../offline/formCache.js";
import { process_queue_once, list_queue, start_auto_sync } from "../offline/submissionQueue.js";
import { save_form_draft, get_form_draft, clear_form_draft, has_meaningful_answers, strip_geolocation_values } from "../offline/draftStore.js";
import { probe_storage } from "../offline/offlineStorage.js";
import { read_respondent } from "../offline/respondentStore.js";
import { warm_offline_cache } from "../offline/warmCache.js";
import { export_ready_records } from "../offline/exportReadyRecords.js";
import { apply_form_manifest } from "../pwa/dynamicManifest.js";
import { compute_derived_values, compute_form_progress_percent } from "../renderer/formEngine.js";
import { MediaUploadProvider } from "../renderer/MediaUploadContext.jsx";
import { validate_submission_client_side } from "../jsonlogic/validateSubmission.js";
import RendererEngine from "../renderer/RendererEngine.jsx";
import DcsSubmitControl from "../components/DcsSubmitControl.jsx";
import DcsFormLoadingSpinner from "../components/DcsFormLoadingSpinner.jsx";
import DcsEmptyState from "../components/DcsEmptyState.jsx";
import DcsErrorBoundary from "../components/DcsErrorBoundary.jsx";
import DcsQueuePanel from "../components/DcsQueuePanel.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsButtonOutlineDanger from "../components/DcsButtonOutlineDanger.jsx";
import DcsCenterOverlay from "../components/DcsCenterOverlay.jsx";
import DcsRespondentGate from "../components/DcsRespondentGate.jsx";
import DcsInstallPrompt from "../components/DcsInstallPrompt.jsx";
import PublicFormChrome from "../components/PublicFormChrome.jsx";

const FONT = "'Montserrat', sans-serif";
const AMBER = "#B9770E";

/** Strips any __v<version> suffix: the public link always resolves to the active version. */
function extract_form_group_id(raw_id) {
  return raw_id.split("__v")[0];
}

/** Public, offline-first data collection page behind /dcs-form/:id. */
function PublicFormPageContent() {
  const { id } = useParams();
  const { translate, language } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const form_group_id = extract_form_group_id(id);
  const { resolveFieldOptions } = useLazyFieldResolvers("public_form", form_group_id, get_public_form_field_options);

  const [form, setForm] = useState(null);
  const [load_state, setLoadState] = useState("loading");
  const [values, setValues] = useState({});
  const [field_errors, setFieldErrors] = useState({});
  const [field_valid_messages, setFieldValidMessages] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submit_state, setSubmitState] = useState("idle");
  const [reveal_all_errors, setRevealAllErrors] = useState(false);
  const [render_reset_key, setRenderResetKey] = useState(0);
  const [queue_records, setQueueRecords] = useState([]);
  const [draft, setDraft] = useState(null);
  const [resume_prompt_visible, setResumePromptVisible] = useState(false);
  const [is_syncing, setIsSyncing] = useState(false);
  const [sync_kind, setSyncKind] = useState(null);
  const [file_upload_percent, setFileUploadPercent] = useState(null);
  const [is_online, setIsOnline] = useState(window.navigator.onLine);
  const [is_queue_open, setIsQueueOpen] = useState(false);
  const [approval_notices, setApprovalNotices] = useState([]);
  const [queued_notice_visible, setQueuedNoticeVisible] = useState(false);
  const [storage_backend_name, setStorageBackendName] = useState(null);
  const [pending_draft_check, setPendingDraftCheck] = useState(null);
  const [respondent, setRespondent] = useState(null);
  const [saved_respondent] = useState(() => read_respondent());
  const reviewing_queue_id_ref = useRef(null);

  useEffect(() => {
    if (form) apply_form_manifest({ name: form.form_name || translate("DCS_PUBLIC_FORM_TITLE_FALLBACK"), language });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  // A stored draft is offered only once the schema can say whether it holds
  // a typed answer; one with only the auto-detected location is dropped.
  useEffect(() => {
    if (!form || !pending_draft_check) return;
    setPendingDraftCheck(null);
    if (has_meaningful_answers(pending_draft_check.data, form.schema)) {
      setResumePromptVisible(true);
    } else {
      clear_form_draft(form_group_id).then(() => refresh_draft());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, pending_draft_check]);

  useEffect(() => {
    const prevent_default = (event) => event.preventDefault();
    window.addEventListener("dragover", prevent_default);
    window.addEventListener("drop", prevent_default);
    return () => {
      window.removeEventListener("dragover", prevent_default);
      window.removeEventListener("drop", prevent_default);
    };
  }, []);

  const refresh_queue = useCallback(async () => {
    try {
      const queue = await list_queue();
      setQueueRecords(queue.filter((item) => item.form_group_id === form_group_id));
    } catch (queue_error) {
      console.error(queue_error);
    }
  }, [form_group_id]);

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
    let is_mounted = true;

    async function load_form() {
      const max_retries = 5;
      let last_error = null;

      for (let attempt = 1; attempt <= max_retries; attempt++) {
        try {
          const response = await get_public_form(form_group_id);
          if (!is_mounted) return;
          setForm(response.data);
          await cache_form(form_group_id, response.data);
          setLoadState("ready");
          warm_offline_cache(form_group_id, response.data);
          return;
        } catch (error) {
          last_error = error;
          if (!is_mounted) return;
          if (attempt < max_retries) await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      if (!is_mounted) return;
      if (last_error && last_error.is_network_error) {
        const cached_form = await get_cached_form(form_group_id);
        if (cached_form && is_mounted) {
          setForm(cached_form);
          setLoadState("ready");
          return;
        }
      }
      if (is_mounted) setLoadState(last_error && last_error.status_code === 409 ? "no_active_version" : "not_found");
    }

    probe_storage().then((backend) => {
      if (is_mounted) setStorageBackendName(backend);
    });
    load_form();
    refresh_queue();
    refresh_draft().then((stored_draft) => {
      if (stored_draft && is_mounted) setPendingDraftCheck(stored_draft);
    });

    const handle_online_change = () => setIsOnline(window.navigator.onLine);
    window.addEventListener("online", handle_online_change);
    window.addEventListener("offline", handle_online_change);
    const online_poll_interval = window.setInterval(handle_online_change, 10000);

    const stop_auto_sync = start_auto_sync({
      onStart: () => {
        setIsSyncing(true);
        setSyncKind("saved");
      },
      onItemResult: async () => refresh_queue(),
      onFileProgress: ({ percent }) => setFileUploadPercent(percent),
      onComplete: async (result) => {
        await refresh_queue();
        setIsSyncing(false);
        setSyncKind(null);
        setFileUploadPercent(null);
        if (result.approval_notices && result.approval_notices.length > 0) {
          setApprovalNotices((previous) => previous.concat(result.approval_notices));
        }
        if (result.blocked_item) {
          showError(result.blocked_item.message || translate("DCS_ERROR_GENERIC"));
        } else if (result.sent_count > 0) {
          showSuccess(translate("DCS_TOAST_UPLOAD_SUCCESS", { count: result.sent_count }));
        }
      },
    });

    return () => {
      is_mounted = false;
      window.removeEventListener("online", handle_online_change);
      window.removeEventListener("offline", handle_online_change);
      window.clearInterval(online_poll_interval);
      stop_auto_sync();
    };
  }, [form_group_id, refresh_queue, refresh_draft]);

  useEffect(() => {
    if (!form || reviewing_queue_id_ref.current || !has_meaningful_answers(values, form.schema)) return;
    save_form_draft(form_group_id, form.version, values).then(() => refresh_draft());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  const handle_value_change = (field_id, next_value) => {
    setSubmitState("idle");
    setValues((previous_values) => {
      const merged_values = Object.assign({}, previous_values, { [field_id]: next_value });
      const resolved_values = compute_derived_values(form.schema, merged_values);
      const validation_result = validate_submission_client_side(form.schema, resolved_values, language, translate);
      setFieldErrors(validation_result.field_errors);
      setFieldValidMessages(validation_result.field_valid_messages);
      return validation_result.resolved_data;
    });
  };

  const handle_save_draft_click = async () => {
    if (reviewing_queue_id_ref.current) return;
    const derived_values = compute_derived_values(form.schema, values);
    const validation_result = validate_submission_client_side(form.schema, derived_values, language, translate);
    await save_form_draft(form_group_id, form.version, validation_result.resolved_data);
    await refresh_draft();
    showSuccess(translate("DCS_TOAST_DRAFT_SAVED"));
  };

  const load_values_for_review = (data) => {
    const resolved_values = compute_derived_values(form.schema, data || {});
    const validation_result = validate_submission_client_side(form.schema, resolved_values, language, translate);
    setValues(validation_result.resolved_data);
    setFieldErrors(validation_result.field_errors);
    setFieldValidMessages(validation_result.field_valid_messages);
    setRevealAllErrors(true);
    setSubmitState("idle");
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

  const handle_select_record = (record) => {
    reviewing_queue_id_ref.current = record.id;
    load_values_for_review(record.data);
    setIsQueueOpen(false);
  };

  const handle_force_upload = async () => {
    if (!window.navigator.onLine) return;
    setIsSyncing(true);
    setSyncKind("saved");
    try {
      const result = await process_queue_once(async () => refresh_queue(), ({ percent }) => setFileUploadPercent(percent));
      await refresh_queue();
      if (result.approval_notices && result.approval_notices.length > 0) {
        setApprovalNotices((previous) => previous.concat(result.approval_notices));
      }
      if (result.blocked_item) {
        showError(result.blocked_item.message || translate("DCS_ERROR_GENERIC"));
      } else if (result.sent_count > 0) {
        showSuccess(translate("DCS_TOAST_UPLOAD_SUCCESS", { count: result.sent_count }));
      } else {
        showSuccess(translate("DCS_TOAST_NOTHING_TO_UPLOAD"));
      }
    } finally {
      setIsSyncing(false);
      setSyncKind(null);
      setFileUploadPercent(null);
    }
  };

  const handle_export_ready = async () => {
    const ready_records = queue_records.filter((record) => record.status === "pending");
    if (ready_records.length === 0) {
      showError(translate("DCS_TOAST_NOTHING_TO_EXPORT"));
      return;
    }
    await export_ready_records(form, ready_records, language);
  };

  const { handle_submit } = usePublicSubmit({
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
    set: {
      submitting: setSubmitting,
      values: setValues,
      field_errors: setFieldErrors,
      field_valid_messages: setFieldValidMessages,
      reveal_all_errors: setRevealAllErrors,
      render_reset_key: setRenderResetKey,
      submit_state: setSubmitState,
      is_syncing: setIsSyncing,
      sync_kind: setSyncKind,
      file_upload_percent: setFileUploadPercent,
      approval_notices: setApprovalNotices,
      queued_notice_visible: setQueuedNoticeVisible,
    },
  });

  if (load_state === "loading") return <DcsFormLoadingSpinner />;
  if (load_state === "not_found") return <DcsEmptyState messageKey="DCS_PUBLIC_NOT_FOUND" />;
  if (load_state === "no_active_version") return <DcsEmptyState messageKey="DCS_PUBLIC_NO_ACTIVE_VERSION" />;

  const progress_percent = compute_form_progress_percent(form.schema.fields, values);
  const is_success_screen = submit_state === "success_submitted" || submit_state === "success_offline";
  const queued_message = translate("DCS_PUBLIC_QUEUED_MESSAGE") + (storage_backend_name === "memory" ? "\n\n" + translate("DCS_STORAGE_MEMORY_ONLY") : "");

  return (
    <>
      <Helmet>
        <title>{form.form_name || translate("DCS_PUBLIC_FORM_TITLE_FALLBACK")}</title>
      </Helmet>
      <div
        className="min-h-screen p-0 min-[760px]:px-6 pt-[env(safe-area-inset-top,0px)] min-[760px]:pt-[calc(52px+env(safe-area-inset-top,0px))] pb-[env(safe-area-inset-bottom,0px)] min-[760px]:pb-[calc(24px+env(safe-area-inset-bottom,0px))] flex flex-col items-center dcs-print-page-bg"
        style={{ backgroundColor: "#F7F9FB" }}
      >
        <PublicFormChrome
          progressPercent={progress_percent}
          isOnline={is_online}
          queueCount={queue_records.length}
          onOpenQueue={() => setIsQueueOpen(true)}
          disabled={submitting}
          isSyncing={is_syncing}
          syncKind={sync_kind}
          fileUploadPercent={file_upload_percent}
          storageBackend={storage_backend_name}
        />

        {approval_notices.some((notice) => notice.links.some((link_info) => link_info.email_sent)) && (
          <div className="dcs-no-print w-full min-[760px]:max-w-[700px] bg-white border-2 p-4 mb-3" style={{ borderColor: "#056daa" }}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold" style={{ color: "#056daa", fontFamily: FONT }}>
                {translate("DCS_APPROVAL_LINK_PANEL_TITLE")}
              </p>
              <button type="button" onClick={() => setApprovalNotices([])} className="cursor-pointer text-xs font-semibold" style={{ color: "#9E9E9E", fontFamily: FONT, background: "none", border: "none" }}>
                {translate("DCS_BTN_CLOSE")}
              </button>
            </div>
            {approval_notices.map((notice, notice_index) =>
              notice.links
                .filter((link_info) => link_info.email_sent)
                .map((link_info, link_index) => (
                  <p key={`${notice_index}_${link_index}`} className="mt-3 text-sm px-3 py-2" style={{ backgroundColor: "rgba(76,175,80,0.12)", color: "#4CAF50", fontFamily: FONT }}>
                    {translate("DCS_APPROVAL_LINK_EMAILED", { name: link_info.name, role: link_info.role })}
                  </p>
                )),
            )}
          </div>
        )}

        <div
          className="w-full min-[760px]:max-w-[700px] bg-white p-4 border-0 min-[760px]:border-[5px] min-[760px]:rounded-[5px] mt-0 min-[760px]:mt-3 mb-0 min-[760px]:mb-6 grow min-[760px]:grow-0 dcs-print-form-card"
          style={{ borderColor: "rgba(5,109,170,0.35)" }}
        >
          <div className="flex items-center justify-between gap-2 mb-3 dcs-no-print">
            <p className="text-xs truncate" style={{ color: "#9E9E9E", fontFamily: FONT }}>
              {respondent ? translate("DCS_RESPONDENT_FILLING_AS", { name: respondent.name }) : ""}
            </p>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={submitting}
              title={translate("DCS_BTN_PRINT")}
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #056daa", opacity: submitting ? 0.6 : 1, cursor: submitting ? "not-allowed" : "pointer" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#056daa" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
            </button>
          </div>

          {is_success_screen ? (
            <div className="w-full py-12 flex flex-col items-center text-center gap-3">
              <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 20, color: submit_state === "success_submitted" ? "#333333" : AMBER, textTransform: "uppercase" }}>
                {translate(submit_state === "success_submitted" ? "DCS_PUBLIC_RESPONSE_SAVED_TITLE" : "DCS_PUBLIC_QUEUED_TITLE")}
              </span>
              <span style={{ fontFamily: FONT, fontSize: 14, color: "#666666", maxWidth: 460, whiteSpace: "pre-line" }}>
                {submit_state === "success_submitted" ? translate("DCS_PUBLIC_RESPONSE_SAVED_DESCRIPTION") : queued_message}
              </span>
              <button type="button" onClick={() => setSubmitState("idle")} className="cursor-pointer underline bg-transparent border-0 p-0 mt-2" style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: "#056daa" }}>
                {translate("DCS_PUBLIC_SUBMIT_ANOTHER")}
              </button>
            </div>
          ) : (
            <>
              <div style={submitting ? { pointerEvents: "none", opacity: 0.6 } : undefined}>
                <MediaUploadProvider formGroupId={form_group_id} version={form.version} isOnline={is_online}>
                  <RendererEngine
                    key={render_reset_key}
                    schema={form.schema}
                    mode="renderer"
                    values={values}
                    onValueChange={handle_value_change}
                    fieldErrors={field_errors}
                    fieldValidMessages={field_valid_messages}
                    revealAllErrors={reveal_all_errors}
                    resolveFieldOptions={resolveFieldOptions}
                  />
                </MediaUploadProvider>
              </div>

              <DcsSubmitControl
                submitting={submitting}
                submitState={submit_state}
                onSubmit={handle_submit}
                onIdle={() => setSubmitState("idle")}
                secondary={
                  <DcsButtonOutline onClick={handle_save_draft_click} disabled={submitting}>
                    {translate("DCS_BTN_SAVE_DRAFT")}
                  </DcsButtonOutline>
                }
              />
            </>
          )}
        </div>

        {is_queue_open && (
          <DcsQueuePanel
            records={queue_records}
            draft={draft}
            isOnline={is_online}
            isSyncing={is_syncing}
            storageBackend={storage_backend_name}
            installSlot={<DcsInstallPrompt />}
            onClose={() => setIsQueueOpen(false)}
            onSelectRecord={handle_select_record}
            onContinueDraft={() => {
              handle_resume_draft();
              setIsQueueOpen(false);
            }}
            onDeleteDraft={handle_discard_draft}
            onUpload={handle_force_upload}
            onExportReady={handle_export_ready}
          />
        )}

        {!respondent && <DcsRespondentGate saved={saved_respondent} onConfirm={setRespondent} />}

        {respondent && resume_prompt_visible && draft && (
          <DcsCenterOverlay title={translate("DCS_PUBLIC_RESUME_DRAFT_TITLE")} message={translate("DCS_PUBLIC_RESUME_DRAFT_MESSAGE", { date: new Date(draft.updated_at).toLocaleString() })}>
            <div className="flex flex-col min-[480px]:flex-row gap-2">
              <DcsButtonPrimary className="flex-1" onClick={handle_resume_draft} disabled={submitting}>
                {translate("DCS_BTN_CONTINUE_DRAFT")}
              </DcsButtonPrimary>
              <DcsButtonOutlineDanger className="flex-1" onClick={handle_discard_draft} disabled={submitting}>
                {translate("DCS_BTN_DISCARD_DRAFT")}
              </DcsButtonOutlineDanger>
            </div>
          </DcsCenterOverlay>
        )}

        {queued_notice_visible && (
          <DcsCenterOverlay accent={AMBER} title={translate("DCS_PUBLIC_QUEUED_TITLE")} message={queued_message}>
            <div className="flex flex-col min-[480px]:flex-row gap-2">
              <DcsButtonPrimary className="flex-1" onClick={() => setQueuedNoticeVisible(false)}>
                {translate("DCS_PUBLIC_QUEUED_UNDERSTOOD")}
              </DcsButtonPrimary>
              <DcsButtonOutline
                className="flex-1"
                onClick={() => {
                  setQueuedNoticeVisible(false);
                  setIsQueueOpen(true);
                }}
              >
                {translate("DCS_QUEUE_BUTTON_LABEL")}
              </DcsButtonOutline>
            </div>
          </DcsCenterOverlay>
        )}
      </div>
    </>
  );
}

/** Standalone public route: wrapped in its own language provider. */
export default function PublicFormPage() {
  return (
    <DcsErrorBoundary>
      <DcsLanguageProvider>
        <PublicFormPageContent />
      </DcsLanguageProvider>
    </DcsErrorBoundary>
  );
}
