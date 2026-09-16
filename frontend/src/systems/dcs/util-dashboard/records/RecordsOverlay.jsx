import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { portal_root } from "../portalRoot.js";
import { IconButton, CLOSE_SVG } from "../BoardIcons.jsx";
import DcsDataTable from "../../components/DcsDataTable.jsx";
import DcsButtonOutline from "../../components/DcsButtonOutline.jsx";
import DcsButtonPrimary from "../../components/DcsButtonPrimary.jsx";
import { useToast } from "../../../../core/contexts/ToastContext.tsx";
import { render_answer_cell, column_label } from "../../fields/dataColumns.jsx";
import { flatten_schema_fields } from "../chartCatalog.js";
import { request_error_text } from "../dashboardService.js";

const PRIMARY = "#056daa";
const FONT = { fontFamily: "'Montserrat', sans-serif" };

const format_when = (value, language) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(language === "fr" ? "fr-FR" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
};

/**
 * The records behind a widget, in a full overlay: the submissions its
 * number or chart was computed from - narrowed to what was clicked (a bar,
 * a slice, a point, a cell, a legend entry) or the whole widget - twenty
 * per page with paging, in the same table as the form's data page. The
 * criteria the rows match are listed as chips and their columns are
 * highlighted in blue, with a legend saying so. Above the table sits the
 * Excel export, which the server builds and streams while the button
 * counts the download up. A failed load says why and offers a retry; the overlay closes from its Close button (or Escape).
 *
 * fetchPage(page) returns the server's { items, total, limit, columns,
 * criteria, period }.
 */
