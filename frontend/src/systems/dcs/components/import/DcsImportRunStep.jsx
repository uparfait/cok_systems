import React, { useEffect, useRef, useState } from "react";
import * as Progress from "@radix-ui/react-progress";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { useToast } from "@/core/contexts/ToastContext";
import { run_import, get_import_status } from "../../services/importService.js";
import DcsButtonPrimary from "../DcsButtonPrimary.jsx";
import DcsButtonOutline from "../DcsButtonOutline.jsx";
import DcsImportLinesDialog from "./DcsImportLinesDialog.jsx";

const FONT = { fontFamily: "'Montserrat', sans-serif" };
const DANGER = "#E74C3C";
const PRIMARY = "#056daa";
const SUCCESS = "#27AE60";
const POLL_MS = 1000;

function LinkButton({ onClick, children }) {
  return (
    <button type="button" className="text-xs font-semibold underline cursor-pointer bg-transparent border-0 p-0" style={{ color: PRIMARY, ...FONT }} onClick={onClick}>
      {children}
    </button>
  );
}

export default function DcsImportRunStep({ formGroupId, importId, mapping, onBusy, onBack, onFinished }) {
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const [status, setStatus] = useState(null);
  const [dialog, setDialog] = useState(null);
  const started = useRef(false);
  const finished = useRef(false);
  const latest = useRef({});
  latest.current = { onBusy, showSuccess, showError, translate };

  useEffect(() => {
    if (started.current) return undefined;
    started.current = true;
    let timer = null;
    let cancelled = false;
    latest.current.onBusy(true);

    const finish = (next) => {
      if (finished.current) return;
      finished.current = true;
      const { onBusy: set_busy, showSuccess: success, showError: fail, translate: t } = latest.current;
      set_busy(false);
      if (next.status === "done") {
        success(next.message || t("DCS_IMPORT_DONE", { count: next.created }));
        return;
      }
      fail(next.message || next.error || t("DCS_IMPORT_ERROR_GENERIC"));
      if (next.errors && next.errors.length > 0) setDialog("errors");
    };

    const poll = async () => {
      if (cancelled) return;
      try {
        const response = await get_import_status(formGroupId, importId);
        const next = response.data;
        setStatus(next);
        if (next.status === "done" || next.status === "failed") {
          finish(next);
          return;
        }
      } catch (error) {
        if (!error.is_network_error) {
          const failed = { status: "failed", error: error.message, errors: [], notes: [] };
          setStatus(failed);
          finish(failed);
          return;
        }
      }
      timer = setTimeout(poll, POLL_MS);
    };

    run_import(formGroupId, importId, mapping)
      .then((response) => {
        setStatus(response.data);
        timer = setTimeout(poll, POLL_MS);
      })
      .catch((error) => {
        const failed = { status: "failed", error: error.message || latest.current.translate("DCS_IMPORT_ERROR_GENERIC"), errors: [], notes: [] };
        setStatus(failed);
        finish(failed);
      });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [formGroupId, importId, mapping]);

  const total = status ? status.total_rows || 0 : 0;
  const is_saving = status && status.stage === "saving";
  const done = status ? (is_saving ? status.done_rows || 0 : status.checked_rows || 0) : 0;
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const is_done = status && status.status === "done";
  const is_failed = status && status.status === "failed";
  const running = !status || (!is_done && !is_failed);
  const errors = (status && status.errors) || [];
  const notes = (status && status.notes) || [];
  const error_total = status ? status.error_count || errors.length : 0;
  const note_total = status ? status.note_count || notes.length : 0;
  const media = (status && status.media_failures) || [];
  const media_total = status ? status.media_failure_count || media.length : 0;
  const stage_text = () => {
    if (!status || (!status.stage && running)) return translate("DCS_IMPORT_STARTING");
    if (is_done) return status.message || translate("DCS_IMPORT_DONE", { count: status.created || 0 });
    if (is_failed) return translate("DCS_IMPORT_FAILED_TITLE");
    return translate(is_saving ? "DCS_IMPORT_SAVING" : "DCS_IMPORT_CHECKING", { done, total });
  };
  const error_line = (entry) => (!entry.field && !entry.column ? entry.reason : translate(entry.column ? "DCS_IMPORT_ERROR_LINE" : "DCS_IMPORT_ERROR_LINE_NO_COLUMN", { row: entry.row, column: entry.column, field: entry.field, reason: entry.reason }));
  const note_line = (entry) => translate("DCS_IMPORT_NOTE_LINE", { row: entry.row, column: entry.column, from: entry.from, to: entry.to });
  const media_line = (entry) => translate("DCS_IMPORT_MEDIA_LINE", { row: entry.row, column: entry.column, field: entry.field, link: entry.link, reason: entry.reason });
  const notes_block = (
    <>
      {note_total > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-xs" style={{ color: "#555555", ...FONT }}>
            {translate("DCS_IMPORT_NOTES_COUNT", { count: note_total })}
          </span>
          <LinkButton onClick={() => setDialog("notes")}>{translate("DCS_IMPORT_VIEW_NOTES")}</LinkButton>
        </div>
      ) : null}
      {media_total > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-xs" style={{ color: "#555555", ...FONT }}>
            {translate("DCS_IMPORT_MEDIA_COUNT", { count: media_total })}
          </span>
          <LinkButton onClick={() => setDialog("media")}>{translate("DCS_IMPORT_VIEW_MEDIA")}</LinkButton>
        </div>
      ) : null}
    </>
  );

  return (
    <div className="max-w-xl mx-auto w-full flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="mb-4">
          <div className="flex items-center justify-between gap-3 mb-1">
            <span className="text-sm min-w-0" style={{ color: is_failed ? DANGER : "#555555", ...FONT }}>
              {stage_text()}
            </span>
            <span className="text-sm font-medium flex-shrink-0" style={FONT}>
              {translate("DCS_IMPORT_ROWS_PROGRESS", { done: is_done ? status.created || 0 : done, total })}
            </span>
          </div>
          <Progress.Root className="relative w-full h-3 bg-gray-200 overflow-hidden" value={is_done ? 100 : percent}>
            <Progress.Indicator className="h-full transition-all duration-300 ease-out" style={{ width: `${is_done ? 100 : percent}%`, backgroundColor: is_failed ? DANGER : PRIMARY }} />
          </Progress.Root>
        </div>

        {is_done && (
          <div>
            <p className="text-sm font-semibold" style={{ color: SUCCESS, ...FONT }}>
              {status.message || translate("DCS_IMPORT_DONE", { count: status.created || 0 })}
            </p>
            {notes_block}
          </div>
        )}
        {is_failed && (
          <div className="border-2 p-3" style={{ borderColor: DANGER }}>
            <p className="text-sm font-semibold" style={{ color: DANGER, overflowWrap: "anywhere", ...FONT }}>
              {status.message || translate("DCS_IMPORT_NOTHING_SAVED")}
            </p>
            {status.error && errors.length === 0 ? (
              <p className="text-xs mt-1" style={{ color: "#555555", overflowWrap: "anywhere", ...FONT }}>
                {status.error}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              {errors.length > 0 ? <LinkButton onClick={() => setDialog("errors")}>{translate("DCS_IMPORT_VIEW_ERRORS", { count: error_total })}</LinkButton> : null}
            </div>
            {notes_block}
          </div>
        )}
      </div>

      {!running && (
        <div className={`flex-shrink-0 grid gap-2 pt-3 mt-3 border-t ${is_failed ? "grid-cols-2" : "grid-cols-1"}`} style={{ borderColor: "#E0E0E0" }}>
          {is_failed ? (
            <DcsButtonOutline className="w-full" onClick={onBack}>
              {translate("DCS_BTN_BACK")}
            </DcsButtonOutline>
          ) : null}
          <DcsButtonPrimary className="w-full" onClick={() => onFinished(status ? status.status : "failed")}>
            {translate("DCS_IMPORT_DONE_BTN")}
          </DcsButtonPrimary>
        </div>
      )}

      {dialog === "errors" && errors.length > 0 ? <DcsImportLinesDialog title={translate("DCS_IMPORT_ERRORS_TITLE", { count: error_total })} subtitle={status.message || translate("DCS_IMPORT_NOTHING_SAVED")} lines={errors.map(error_line)} more={error_total - errors.length} onClose={() => setDialog(null)} /> : null}
      {dialog === "notes" && notes.length > 0 ? <DcsImportLinesDialog title={translate("DCS_IMPORT_NOTES_TITLE", { count: note_total })} subtitle={translate("DCS_IMPORT_NOTES_COUNT", { count: note_total })} lines={notes.map(note_line)} more={note_total - notes.length} onClose={() => setDialog(null)} /> : null}
      {dialog === "media" && media.length > 0 ? <DcsImportLinesDialog title={translate("DCS_IMPORT_MEDIA_TITLE", { count: media_total })} subtitle={translate("DCS_IMPORT_MEDIA_COUNT", { count: media_total })} lines={media.map(media_line)} more={media_total - media.length} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
