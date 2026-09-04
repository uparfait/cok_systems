import React, { useState, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Progress from "@radix-ui/react-progress";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "@/core/contexts/ToastContext";
import { export_submissions_excel } from "../services/submissionsService.js";

const EXPORT_PERIOD_OPTIONS = [
  { value: "all", labelKey: "DCS_STATS_PERIOD_ALL" },
  { value: "today", labelKey: "DCS_STATS_PERIOD_TODAY" },
  { value: "this_month", labelKey: "DCS_STATS_PERIOD_THIS_MONTH" },
  { value: "last_month", labelKey: "DCS_STATS_PERIOD_LAST_MONTH" },
  { value: "this_year", labelKey: "DCS_STATS_PERIOD_THIS_YEAR" },
  { value: "custom", labelKey: "DCS_STATS_PERIOD_CUSTOM" },
];

function resolve_date_bounds(period, from, to) {
  // "all" means no window at all - the backend exports every submission the form ever collected.
  if (period === "all") {
    return { from: "", to: "" };
  }
  if (!period || period === "custom") {
    return { from, to };
  }
  const now = new Date();
  const start_of_day = (date) => {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result.toISOString().split("T")[0];
  };
  const end_of_day = (date) => {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result.toISOString().split("T")[0];
  };
  if (period === "today") {
    return { from: start_of_day(now), to: end_of_day(now) };
  }
  if (period === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: start_of_day(start), to: end_of_day(end) };
  }
  if (period === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: start_of_day(start), to: end_of_day(end) };
  }
  if (period === "this_year") {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    return { from: start_of_day(start), to: end_of_day(end) };
  }
  return { from: "", to: "" };
}

export default function DcsExportDialog({ open, onOpenChange, form_group_id }) {
  const { language, translate } = useDcsLanguage();
  const { showSuccess, showError, showInfo } = useToast();
  const [period, setPeriod] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [title, setTitle] = useState("");
  const [progress, setProgress] = useState(0);
  const [progress_label, setProgressLabel] = useState("");
  const [is_exporting, setIsExporting] = useState(false);
  const [is_complete, setIsComplete] = useState(false);
  const cancel_ref = useRef(false);

  const reset_state = () => {
    setPeriod("all");
    setFrom("");
    setTo("");
    setTitle("");
    setProgress(0);
    setProgressLabel("");
    setIsExporting(false);
    setIsComplete(false);
    cancel_ref.current = false;
  };

  const handle_close = () => {
    if (is_exporting) {
      cancel_ref.current = true;
    }
    reset_state();
    onOpenChange(false);
  };

  const handle_export = async () => {
    if (period === "custom" && !from) return;

    setIsExporting(true);
    setIsComplete(false);
    setProgress(0);
    cancel_ref.current = false;

    try {
      setProgressLabel(translate("DCS_EXPORT_FETCHING"));
      setProgress(5);

      const bounds = resolve_date_bounds(period, from, to);

      const result = await export_submissions_excel(
        form_group_id,
        period === "custom" ? "custom" : period,
        bounds.from,
        bounds.to,
        title,
        language,
        (percent) => {
          setProgress(percent);
        },
      );

      if (cancel_ref.current) return;

      setProgressLabel(translate("DCS_EXPORT_DOWNLOADING"));

      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setProgress(100);
      setProgressLabel(translate("DCS_EXPORT_COMPLETE"));
      setIsComplete(true);
      showSuccess(translate("DCS_EXPORT_COMPLETE"));
    } catch (error) {
      if (!cancel_ref.current) {
        setProgress(0);
        setProgressLabel("");
        if (error.is_info) {
          showInfo(error.message || translate("DCS_EXPORT_ERROR_FAILED"));
        } else {
          showError(error.message || translate("DCS_EXPORT_ERROR_FAILED"));
        }
      }
    } finally {
      setIsExporting(false);
    }
  };

  const can_export = !is_exporting && (period !== "custom" || from);

  return (
    <Dialog.Root open={open} onOpenChange={handle_close}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-none bg-white p-6 shadow-xl">
          <Dialog.Title className="text-lg font-semibold mb-4" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            {translate("DCS_EXPORT_DIALOG_TITLE")}
          </Dialog.Title>

          {!is_complete && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  {translate("DCS_EXPORT_PERIOD_LABEL")}
                </label>
                <select
                  value={period}
                  onChange={(event) => setPeriod(event.target.value)}
                  disabled={is_exporting}
                  className="w-full border border-gray-300 rounded-none px-3 py-2 text-sm disabled:opacity-50 cursor-pointer"
                  style={{ fontFamily: "'Montserrat', sans-serif", height: 40 }}
                >
                  {EXPORT_PERIOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {translate(option.labelKey)}
                    </option>
                  ))}
                </select>
                {period === "custom" && (
                  <div className="flex gap-2 mt-2">
                    <input
                      type="date"
                      value={from}
                      onChange={(event) => setFrom(event.target.value)}
                      disabled={is_exporting}
                      className="flex-1 border border-gray-300 rounded-none px-3 py-2 text-sm disabled:opacity-50 cursor-pointer"
                      style={{ height: 40 }}
                    />
                    <input
                      type="date"
                      value={to}
                      onChange={(event) => setTo(event.target.value)}
                      disabled={is_exporting}
                      className="flex-1 border border-gray-300 rounded-none px-3 py-2 text-sm disabled:opacity-50 cursor-pointer"
                      style={{ height: 40 }}
                    />
                  </div>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  {translate("DCS_EXPORT_TITLE_LABEL")}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={translate("DCS_EXPORT_TITLE_PLACEHOLDER")}
                  disabled={is_exporting}
                  className="w-full border border-gray-300 rounded-none px-3 py-2 text-sm disabled:opacity-50"
                  style={{ fontFamily: "'Montserrat', sans-serif", height: 40 }}
                />
              </div>
            </>
          )}

          {(is_exporting || is_complete) && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  {progress_label}
                </span>
                <span className="text-sm font-medium" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  {translate("DCS_EXPORT_PROGRESS", { percent: progress })}
                </span>
              </div>
              <Progress.Root
                className="relative w-full h-3 bg-gray-200 rounded-none overflow-hidden"
                value={progress}
              >
                <Progress.Indicator
                  className="h-full bg-[#056daa] transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </Progress.Root>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            {!is_complete && (
              <>
                <button
                  type="button"
                  onClick={handle_close}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-none hover:bg-gray-50 cursor-pointer"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                  {translate("DCS_EXPORT_BTN_CANCEL")}
                </button>
                <button
                  type="button"
                  onClick={handle_export}
                  disabled={!can_export}
                  className="px-4 py-2 text-sm text-white bg-[#056daa] rounded-none hover:bg-[#045a8c] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  {translate("DCS_EXPORT_BTN_EXPORT")}
                </button>
              </>
            )}
            {is_complete && (
              <button
                type="button"
                onClick={handle_close}
                className="px-4 py-2 text-sm text-white bg-[#056daa] rounded-none hover:bg-[#045a8c] cursor-pointer"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                {translate("DCS_EXPORT_BTN_CLOSE")}
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
