import React, { useState, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Progress from "@radix-ui/react-progress";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "@/core/contexts/ToastContext";
import { start_export_job, get_export_job, cancel_export_job, download_export_job } from "../services/submissionsService.js";
import DcsButtonPrimary from "./DcsButtonPrimary.jsx";
import DcsButtonOutline from "./DcsButtonOutline.jsx";

const FONT = { fontFamily: "'Montserrat', sans-serif" };
const EXPORT_PERIOD_OPTIONS = [
  { value: "all", labelKey: "DCS_STATS_PERIOD_ALL" },
  { value: "today", labelKey: "DCS_STATS_PERIOD_TODAY" },
  { value: "this_month", labelKey: "DCS_STATS_PERIOD_THIS_MONTH" },
  { value: "last_month", labelKey: "DCS_STATS_PERIOD_LAST_MONTH" },
  { value: "this_year", labelKey: "DCS_STATS_PERIOD_THIS_YEAR" },
  { value: "custom", labelKey: "DCS_STATS_PERIOD_CUSTOM" },
];

async function poll_with_retry(job_id, known_percent) {
  let last_error = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return await get_export_job(job_id, known_percent);
    } catch (error) {
      last_error = error;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  throw last_error;
}

function save_blob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function DcsExportDialog({ open, onOpenChange, form_group_id }) {
  const { language, translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const [period, setPeriod] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [title, setTitle] = useState("");
  const [job, setJob] = useState(null);
  const [stage, setStage] = useState("");
  const [download_percent, setDownloadPercent] = useState(null);
  const [is_exporting, setIsExporting] = useState(false);
  const [is_complete, setIsComplete] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const cancel_ref = useRef(false);
  const job_id_ref = useRef("");

  const reset_state = () => {
    setPeriod("all");
    setFrom("");
    setTo("");
    setTitle("");
    setJob(null);
    setStage("");
    setDownloadPercent(null);
    setIsExporting(false);
    setIsComplete(false);
    setCancelling(false);
    cancel_ref.current = false;
    job_id_ref.current = "";
  };

  const handle_close = () => {
    cancel_ref.current = true;
    if (job_id_ref.current) cancel_export_job(job_id_ref.current).catch(() => {});
    reset_state();
    onOpenChange(false);
  };

  const handle_cancel = async () => {
    if (!is_exporting || !job_id_ref.current) {
      handle_close();
      return;
    }
    setCancelling(true);
    setStage("cancelling");
    try {
      await cancel_export_job(job_id_ref.current);
    } catch (error) {
      setCancelling(false);
      showError(error.message || translate("DCS_EXPORT_ERROR_FAILED"));
    }
  };

  const handle_export = async () => {
    if (period === "custom" && !from) return;
    setIsExporting(true);
    setIsComplete(false);
    setDownloadPercent(null);
    cancel_ref.current = false;
    setStage("counting");
    try {
      const started = await start_export_job(form_group_id, { period, from: period === "custom" ? from : "", to: period === "custom" ? to : "", title, language });
      let current = started.data;
      job_id_ref.current = current.job_id;
      setJob(current);
      let known_percent = current.percent;
      while (!cancel_ref.current && current.status === "running") {
        const response = await poll_with_retry(current.job_id, known_percent);
        current = response.data;
        known_percent = current.percent;
        setJob(current);
        setStage(current.cancel_requested && current.status === "running" ? "cancelling" : current.stage);
      }
      if (cancel_ref.current) return;
      if (current.status === "cancelled") {
        setStage("cancelled");
        setCancelling(false);
        showSuccess(translate("DCS_EXPORT_CANCELLED_TOAST"));
        return;
      }
      if (current.status !== "completed") throw new Error(current.error || translate("DCS_EXPORT_ERROR_FAILED"));
      setStage("downloading");
      const result = await download_export_job(current.job_id, (percent) => setDownloadPercent(percent));
      if (cancel_ref.current) return;
      save_blob(result.blob, result.filename || `${title || "export"}.xlsx`);
      setStage("complete");
      setIsComplete(true);
      showSuccess(translate("DCS_EXPORT_COMPLETE"));
    } catch (error) {
      if (!cancel_ref.current) {
        setStage("");
        setJob(null);
        showError(error.message || translate("DCS_EXPORT_ERROR_FAILED"));
      }
    } finally {
      setIsExporting(false);
      job_id_ref.current = "";
    }
  };

  const stage_text = () => {
    if (stage === "counting") return translate("DCS_EXPORT_COUNTING");
    if (stage === "writing" || stage === "finishing") return translate("DCS_EXPORT_WRITING", { processed: job ? job.processed : 0, total: job ? job.total : 0 });
    if (stage === "cancelling") return translate("DCS_EXPORT_CANCELLING");
    if (stage === "downloading") return translate("DCS_EXPORT_DOWNLOADING");
    if (stage === "complete") return translate("DCS_EXPORT_COMPLETE");
    if (stage === "cancelled") return translate("DCS_EXPORT_CANCELLED");
    return "";
  };
  const percent = stage === "complete" ? 100 : stage === "downloading" ? (download_percent === null ? 100 : download_percent) : job ? job.percent : 0;
  const can_export = !is_exporting && (period !== "custom" || from);

  return (
    <Dialog.Root open={open} onOpenChange={handle_close}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-none bg-white p-5 sm:p-6 shadow-xl">
          <Dialog.Title className="text-lg font-semibold mb-4" style={FONT}>
            {translate("DCS_EXPORT_DIALOG_TITLE")}
          </Dialog.Title>

          {!is_complete && (
            <>
              <div className="mb-4">
                <label className="cok-auth-label">{translate("DCS_EXPORT_PERIOD_LABEL")}</label>
                <select value={period} onChange={(event) => setPeriod(event.target.value)} disabled={is_exporting} className="cok-auth-input w-full cursor-pointer" style={{ paddingLeft: 14, ...FONT }}>
                  {EXPORT_PERIOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {translate(option.labelKey)}
                    </option>
                  ))}
                </select>
                {period === "custom" && (
                  <div className="flex gap-2 mt-2">
                    <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} disabled={is_exporting} className="cok-auth-input flex-1 min-w-0" style={{ paddingLeft: 14 }} />
                    <input type="date" value={to} onChange={(event) => setTo(event.target.value)} disabled={is_exporting} className="cok-auth-input flex-1 min-w-0" style={{ paddingLeft: 14 }} />
                  </div>
                )}
              </div>
              <div className="mb-4">
                <label className="cok-auth-label">{translate("DCS_EXPORT_TITLE_LABEL")}</label>
                <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={translate("DCS_EXPORT_TITLE_PLACEHOLDER")} disabled={is_exporting} className="cok-auth-input w-full" style={{ paddingLeft: 14, ...FONT }} />
              </div>
            </>
          )}

          {(is_exporting || is_complete || stage === "cancelled") && (
            <div className="mb-4">
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="text-sm min-w-0" style={{ color: "#555555", ...FONT }}>
                  {stage_text()}
                </span>
                <span className="text-sm font-medium flex-shrink-0" style={FONT}>
                  {translate("DCS_EXPORT_PROGRESS", { percent })}
                </span>
              </div>
              <Progress.Root className="relative w-full h-3 bg-gray-200 rounded-none overflow-hidden" value={percent}>
                <Progress.Indicator className="h-full bg-[#056daa] transition-all duration-300 ease-out" style={{ width: `${percent}%` }} />
              </Progress.Root>
              {job && job.total > 0 && stage !== "complete" && (
                <p className="text-xs mt-1" style={{ color: "#9E9E9E", ...FONT }}>
                  {translate("DCS_EXPORT_RECORDS_COUNT", { count: job.total })}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            {!is_complete && stage !== "cancelled" && (
              <>
                <DcsButtonOutline onClick={handle_cancel} disabled={cancelling}>
                  {cancelling ? translate("DCS_EXPORT_CANCELLING_BTN") : translate("DCS_EXPORT_BTN_CANCEL")}
                </DcsButtonOutline>
                <DcsButtonPrimary onClick={handle_export} disabled={!can_export || cancelling}>
                  {is_exporting ? translate("DCS_WAITING_GENERIC") : translate("DCS_EXPORT_BTN_EXPORT")}
                </DcsButtonPrimary>
              </>
            )}
            {(is_complete || stage === "cancelled") && <DcsButtonPrimary onClick={handle_close}>{translate("DCS_EXPORT_BTN_CLOSE")}</DcsButtonPrimary>}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
