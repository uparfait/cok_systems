import React, { useEffect, useRef, useState } from "react";
import * as Progress from "@radix-ui/react-progress";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { useToast } from "@/core/contexts/ToastContext";
import { run_import, get_import_status } from "../../services/importService.js";
import DcsButtonPrimary from "../DcsButtonPrimary.jsx";
import DcsButtonOutline from "../DcsButtonOutline.jsx";

const FONT = { fontFamily: "'Montserrat', sans-serif" };
const POLL_MS = 1000;

export default function DcsImportRunStep({ formGroupId, importId, mapping, defaults, onBusy, onBack, onFinished }) {
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const [status, setStatus] = useState(null);
  const [failure, setFailure] = useState("");
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
      else {
        fail(next.error || next.message || t("DCS_IMPORT_ERROR_GENERIC"));
        setFailure(next.error || next.message || t("DCS_IMPORT_ERROR_GENERIC"));
      }
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
          finish({ status: "failed", error: error.message });
          return;
        }
      }
      timer = setTimeout(poll, POLL_MS);
    };

    run_import(formGroupId, importId, mapping, defaults)
      .then((response) => {
        setStatus(response.data);
        timer = setTimeout(poll, POLL_MS);
      })
      .catch((error) => {
        setStatus({ status: "failed" });
        finish({ status: "failed", error: error.message || latest.current.translate("DCS_IMPORT_ERROR_GENERIC") });
      });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [formGroupId, importId, mapping, defaults]);

  const total = status ? status.total_rows || 0 : 0;
  const is_saving = status && status.stage === "saving";
  const done = status ? (is_saving ? status.done_rows || 0 : status.checked_rows || 0) : 0;
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const running = !status || status.status === "running" || status.status === "uploaded";
  const stage_text = () => {
    if (!status || (!status.stage && status.status !== "done" && status.status !== "failed")) return translate("DCS_IMPORT_STARTING");
    if (status.status === "done") return status.message || translate("DCS_IMPORT_DONE", { count: status.created || 0 });
    if (status.status === "failed") return translate("DCS_IMPORT_FAILED_TITLE");
    return translate(is_saving ? "DCS_IMPORT_SAVING" : "DCS_IMPORT_CHECKING", { done, total });
  };

  return (
    <div className="max-w-xl mx-auto w-full">
      <div className="mb-4">
        <div className="flex items-center justify-between gap-3 mb-1">
          <span className="text-sm min-w-0" style={{ color: status && status.status === "failed" ? "#E74C3C" : "#555555", ...FONT }}>
            {stage_text()}
          </span>
          <span className="text-sm font-medium flex-shrink-0" style={FONT}>
            {translate("DCS_IMPORT_ROWS_PROGRESS", { done: status && status.status === "done" ? status.created || 0 : done, total })}
          </span>
        </div>
        <Progress.Root className="relative w-full h-3 bg-gray-200 overflow-hidden" value={status && status.status === "done" ? 100 : percent}>
          <Progress.Indicator className="h-full transition-all duration-300 ease-out" style={{ width: `${status && status.status === "done" ? 100 : percent}%`, backgroundColor: status && status.status === "failed" ? "#E74C3C" : "#056daa" }} />
        </Progress.Root>
      </div>

      {status && status.status === "done" && (
        <p className="text-sm font-semibold" style={{ color: "#27AE60", ...FONT }}>
          {status.message || translate("DCS_IMPORT_DONE", { count: status.created || 0 })}
        </p>
      )}
      {status && status.status === "failed" && (
        <div className="border-2 p-3" style={{ borderColor: "#E74C3C" }}>
          <p className="text-sm font-semibold break-words" style={{ color: "#E74C3C", ...FONT }}>
            {failure}
          </p>
          <p className="text-xs mt-1" style={{ color: "#555555", ...FONT }}>
            {translate("DCS_IMPORT_NOTHING_SAVED")}
          </p>
        </div>
      )}

      {!running && (
        <div className="flex justify-end gap-2 mt-4">
          {status && status.status === "failed" && onBack ? <DcsButtonOutline onClick={onBack}>{translate("DCS_BTN_BACK")}</DcsButtonOutline> : null}
          <DcsButtonPrimary onClick={() => onFinished(status ? status.status : "failed")}>{translate("DCS_IMPORT_DONE_BTN")}</DcsButtonPrimary>
        </div>
      )}
    </div>
  );
}
