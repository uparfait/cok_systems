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
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import { ResumeDraftDialog, QueuedNoticeDialog } from "../components/PublicFormDialogs.jsx";
import DcsRespondentGate from "../components/DcsRespondentGate.jsx";
import DcsInstallPrompt from "../components/DcsInstallPrompt.jsx";
import PublicFormChrome from "../components/PublicFormChrome.jsx";
import PublicApprovalNotices from "../components/PublicApprovalNotices.jsx";
import PublicSuccessScreen from "../components/PublicSuccessScreen.jsx";
import PublicFormCardHeader from "../components/PublicFormCardHeader.jsx";
import { useRecordTracking } from "../tracking/useRecordTracking.jsx";
import { is_tracking_enabled } from "../tracking/trackingConfig.js";
import { RecordFloatingButton } from "../tracking/RecordFieldWrap.jsx";
import RecordLookupOverlay from "../tracking/RecordLookupOverlay.jsx";


function extract_form_group_id(raw_id) {
  return raw_id.split("__v")[0];
}

function PublicFormPageContent() {
  const { id } = useParams();
  const { translate, language } = useDcsLanguage();
  const { showSuccess, showError, showWarning } = useToast();
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
  }, [form]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!form || !pending_draft_check) return;
    setPendingDraftCheck(null);
    if (!is_tracking_enabled(form.tracking) && has_meaningful_answers(pending_draft_check.data, form.schema)) {
      setResumePromptVisible(true);
    } else {
      clear_form_draft(form_group_id).then(() => refresh_draft());
    }
  }, [form, pending_draft_check]); // eslint-disable-line react-hooks/exhaustive-deps

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
          if (!is_tracking_enabled(response.data.tracking)) warm_offline_cache(form_group_id, response.data);
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
        // A tracked form is never filled in offline: its records live on the server.
        if (cached_form && is_mounted && is_tracking_enabled(cached_form.tracking)) {
          setLoadState("needs_connection");
          return;
        }
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

  // A loaded tracked record is edited in place, never saved as a draft.
  const put_record_values = useCallback((data) => {
    setValues(form ? compute_derived_values(form.schema, data || {}) : {});
    setFieldErrors({});
    setFieldValidMessages({});
    setRevealAllErrors(false);
    setSubmitState("idle");
  }, [form]);
  const clear_record_values = useCallback(() => {
    put_record_values({});
    setRenderResetKey((previous_key) => previous_key + 1);
  }, [put_record_values]);
  const tracking = useRecordTracking({ form, values, applyValues: put_record_values, clearValues: clear_record_values });

  // A tracked form keeps no draft on the device at all: its record has to
  // be created or updated on the server, in one go, while connected.
  useEffect(() => {
    if (!form || tracking.enabled || reviewing_queue_id_ref.current || !has_meaningful_answers(values, form.schema)) return;
    save_form_draft(form_group_id, form.version, values).then(() => refresh_draft());
  }, [values]); // eslint-disable-line react-hooks/exhaustive-deps

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
    showWarning,
    tracking,
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
  if (load_state === "needs_connection") return <DcsEmptyState messageKey="DCS_TRACKING_FORM_NEEDS_CONNECTION" />;
  if (load_state === "no_active_version") return <DcsEmptyState messageKey="DCS_PUBLIC_NO_ACTIVE_VERSION" />;

  const progress_percent = compute_form_progress_percent(form.schema.fields, values);
  // The who-is-filling-in card only when the form asks for it and nobody answered it yet.
  const gate_needed = form.ask_respondent !== false && !respondent;
  const is_success_screen = submit_state === "success_submitted" || submit_state === "success_offline" || submit_state === "success_updated";
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

        <PublicApprovalNotices notices={approval_notices} onClose={() => setApprovalNotices([])} />

        <div
          className="w-full min-[760px]:max-w-[700px] bg-white p-4 border-0 min-[760px]:border-[5px] min-[760px]:rounded-[5px] mt-0 min-[760px]:mt-3 mb-0 min-[760px]:mb-6 grow min-[760px]:grow-0 dcs-print-form-card"
          style={{ borderColor: "rgba(5,109,170,0.35)" }}
        >
          <PublicFormCardHeader respondent={respondent} disabled={submitting} />

          {is_success_screen ? (
            <PublicSuccessScreen
              state={submit_state}
              queuedMessage={queued_message}
              onAnother={() => {
                // Back from an update starts a fresh, empty new record: the
                // loaded record and its history are let go.
                if (submit_state === "success_updated") tracking.clear_record();
                setSubmitState("idle");
              }}
            />
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
                    wrapField={tracking.wrap_field}
                  />
                </MediaUploadProvider>
              </div>

              <DcsSubmitControl
                submitting={submitting}
                submitState={submit_state}
                onSubmit={handle_submit}
                onIdle={() => setSubmitState("idle")}
                submitLabelKey={tracking.loaded_record ? "DCS_TRACKING_BTN_UPDATE" : undefined}
                secondary={
                  tracking.loaded_record ? (
                    <DcsButtonOutline onClick={tracking.clear_record} disabled={submitting}>
                      {translate("DCS_TRACKING_CANCEL_UPDATE")}
                    </DcsButtonOutline>
                  ) : tracking.enabled ? null : (
                    <DcsButtonOutline onClick={handle_save_draft_click} disabled={submitting}>
                      {translate("DCS_BTN_SAVE_DRAFT")}
                    </DcsButtonOutline>
                  )
                }
              />
            </>
          )}
        </div>

        {tracking.enabled && !is_success_screen && (
          <RecordFloatingButton onClick={() => tracking.open_lookup()} count={tracking.history_count} disabled={submitting} />
        )}

        {tracking.lookup && (
          <RecordLookupOverlay
            formGroupId={form_group_id}
            fields={form.schema.fields}
            tracking={tracking.tracking}
            initialKey={tracking.lookup.initial_key}
            loadedRecord={tracking.loaded_record}
            onLoad={tracking.load_record}
            onClose={tracking.close_lookup}
          />
        )}

        {is_queue_open && (
          <DcsQueuePanel
            records={queue_records}
            draft={draft}
            isOnline={is_online}
            isSyncing={is_syncing}
            storageBackend={storage_backend_name}
            installSlot={<DcsInstallPrompt />}
            respondent={respondent}
            onRespondentChange={setRespondent}
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

        {gate_needed && <DcsRespondentGate saved={saved_respondent} onConfirm={setRespondent} />}

        {!gate_needed && resume_prompt_visible && draft && (
          <ResumeDraftDialog draft={draft} submitting={submitting} onResume={handle_resume_draft} onDiscard={handle_discard_draft} />
        )}

        {queued_notice_visible && (
          <QueuedNoticeDialog
            message={queued_message}
            onUnderstood={() => setQueuedNoticeVisible(false)}
            onOpenQueue={() => {
              setQueuedNoticeVisible(false);
              setIsQueueOpen(true);
            }}
          />
        )}
      </div>
    </>
  );
}

export default function PublicFormPage() {
  return (
    <DcsErrorBoundary>
      <DcsLanguageProvider>
        <PublicFormPageContent />
      </DcsLanguageProvider>
    </DcsErrorBoundary>
  );
}
