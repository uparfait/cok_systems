import React, { useEffect, useRef, useState } from "react";
import * as Progress from "@radix-ui/react-progress";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { useToast } from "@/core/contexts/ToastContext";
import { run_import, get_import_status } from "../../services/importService.js";
import DcsButtonPrimary from "../DcsButtonPrimary.jsx";
import DcsButtonOutline from "../DcsButtonOutline.jsx";

const FONT = { fontFamily: "'Montserrat', sans-serif" };
const DANGER = "#E74C3C";
const POLL_MS = 1000;

function ErrorsTable({ errors, total, translate }) {
  if (!errors || errors.length === 0) return null;
  const columns = ["DCS_IMPORT_ERRORS_ROW", "DCS_IMPORT_ERRORS_COLUMN", "DCS_IMPORT_ERRORS_FIELD", "DCS_IMPORT_ERRORS_REASON"];
  return (
    <div className="mt-3">
      <div className="cok-table-scroll border" style={{ borderColor: "#E0E0E0", "--cok-table-max-h": "40vh" }}>
        <table className="w-full text-xs" style={FONT}>
          <thead>
            <tr>
              {columns.map((key) => (
                <th key={key} className="text-left font-bold uppercase px-2 py-1.5 border-b" style={{ color: "#9E9E9E", borderColor: "#E0E0E0", letterSpacing: "0.4px" }}>
                  {translate(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {errors.map((entry, index) => (
              <tr key={`${entry.row}-${index}`}>
                <td className="px-2 py-1 border-b" style={{ color: "#333333", borderColor: "#F0F0F0" }}>{entry.row}</td>
                <td className="px-2 py-1 border-b" style={{ color: "#333333", borderColor: "#F0F0F0" }}>{entry.column}</td>
                <td className="px-2 py-1 border-b" style={{ color: "#333333", borderColor: "#F0F0F0" }}>{entry.field}</td>
                <td className="px-2 py-1 border-b" style={{ color: DANGER, borderColor: "#F0F0F0", whiteSpace: "normal" }}>{entry.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > errors.length ? (
        <p className="text-xs mt-1" style={{ color: "#9E9E9E", ...FONT }}>
          {translate("DCS_IMPORT_ERRORS_MORE", { count: total - errors.length })}
        </p>
      ) : null}
    </div>
  );
}

export default function DcsImportRunStep({ formGroupId, importId, mapping, onBusy, onBack, onFinished }) {
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const [status, setStatus] = useState(null);
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
      if (next.status === "done") success(next.message || t("DCS_IMPORT_DONE", { count: next.created }));
      else fail(next.message || next.error || t("DCS_IMPORT_ERROR_GENERIC"));
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
          const failed = { status: "failed", error: error.message, errors: [] };
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
        const failed = { status: "failed", error: error.message || latest.current.translate("DCS_IMPORT_ERROR_GENERIC"), errors: [] };
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
  const stage_text = () => {
    if (!status || (!status.stage && running)) return translate("DCS_IMPORT_STARTING");
    if (is_done) return status.message || translate("DCS_IMPORT_DONE", { count: status.created || 0 });
    if (is_failed) return translate("DCS_IMPORT_FAILED_TITLE");
    return translate(is_saving ? "DCS_IMPORT_SAVING" : "DCS_IMPORT_CHECKING", { done, total });
  };

  return (
    <div className="max-w-3xl mx-auto w-full">
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
          <Progress.Indicator className="h-full transition-all duration-300 ease-out" style={{ width: `${is_done ? 100 : percent}%`, backgroundColor: is_failed ? DANGER : "#056daa" }} />
        </Progress.Root>
      </div>

      {is_done && (
        <p className="text-sm font-semibold" style={{ color: "#27AE60", ...FONT }}>
          {status.message || translate("DCS_IMPORT_DONE", { count: status.created || 0 })}
        </p>
      )}
      {is_failed && (
        <div>
          <div className="border-2 p-3" style={{ borderColor: DANGER }}>
            <p className="text-sm font-semibold break-words" style={{ color: DANGER, ...FONT }}>
              {status.message || translate("DCS_IMPORT_NOTHING_SAVED")}
            </p>
            {status.error && (!status.errors || status.errors.length === 0) ? (
              <p className="text-xs mt-1 break-words" style={{ color: "#555555", ...FONT }}>
                {status.error}
              </p>
            ) : null}
          </div>
          <ErrorsTable errors={status.errors || []} total={status.error_count || 0} translate={translate} />
        </div>
      )}

      {!running && (
        <div className="flex justify-end gap-2 mt-4">
          {is_failed ? <DcsButtonOutline onClick={onBack}>{translate("DCS_BTN_BACK")}</DcsButtonOutline> : null}
          <DcsButtonPrimary onClick={() => onFinished(status ? status.status : "failed")}>{translate("DCS_IMPORT_DONE_BTN")}</DcsButtonPrimary>
        </div>
      )}
    </div>
  );
}
