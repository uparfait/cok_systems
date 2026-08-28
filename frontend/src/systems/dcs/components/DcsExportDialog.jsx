import React, { useState, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Progress from "@radix-ui/react-progress";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "@/core/contexts/ToastContext";
import { export_submissions } from "../services/submissionsService.js";
import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import { get_field_text } from "../fields/fieldText.js";

const EXPORT_PERIOD_OPTIONS = [
  { value: "today", labelKey: "DCS_STATS_PERIOD_TODAY" },
  { value: "this_month", labelKey: "DCS_STATS_PERIOD_THIS_MONTH" },
  { value: "last_month", labelKey: "DCS_STATS_PERIOD_LAST_MONTH" },
  { value: "this_year", labelKey: "DCS_STATS_PERIOD_THIS_YEAR" },
  { value: "custom", labelKey: "DCS_STATS_PERIOD_CUSTOM" },
];

const NON_DATA_TYPES = ["section", "paragraph", "header", "file", "group", "image_block", "horizontal_line"];

function resolve_date_bounds(period, from, to) {
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

function sanitize_filename(name) {
  return name.replace(/[^a-zA-Z0-9_\-\s]/g, "").trim().replace(/\s+/g, "_");
}

export default function DcsExportDialog({ open, onOpenChange, form_group_id, versions }) {
  const { language, translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const [period, setPeriod] = useState("this_month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [title, setTitle] = useState("");
  const [progress, setProgress] = useState(0);
  const [progress_label, setProgressLabel] = useState("");
  const [is_exporting, setIsExporting] = useState(false);
  const [is_complete, setIsComplete] = useState(false);
  const [record_count, setRecordCount] = useState(0);
  const cancel_ref = useRef(false);

  const reset_state = () => {
    setPeriod("this_month");
    setFrom("");
    setTo("");
    setTitle("");
    setProgress(0);
    setProgressLabel("");
    setIsExporting(false);
    setIsComplete(false);
    setRecordCount(0);
    cancel_ref.current = false;
  };

  const handle_close = () => {
    if (is_exporting) {
      cancel_ref.current = true;
    }
    reset_state();
    onOpenChange(false);
  };

  const build_excel_and_download = async (submissions) => {
    const ExcelJS = (await import("exceljs")).default;
    const { saveAs } = await import("file-saver");

    const active_version_doc = versions.find((entry) => entry.is_active) || versions[0];
    const all_field_defs = new Map();
    (versions || []).forEach((version_doc) => {
      flatten_fields(version_doc.schema.fields).forEach((field) => {
        if (!NON_DATA_TYPES.includes(field.type) && !all_field_defs.has(field.id)) {
          all_field_defs.set(field.id, field);
        }
      });
    });

    const data_fields = [...all_field_defs.values()];

    setProgressLabel(translate("DCS_EXPORT_BUILDING"));
    setProgress(60);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Data");

    const headers = [
      ...data_fields.map((field) => get_field_text(field.label, language) || field.id),
      "Version",
      "Submitted At",
    ];

    sheet.columns = headers.map((header) => ({ header: String(header), key: header, width: 20 }));
    sheet.getRow(1).font = { bold: true };

    const total_rows = submissions.length;
    const batch_size = 100;

    for (let i = 0; i < submissions.length; i += batch_size) {
      if (cancel_ref.current) return;
      const batch = submissions.slice(i, i + batch_size);
      batch.forEach((submission) => {
        const row_data = {};
        data_fields.forEach((field) => {
          const raw_value = submission.data ? submission.data[field.id] : undefined;
          if (Array.isArray(raw_value)) {
            row_data[get_field_text(field.label, language) || field.id] = raw_value.join(", ");
          } else if (raw_value != null && typeof raw_value === "object") {
            row_data[get_field_text(field.label, language) || field.id] = JSON.stringify(raw_value);
          } else {
            row_data[get_field_text(field.label, language) || field.id] = raw_value != null ? String(raw_value) : "";
          }
        });
        row_data["Version"] = submission.version || "";
        row_data["Submitted At"] = submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : "";
        sheet.addRow(row_data);
      });
      const build_progress = 60 + Math.round((i / total_rows) * 30);
      setProgress(build_progress);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    if (cancel_ref.current) return;

    setProgressLabel(translate("DCS_EXPORT_DOWNLOADING"));
    setProgress(95);

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = sanitize_filename(title || "export") + ".xlsx";
    saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);

    setProgress(100);
    setProgressLabel(translate("DCS_EXPORT_COMPLETE"));
    setIsComplete(true);
    showSuccess(translate("DCS_EXPORT_COMPLETE"));
  };

  const handle_export = async () => {
    if (period === "custom" && !from) return;

    setIsExporting(true);
    setIsComplete(false);
    setProgress(0);
    cancel_ref.current = false;

    try {
      setProgressLabel(translate("DCS_EXPORT_FETCHING"));
      setProgress(10);

      const bounds = resolve_date_bounds(period, from, to);
      const response = await export_submissions(form_group_id, period === "custom" ? "custom" : period, bounds.from, bounds.to);

      if (cancel_ref.current) return;

      const submissions = response.data || [];
      setRecordCount(submissions.length);

      if (submissions.length === 0) {
        setProgress(100);
        setProgressLabel(translate("DCS_EXPORT_ERROR_NO_DATA"));
        showError(translate("DCS_EXPORT_ERROR_NO_DATA"));
        setIsComplete(true);
        return;
      }

      setProgress(30);

      await build_excel_and_download(submissions);
    } catch (error) {
      if (!cancel_ref.current) {
        setProgress(0);
        setProgressLabel("");
        showError(error.message || translate("DCS_EXPORT_ERROR_FAILED"));
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
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
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
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm disabled:opacity-50"
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
                      className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm disabled:opacity-50"
                      style={{ height: 40 }}
                    />
                    <input
                      type="date"
                      value={to}
                      onChange={(event) => setTo(event.target.value)}
                      disabled={is_exporting}
                      className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm disabled:opacity-50"
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
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm disabled:opacity-50"
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
                className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden"
                value={progress}
              >
                <Progress.Indicator
                  className="h-full bg-[#056daa] transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </Progress.Root>
              {record_count > 0 && is_complete && (
                <p className="text-xs text-gray-500 mt-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  {translate("DCS_EXPORT_RECORDS_COUNT", { count: record_count })}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            {!is_complete && (
              <>
                <button
                  type="button"
                  onClick={handle_close}
                  className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                  {translate("DCS_EXPORT_BTN_CANCEL")}
                </button>
                <button
                  type="button"
                  onClick={handle_export}
                  disabled={!can_export}
                  className="px-4 py-2 text-sm text-white bg-[#056daa] rounded hover:bg-[#045a8c] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                className="px-4 py-2 text-sm text-white bg-[#056daa] rounded hover:bg-[#045a8c]"
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
