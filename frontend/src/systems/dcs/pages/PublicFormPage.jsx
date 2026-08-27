import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import ExcelJS from "exceljs";
import { DcsLanguageProvider, useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { get_public_form, get_public_form_field_options } from "../services/formsService.js";
import { useLazyFieldResolvers } from "../hooks/useLazyFieldResolvers.js";
import { cache_form, get_cached_form } from "../offline/formCache.js";
import { enqueue_submission, update_queue_item, process_queue_once, list_queue, start_auto_sync } from "../offline/submissionQueue.js";
import { save_form_draft, get_form_draft, clear_form_draft } from "../offline/draftStore.js";
import { compute_derived_values, compute_form_progress_percent } from "../renderer/formEngine.js";
import { MediaUploadProvider } from "../renderer/MediaUploadContext.jsx";
import { validate_submission_client_side } from "../jsonlogic/validateSubmission.js";
import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import { get_field_text } from "../fields/fieldText.js";
import RendererEngine from "../renderer/RendererEngine.jsx";
import DcsSubmitControl from "../components/DcsSubmitControl.jsx";
import DcsFormLoadingSpinner from "../components/DcsFormLoadingSpinner.jsx";
import DcsEmptyState from "../components/DcsEmptyState.jsx";
import DcsErrorBoundary from "../components/DcsErrorBoundary.jsx";
import DcsQueuePanel from "../components/DcsQueuePanel.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsButtonOutlineDanger from "../components/DcsButtonOutlineDanger.jsx";
import { build_approval_link } from "../services/approvalsService.js";

/**
 * Strips any "__v<version>" suffix from a shared link - the public link
 * always resolves to whichever version is currently active on the server,
 * regardless of which version number was embedded when it was shared.
 */
function extract_form_group_id(raw_id) {
  return raw_id.split("__v")[0];
}

/**
 * Every field anywhere in the schema (recursing into group/section
 * children) still marked lazy_options - see dc_backend/jsonlogic/
 * lazy_options.js - i.e. one whose real options this device has never
 * actually fetched yet.
 */
function collect_lazy_field_ids(fields, accumulator) {
  const ids = accumulator || [];
  (fields || []).forEach((field) => {
    if (!field) return;
    if (field.lazy_options) ids.push(field.id);
    if ((field.type === "group" || field.type === "section") && Array.isArray(field.children)) {
      collect_lazy_field_ids(field.children, ids);
    }
  });
  return ids;
}

/**
 * Splices each lazy field's now-fully-resolved data (keyed by field id) back
 * into the schema, dropping the lazy_options marker - used to turn the
 * lazily-loaded schema this page started with into the complete one it
 * hands to the offline cache.
 */
function apply_full_field_data(fields, data_by_id) {
  return (fields || []).map((field) => {
    if (!field) return field;
    if ((field.type === "group" || field.type === "section") && Array.isArray(field.children)) {
      return Object.assign({}, field, { children: apply_full_field_data(field.children, data_by_id) });
    }
    if (field.lazy_options && data_by_id.has(field.id)) {
      return Object.assign({}, field, data_by_id.get(field.id), { lazy_options: undefined, options_count: undefined });
    }
    return field;
  });
}

/**
 * Best-effort background warm-up: fully resolves every lazy field's real
 * options and re-caches the whole form with them filled in, so a session
 * that goes offline after this finishes - or one that never had a live
 * connection to begin with, on a device that already loaded this form once
 * before - still has everything available, never stuck on a field this
 * device has never actually fetched. Fires immediately after a successful
 * online load without blocking it; a failure here (e.g. going offline right
 * away) just means this device's offline copy stays lazy for now, exactly
 * as any offline-first cache already behaves before its first full sync.
 */
async function warm_offline_cache(form_group_id, loaded_form) {
  const lazy_field_ids = collect_lazy_field_ids(loaded_form.schema.fields);
  if (lazy_field_ids.length === 0) return;
  try {
    const resolved_entries = await Promise.all(
      lazy_field_ids.map((field_id) =>
        get_public_form_field_options(form_group_id, field_id).then((response) => [field_id, response.data]),
      ),
    );
    const data_by_id = new Map(resolved_entries);
    const full_fields = apply_full_field_data(loaded_form.schema.fields, data_by_id);
    await cache_form(
      form_group_id,
      Object.assign({}, loaded_form, { schema: Object.assign({}, loaded_form.schema, { fields: full_fields }) }),
    );
  } catch (warm_error) {
    console.error(warm_error);
  }
}

const TOP_PROGRESS_BAR_HEIGHT_PX = 4;
// Everything else fixed at the top (the status badge, the percent badge)
// sits below the bar itself, never on top of it.
const TOP_BADGE_OFFSET = `calc(${TOP_PROGRESS_BAR_HEIGHT_PX}px + 8px + env(safe-area-inset-top, 0px))`;

/**
 * Public, offline-first data collection page behind /dcs-form/:id.
 */
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
  const [file_upload_percent, setFileUploadPercent] = useState(null);
  const [is_online, setIsOnline] = useState(window.navigator.onLine);
  const [is_queue_open, setIsQueueOpen] = useState(false);
  const [approval_notices, setApprovalNotices] = useState([]);
  // Set only while reviewing/fixing an already-queued (pending/error)
  // record - submitting then updates that same record instead of both
  // creating a duplicate AND clobbering the separate, single draft slot.
  const reviewing_queue_id_ref = useRef(null);

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
      try {
        const response = await get_public_form(form_group_id);
        if (!is_mounted) return;
        setForm(response.data);
        await cache_form(form_group_id, response.data);
        setLoadState("ready");
        // The lazy/online path only ever needs one branch of a huge cascade
        // at a time - fine while there is a connection, but going offline
        // must never leave a respondent stuck with fields this device has
        // never actually seen the real options for. In the background,
        // fully resolve every lazy field once and re-cache the whole form
        // with its real content, so an offline session started later on
        // this same device (or one that drops mid-fill after this
        // finishes) still has everything available locally.
        warm_offline_cache(form_group_id, response.data);
      } catch (error) {
        if (error.is_network_error) {
          const cached_form = await get_cached_form(form_group_id);
          if (cached_form && is_mounted) {
            setForm(cached_form);
            setLoadState("ready");
            return;
          }
        }
        if (is_mounted) setLoadState(error.status_code === 409 ? "no_active_version" : "not_found");
      }
    }

    load_form();
    refresh_queue();
    refresh_draft().then((stored_draft) => {
      if (stored_draft && is_mounted) setResumePromptVisible(true);
    });

    const handle_online_change = () => setIsOnline(window.navigator.onLine);
    window.addEventListener("online", handle_online_change);
    window.addEventListener("offline", handle_online_change);
    // The online/offline events only fire on an actual network interface
    // transition, which some browsers miss (e.g. wifi still connected but
    // no internet) - polling navigator.onLine directly keeps the icon
    // accurate even when no event ever fires.
    const online_poll_interval = window.setInterval(handle_online_change, 10000);

    const stop_auto_sync = start_auto_sync({
      onStart: () => setIsSyncing(true),
      onItemResult: async () => refresh_queue(),
      onFileProgress: ({ percent }) => setFileUploadPercent(percent),
      onComplete: async (result) => {
        await refresh_queue();
        setIsSyncing(false);
        setFileUploadPercent(null);
        // A record queued offline can land during a background sync - its approval link must still surface.
        if (result.approval_notices && result.approval_notices.length > 0) {
          setApprovalNotices((previous) => previous.concat(result.approval_notices));
        }
        // A silent, empty tick (nothing queued) happens every single
        // minute the page is left open - toasting that would just be
        // background noise. Only something that actually happened (a
        // record went out, or one was rejected) is worth interrupting for.
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

  // Every answer, the instant it changes, overwrites the one draft slot
  // for this form - never creating another - so nothing is lost to a
  // closed tab, a dead battery or a lost connection mid-response. Skipped
  // while reviewing an already-queued record: that is a separate editing
  // session and must never overwrite the "new entry in progress" draft.
  useEffect(() => {
    if (!form || reviewing_queue_id_ref.current || Object.keys(values).length === 0) return;
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
      // A field that was visible (and answered) a moment ago can go
      // invisible the instant an earlier answer changes - its stale answer
      // must never linger in state to be autosaved, counted toward
      // progress, or submitted alongside the questions actually asked.
      // resolved_data is the same working data validated above, with every
      // now-hidden/locked field's own value already stripped.
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
    // resolved_data has every field the current data no longer makes
    // visible already stripped - a queued/draft record can predate a later
    // schema or answer change that hides a field it had answered.
    setValues(validation_result.resolved_data);
    setFieldErrors(validation_result.field_errors);
    setFieldValidMessages(validation_result.field_valid_messages);
    setRevealAllErrors(true);
    setSubmitState("idle");
  };

  const handle_resume_draft = () => {
    reviewing_queue_id_ref.current = null;
    load_values_for_review(draft.data);
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
      setFileUploadPercent(null);
    }
  };

  // A media answer's real value is {name, type, size, url} - the file
  // itself lives on disk, not in this export - so only the filename (or a
  // generic placeholder) is exported for those.
  const stringify_export_cell = (value) => {
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") return value.name || "file";
    return String(value);
  };

  const handle_export_ready = async () => {
    const ready_records = queue_records.filter((record) => record.status === "pending");
    if (ready_records.length === 0) {
      showError(translate("DCS_TOAST_NOTHING_TO_EXPORT"));
      return;
    }

    const fields_by_id = new Map(flatten_fields(form.schema.fields).map((field) => [field.id, field]));
    const field_ids = [...new Set(ready_records.flatMap((record) => Object.keys(record.data || {})))];
    const header_labels = ["Submitted at"].concat(
      field_ids.map((field_id) => {
        const field = fields_by_id.get(field_id);
        return (field && get_field_text(field.label, language)) || field_id;
      }),
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Submissions");
    worksheet.columns = header_labels.map(() => ({ width: 26 }));

    // The header row is the actual question text, highlighted so it reads
    // as a label at a glance rather than a bare column key.
    const header_row = worksheet.getRow(1);
    header_labels.forEach((label_text, index) => {
      const cell = header_row.getCell(index + 1);
      cell.value = label_text;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF056DAA" } };
    });

    ready_records.forEach((record, row_index) => {
      const row = worksheet.getRow(row_index + 2);
      row.getCell(1).value = record.created_at ? new Date(record.created_at).toLocaleString() : "";
      field_ids.forEach((field_id, column_index) => {
        row.getCell(column_index + 2).value = stringify_export_cell(record.data ? record.data[field_id] : undefined);
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dcs_ready_submissions_${Date.now()}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handle_submit = async () => {
    setSubmitting(true);
    try {
      const derived_values = compute_derived_values(form.schema, values);
      const validation_result = validate_submission_client_side(form.schema, derived_values, language, translate);
      // resolved_data is derived_values with every hidden/locked field's own
      // stale answer already stripped - never queue or draft-save a stray
      // answer left behind from before the respondent changed an earlier
      // question and hid it.
      const resolved_values = validation_result.resolved_data;
      setFieldErrors(validation_result.field_errors);
      setFieldValidMessages(validation_result.field_valid_messages);
      if (!validation_result.valid) {
        setRevealAllErrors(true);
        setSubmitState("error");
        // Invalid data is never queued for upload - it is not a completed
        // response - but it must not simply vanish either, so a submit
        // attempt on an incomplete/invalid form guarantees it is at least
        // saved as the respondent's draft (autosave already does this on
        // every value change, but this covers submitting before any change
        // has fired that effect, e.g. a completely untouched form).
        if (!reviewing_queue_id_ref.current) {
          await save_form_draft(form_group_id, form.version, resolved_values);
          await refresh_draft();
        }
        return;
      }

      // Whichever id ends up sitting in the queue for this exact response -
      // used afterwards to tell whether THIS submission actually left the
      // device or is still sitting there waiting for a connection, since
      // process_queue_once can also be moving other, older queued records.
      let queued_item_id = reviewing_queue_id_ref.current;
      if (reviewing_queue_id_ref.current) {
        await update_queue_item(reviewing_queue_id_ref.current, {
          data: resolved_values,
          version: form.version,
          status: "pending",
          field_errors: null,
          updated_at: new Date().toISOString(),
        });
      } else {
        const queued_item = await enqueue_submission(form_group_id, form.version, resolved_values);
        queued_item_id = queued_item.id;
        await clear_form_draft(form_group_id);
        await refresh_draft();
      }
      await refresh_queue();

      let was_sent_immediately = false;
      if (window.navigator.onLine) {
        setIsSyncing(true);
        const result = await process_queue_once(async () => refresh_queue(), ({ percent }) => setFileUploadPercent(percent));
        await refresh_queue();
        setIsSyncing(false);
        setFileUploadPercent(null);

        if (result.approval_notices && result.approval_notices.length > 0) {
          setApprovalNotices((previous) => previous.concat(result.approval_notices));
        }

        if (result.blocked_item) {
          reviewing_queue_id_ref.current = result.blocked_item.id;
          setValues(result.blocked_item.data || {});
          setFieldErrors(result.blocked_item.field_errors || {});
          setFieldValidMessages({});
          setRevealAllErrors(true);
          setSubmitState("error");
          showError(result.blocked_item.message || translate("DCS_ERROR_GENERIC"));
          return;
        }

        const remaining_queue = await list_queue();
        was_sent_immediately = !remaining_queue.some((item) => item.id === queued_item_id);
      }

      reviewing_queue_id_ref.current = null;
      setValues({});
      setFieldErrors({});
      setFieldValidMessages({});
      setRevealAllErrors(false);
      setRenderResetKey((previous_key) => previous_key + 1);
      setSubmitState(was_sent_immediately ? "success_submitted" : "success_offline");
      showSuccess(translate(was_sent_immediately ? "DCS_PUBLIC_DATA_RECORDED" : "DCS_PUBLIC_SUBMIT_QUEUED_OFFLINE"));
    } catch (submit_error) {
      setSubmitState("error");
      showError(submit_error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setSubmitting(false);
    }
  };

  if (load_state === "loading") return <DcsFormLoadingSpinner />;
  if (load_state === "not_found") return <DcsEmptyState messageKey="DCS_PUBLIC_NOT_FOUND" />;
  if (load_state === "no_active_version") return <DcsEmptyState messageKey="DCS_PUBLIC_NO_ACTIVE_VERSION" />;

  const progress_percent = compute_form_progress_percent(form.schema.fields, values);

  return (
    <div
      className="min-h-screen p-0 min-[700px]:p-6 flex flex-col items-center dcs-print-page-bg"
      style={{
        backgroundColor: "#F7F9FB",
        paddingTop: "calc(52px + env(safe-area-inset-top, 0px))",
        paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {/* Fixed to the true top of the viewport, outside the form and never
          part of the scrollable page - a persistent indicator of how much
          is left, not a progress bar that scrolls away with the content
          it's meant to be tracking. */}
      <div
        className="dcs-no-print"
        title={translate("DCS_RENDERER_PROGRESS_LABEL", { percent: progress_percent })}
        style={{ position: "fixed", top: 0, left: 0, width: "100%", zIndex: 40, backgroundColor: "#E0E0E0" }}
      >
        <div style={{ height: TOP_PROGRESS_BAR_HEIGHT_PX, width: `${progress_percent}%`, backgroundColor: "#056daa", transition: "width 0.3s ease" }} />
      </div>

      <button
        type="button"
        onClick={() => setIsQueueOpen(true)}
        disabled={submitting}
        className="dcs-no-print flex items-center justify-center"
        title={translate("DCS_QUEUE_BUTTON_LABEL")}
        style={{
          position: "fixed",
          left: 0,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 30,
          backgroundColor: "#056daa",
          border: "none",
          width: 16,
          height: 36,
          opacity: submitting ? 0.6 : 1,
          cursor: submitting ? "not-allowed" : "pointer",
        }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
          <polyline points="7 5 13 12 7 19" />
          <polyline points="13 5 19 12 13 19" />
        </svg>
      </button>

      <div
        className="dcs-no-print flex items-center gap-2"
        style={{
          position: "fixed",
          top: TOP_BADGE_OFFSET,
          left: 26,
          zIndex: 30,
          backgroundColor: "rgba(255,255,255,0.55)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.6)",
          boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
          padding: "0.3rem 0.5rem",
        }}
      >
        <span title={translate(is_online ? "DCS_QUEUE_STATUS_ONLINE" : "DCS_QUEUE_STATUS_OFFLINE")} className="flex items-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={is_online ? "#4CAF50" : "#E74C3C"} strokeWidth="2">
            <path d="M2 8.5a15 15 0 0120 0" />
            <path d="M5.5 12.5a10 10 0 0113 0" />
            <path d="M9 16.5a5 5 0 016 0" />
            <circle cx="12" cy="20" r="1" fill={is_online ? "#4CAF50" : "#E74C3C"} stroke="none" />
            {!is_online && <line x1="3" y1="3" x2="21" y2="21" />}
          </svg>
        </span>
        <span title={translate("DCS_QUEUE_TOTAL_SAVED")} className="flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#056daa" strokeWidth="2">
            <path d="M3 7l9-4 9 4-9 4-9-4z" />
            <path d="M3 12l9 4 9-4" />
            <path d="M3 17l9 4 9-4" />
          </svg>
          <span className="text-xs font-semibold" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
            {queue_records.length}
          </span>
        </span>
      </div>

      {approval_notices.length > 0 && (
        <div className="dcs-no-print w-full min-[700px]:max-w-[700px] bg-white border-2 p-4 mb-3" style={{ borderColor: "#056daa" }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold" style={{ color: "#056daa", fontFamily: "'Montserrat', sans-serif" }}>
              {translate("DCS_APPROVAL_LINK_PANEL_TITLE")}
            </p>
            <button
              type="button"
              onClick={() => setApprovalNotices([])}
              className="cursor-pointer text-xs font-semibold"
              style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif", background: "none", border: "none" }}
            >
              {translate("DCS_BTN_CLOSE")}
            </button>
          </div>
          {approval_notices.map((notice, notice_index) =>
            notice.links.map((link_info) => {
              const approval_link = build_approval_link(link_info.token);
              return (
                <div key={`${notice_index}_${link_info.token}`} className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
                      {translate("DCS_APPROVAL_LINK_SEND", { name: link_info.name, role: link_info.role })}
                    </p>
                    <p className="truncate text-sm" style={{ color: "#056daa" }} title={approval_link}>
                      {approval_link}
                    </p>
                  </div>
                  <DcsButtonOutline
                    onClick={() => {
                      window.navigator.clipboard.writeText(approval_link);
                      showSuccess(translate("DCS_TOAST_LINK_COPIED"));
                    }}
                  >
                    {translate("DCS_FORM_COPY_LINK")}
                  </DcsButtonOutline>
                </div>
              );
            }),
          )}
        </div>
      )}

      {resume_prompt_visible && draft && (
        <div className="dcs-no-print w-full min-[700px]:max-w-[700px] bg-white border-2 p-3 mb-3 flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: "#056daa" }}>
          <span className="text-sm" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
            {translate("DCS_PUBLIC_RESUME_DRAFT_TITLE")}
          </span>
          <div className="flex gap-2">
            <DcsButtonOutline onClick={handle_resume_draft} disabled={submitting}>{translate("DCS_BTN_REFILL_FORM")}</DcsButtonOutline>
            <DcsButtonOutlineDanger onClick={handle_discard_draft} disabled={submitting}>{translate("DCS_BTN_DISCARD_DRAFT")}</DcsButtonOutlineDanger>
          </div>
        </div>
      )}

      <div
        className="w-full min-[700px]:max-w-[700px] bg-white p-4 border-0 min-[700px]:border-[5px] min-[700px]:rounded-[5px] dcs-print-form-card"
        style={{ borderColor: "rgba(5,109,170,0.35)", marginTop: 12, marginBottom: 24 }}
      >
        <div className="flex items-center justify-end mb-3 dcs-no-print">
          <button
            type="button"
            onClick={() => window.print()}
            disabled={submitting}
            title={translate("DCS_BTN_PRINT")}
            className="flex items-center justify-center"
            style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #056daa", opacity: submitting ? 0.6 : 1, cursor: submitting ? "not-allowed" : "pointer" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#056daa" strokeWidth="2">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
          </button>
        </div>

        {submit_state === "success_submitted" || submit_state === "success_offline" ? (
          <div className="w-full py-12 flex flex-col items-center text-center gap-3">
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 20, color: "#333333", textTransform: "uppercase" }}>
              {translate(submit_state === "success_submitted" ? "DCS_PUBLIC_RESPONSE_SAVED_TITLE" : "DCS_PUBLIC_SAVED_OFFLINE_TITLE")}
            </span>
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 14, color: "#666666", maxWidth: 460 }}>
              {translate(submit_state === "success_submitted" ? "DCS_PUBLIC_RESPONSE_SAVED_DESCRIPTION" : "DCS_PUBLIC_SUBMIT_QUEUED_OFFLINE")}
            </span>
            <button
              type="button"
              onClick={() => setSubmitState("idle")}
              className="cursor-pointer underline bg-transparent border-0 p-0 mt-2"
              style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 14, fontWeight: 600, color: "#056daa" }}
            >
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
            />

            <div className="w-full mt-3 dcs-no-print">
              <DcsButtonOutline className="w-full" onClick={handle_save_draft_click} disabled={submitting}>
                {translate("DCS_BTN_SAVE_DRAFT")}
              </DcsButtonOutline>
            </div>
          </>
        )}
      </div>

      {is_syncing && is_online && (
        <div
          className="dcs-no-print flex items-center gap-2"
          style={{
            position: "fixed",
            bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 30,
            backgroundColor: "rgba(255,255,255,0.55)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.6)",
            boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
            padding: "0.5rem 1rem",
          }}
        >
          <span className="dcs-inline-spinner" style={{ color: "#056daa", flexShrink: 0 }} />
          <span className="text-xs font-semibold" style={{ color: "#056daa", fontFamily: "'Montserrat', sans-serif" }}>
            {file_upload_percent !== null
              ? translate("DCS_PUBLIC_UPLOADING_FILES_INDICATOR", { percent: file_upload_percent })
              : translate("DCS_PUBLIC_SUBMITTING_INDICATOR")}
          </span>
        </div>
      )}

      {is_queue_open && (
        <DcsQueuePanel
          records={queue_records}
          draft={draft}
          isOnline={is_online}
          isSyncing={is_syncing}
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
    </div>
  );
}

/**
 * Wraps the page with its own language provider - this is a standalone
 * public route, not nested under the authenticated DCS shell.
 */
export default function PublicFormPage() {
  return (
    <DcsErrorBoundary>
      <DcsLanguageProvider>
        <PublicFormPageContent />
      </DcsLanguageProvider>
    </DcsErrorBoundary>
  );
}