export default function RecordsOverlay({ title, subtitle, fetchPage, exportRecords, schema, onClose }) {
  const { translate, language } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  // The Excel export: null while idle, else the download's progress (0-100).
  const [exporting, setExporting] = useState(null);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let is_mounted = true;
    setLoading(true);
    setError("");
    Promise.resolve(fetchPage(page))
      .then((response) => is_mounted && setResult((response && response.data) || response || null))
      .catch((failure) => is_mounted && setError(request_error_text(failure, translate("DCS_DB_RECORDS_ERROR"))))
      .finally(() => is_mounted && setLoading(false));
    return () => {
      is_mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, attempt]);

  useEffect(() => {
    const on_key = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", on_key);
    return () => document.removeEventListener("keydown", on_key);
  }, [onClose]);

  // Column labels follow the viewer's language when the schema is at hand.
  const schema_fields = useMemo(() => new Map(flatten_schema_fields((schema && schema.fields) || []).map((field) => [field.id, field])), [schema]);
  const criteria = (result && result.criteria) || [];
  const highlighted = new Set(criteria.map((entry) => entry.field_id));

  const columns = [{ key: "submitted_at", label: translate("DCS_TABLE_SUBMITTED_AT") }].concat(
    ((result && result.columns) || [])
      .map((column) => {
        const field = schema_fields.get(column.id);
        const label = field ? column_label(field, language, translate) : column.label;
        return label ? { key: column.id, label, type: column.type } : null;
      })
      .filter(Boolean),
  );
  const rows = ((result && result.items) || []).map((item) => {
    const row = { dcs_row_key: item._id, submitted_at: format_when(item.submitted_at, language) };
    columns.forEach((column) => {
      if (column.key !== "submitted_at") row[column.key] = render_answer_cell({ type: column.type }, item.data ? item.data[column.key] : undefined);
    });
    return row;
  });
  const total = result ? result.total || 0 : 0;
  const limit = result ? result.limit || 20 : 20;
  const total_pages = Math.max(1, Math.ceil(total / limit));
  const tints = Object.fromEntries(columns.filter((column) => highlighted.has(column.key)).map((column) => [column.key, "blue"]));
  if (criteria.some((entry) => entry.is_time)) tints.submitted_at = "blue";

  // The server builds the workbook and streams it; the button shows the download's progress.
  const run_export = async () => {
    if (!exportRecords || exporting !== null) return;
    setExporting(0);
    try {
      const file = await exportRecords((percent) => setExporting(percent));
      const href = URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(href);
      showSuccess(translate("DCS_DB_RECORDS_EXPORTED"));
    } catch (failure) {
      showError((failure && failure.message) || translate("DCS_DB_RECORDS_EXPORT_FAILED"));
    } finally {
      setExporting(null);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex flex-col bg-white" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between gap-3 flex-shrink-0 px-4 sm:px-5 py-2" style={{ backgroundColor: PRIMARY }}>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase leading-tight truncate" style={{ color: "#FFFFFF", letterSpacing: "0.3px", ...FONT }}>
            {translate("DCS_DB_RECORDS_TITLE_OF", { title })}
          </p>
          <p className="text-[11px] font-semibold truncate" style={{ color: "rgba(255,255,255,0.85)", ...FONT }}>
            {subtitle || ""}
            {result ? `${subtitle ? " - " : ""}${translate("DCS_DB_RECORDS_COUNT", { count: total.toLocaleString("en-US") })}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <IconButton title={translate("DCS_BTN_CLOSE")} onClick={onClose} onDark danger>
            {CLOSE_SVG}
          </IconButton>
        </div>
      </div>

      <div className="flex-shrink-0 px-4 sm:px-5 py-2 flex flex-wrap items-center gap-2 border-b" style={{ borderColor: "#E0E0E0" }}>
        <span className="text-[11px] font-bold uppercase" style={{ color: "#9E9E9E", letterSpacing: "0.4px", ...FONT }}>
          {translate("DCS_DB_FILTERS_APPLIED")}:
        </span>
        {result && result.period && (
          <span className="dcs-records-chip">
            {translate("DCS_DB_RECORDS_PERIOD")}: {format_when(result.period.start, language)} - {format_when(result.period.end, language)}
          </span>
        )}
        {criteria.map((entry, index) => (
          <span key={`${entry.field_id}-${index}`} className="dcs-records-chip">
            {entry.is_time ? translate("DCS_TABLE_SUBMITTED_AT") : entry.field_label}: {String(entry.value)}
          </span>
        ))}
        {!loading && criteria.length === 0 && !(result && result.period) && (
          <span className="text-xs" style={{ color: "#9E9E9E" }}>
            {translate("DCS_DB_RECORDS_NO_CRITERIA")}
          </span>
        )}
      </div>

      {exportRecords && (
        <div className="flex-shrink-0 px-3 sm:px-4 pt-3 flex justify-end">
          <div className="w-40 sm:w-48">
            <DcsButtonPrimary type="button" onClick={run_export} disabled={exporting !== null || loading || !!error || total === 0} className="dcs-records-export-btn">
              {exporting === null ? translate("DCS_DB_RECORDS_EXPORT") : translate("DCS_DB_RECORDS_EXPORTING", { percent: exporting })}
            </DcsButtonPrimary>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 p-3 sm:p-4">
        {error ? (
          <div className="h-full flex items-center justify-center">
            <div className="border-2 p-6 text-center w-full" style={{ maxWidth: 460, borderColor: "#E0E0E0" }}>
              <p className="text-sm font-semibold mb-1" style={{ color: "#333333", ...FONT }}>
                {translate("DCS_DB_RECORDS_ERROR")}
              </p>
              <p className="text-xs mb-4" style={{ color: "#9E9E9E" }}>
                {error}
              </p>
              <div className="w-40 mx-auto">
                <DcsButtonOutline type="button" onClick={() => setAttempt((current) => current + 1)}>
                  {translate("DCS_DB_RETRY")}
                </DcsButtonOutline>
              </div>
            </div>
          </div>
        ) : !loading && total === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm font-semibold" style={{ color: "#333333", ...FONT }}>
              {translate("DCS_DB_RECORDS_EMPTY")}
            </p>
          </div>
        ) : (
          <DcsDataTable
            columns={columns}
            rows={rows}
            page={page}
            totalPages={total_pages}
            onPageChange={setPage}
            loading={loading}
            scrollResetKey={page}
            columnTints={tints}
            legendItems={[{ color: PRIMARY, label: translate("DCS_DB_RECORDS_LEGEND") }]}
            totalCount={total}
          />
        )}
      </div>
    </div>,
    portal_root(),
  );
}
