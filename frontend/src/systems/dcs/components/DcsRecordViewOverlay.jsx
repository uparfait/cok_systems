import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import { get_field_text } from "../fields/fieldText.js";
import { NON_DATA_TYPES, column_label, render_answer_cell } from "../fields/dataColumns.jsx";
import { format_respondent } from "../offline/respondentStore.js";
import { approval_status_label_key } from "./DcsApprovalStatusChip.jsx";
import DcsButtonOutline from "./DcsButtonOutline.jsx";
import DcsButtonPrimary from "./DcsButtonPrimary.jsx";

const PRIMARY = "#056daa";
const FONT = "'Montserrat', sans-serif";

/**
 * One whole record, read at a glance. The table can only ever show an
 * answer as much of a cell as the column is wide; this shows every answer
 * at full size in the form's own order, with sections and groups kept as
 * the headings they were authored as, so a long paragraph, a photo and a
 * map all get the room they need.
 *
 * Laid out as a definition list rather than a two-column table: on a
 * phone the label sits above its answer and the whole thing reads
 * straight down, and from a tablet up the pair sits side by side.
 */

/** The record's own fields, keeping sections and groups as headings. */
function walk(fields, language, translate, values, depth, out) {
  (fields || []).forEach((field) => {
    if (field.type === "section" || field.type === "group") {
      const heading = get_field_text(field.label, language);
      if (heading) out.push({ kind: "heading", key: field.id, text: heading, depth });
      walk(field.children || [], language, translate, values, depth + 1, out);
      return;
    }
    if (NON_DATA_TYPES.includes(field.type)) return;
    out.push({
      kind: "answer",
      key: field.id,
      label: column_label(field, language, translate),
      field,
      value: values ? values[field.id] : undefined,
      depth,
    });
  });
  return out;
}

function is_empty(value) {
  if (value === null || value === undefined || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function MetaRow({ label, children }) {
  return (
    <div className="flex flex-col min-[560px]:flex-row min-[560px]:items-baseline gap-0.5 min-[560px]:gap-3 py-1.5">
      <span className="text-[11px] font-bold uppercase flex-shrink-0" style={{ color: "#9E9E9E", fontFamily: FONT, letterSpacing: "0.4px", minWidth: 132 }}>
        {label}
      </span>
      <span className="text-sm min-w-0 break-words" style={{ color: "#333333", fontFamily: FONT }}>
        {children}
      </span>
    </div>
  );
}

export default function DcsRecordViewOverlay({ record, fields, onClose, onEdit }) {
  const { language, translate } = useDcsLanguage();

  const entries = walk(fields || [], language, translate, record.data || {}, 0, []);
  const answered = entries.filter((entry) => entry.kind === "answer");
  const approval_key = approval_status_label_key(record.approval_status);
  const total_answers = flatten_fields(fields || []).filter((field) => !NON_DATA_TYPES.includes(field.type)).length;

  return (
    <div className="fixed inset-0 z-[10030] flex items-stretch min-[760px]:items-center justify-center min-[760px]:p-4 dcs-no-print">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />

      <div
        className="relative bg-white border-0 min-[760px]:border-2 w-full flex flex-col"
        style={{ maxWidth: 780, maxHeight: "100vh", borderColor: PRIMARY }}
        role="dialog"
        aria-modal="true"
        aria-label={translate("DCS_RECORD_VIEW_TITLE")}
      >
        <div className="flex items-start justify-between gap-3 px-4 min-[560px]:px-6 py-3 flex-shrink-0" style={{ borderBottom: `1px solid #E0E0E0` }}>
          <div className="min-w-0">
            <p className="text-base font-bold uppercase" style={{ color: PRIMARY, fontFamily: FONT, letterSpacing: 0.4 }}>
              {translate("DCS_RECORD_VIEW_TITLE")}
            </p>
            <p className="text-xs" style={{ color: "#9E9E9E", fontFamily: FONT }}>
              {record.submitted_at ? new Date(record.submitted_at).toLocaleString() : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label={translate("DCS_BTN_CLOSE")} title={translate("DCS_BTN_CLOSE")} className="dcs-sidebar-close rounded-full cursor-pointer flex items-center justify-center flex-shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <line x1="5" y1="5" x2="19" y2="19" />
              <line x1="19" y1="5" x2="5" y2="19" />
            </svg>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 min-[560px]:px-6 py-4">
          <p className="text-[11px] font-bold uppercase mb-2" style={{ color: "#9E9E9E", fontFamily: FONT, letterSpacing: "0.6px" }}>
            {translate("DCS_RECORD_VIEW_SECTION_ANSWERS")}
          </p>

          {total_answers === 0 || answered.length === 0 ? (
            <p className="text-sm py-4" style={{ color: "#9E9E9E", fontFamily: FONT }}>
              {translate("DCS_RECORD_VIEW_EMPTY")}
            </p>
          ) : (
            <dl className="divide-y" style={{ borderColor: "#EEF2F5" }}>
              {entries.map((entry) =>
                entry.kind === "heading" ? (
                  <p
                    key={`h-${entry.key}`}
                    className="text-xs font-bold uppercase pt-4 pb-1"
                    style={{ color: PRIMARY, fontFamily: FONT, letterSpacing: "0.5px", paddingLeft: entry.depth * 10 }}
                  >
                    {entry.text}
                  </p>
                ) : (
                  <div
                    key={entry.key}
                    className="flex flex-col min-[560px]:flex-row min-[560px]:items-start gap-1 min-[560px]:gap-4 py-2.5"
                    style={{ paddingLeft: entry.depth * 10 }}
                  >
                    <dt className="text-xs font-semibold flex-shrink-0 min-w-0 break-words" style={{ color: "#6B7280", fontFamily: FONT, width: "100%", maxWidth: 240 }}>
                      {entry.label}
                    </dt>
                    <dd className="text-sm min-w-0 flex-1 break-words" style={{ color: is_empty(entry.value) ? "#B0B7BE" : "#333333", fontFamily: FONT }}>
                      {is_empty(entry.value) ? translate("DCS_RECORD_VIEW_UNANSWERED") : render_answer_cell(entry.field, entry.value)}
                    </dd>
                  </div>
                ),
              )}
            </dl>
          )}

          <p className="text-[11px] font-bold uppercase mt-6 mb-1" style={{ color: "#9E9E9E", fontFamily: FONT, letterSpacing: "0.6px" }}>
            {translate("DCS_RECORD_VIEW_SECTION_ABOUT")}
          </p>
          <div className="divide-y" style={{ borderColor: "#EEF2F5" }}>
            <MetaRow label={translate("DCS_TABLE_SUBMITTED_BY")}>{format_respondent(record.respondent) || "-"}</MetaRow>
            <MetaRow label={translate("DCS_TABLE_SUBMITTED_AT")}>{record.submitted_at ? new Date(record.submitted_at).toLocaleString() : "-"}</MetaRow>
            <MetaRow label={translate("DCS_TABLE_VERSION")}>{record.version}</MetaRow>
            {record.updated_at && <MetaRow label={translate("DCS_TRACKING_TABLE_UPDATED_AT")}>{new Date(record.updated_at).toLocaleString()}</MetaRow>}
            <MetaRow label={translate("DCS_TABLE_APPROVAL")}>
              {approval_key ? translate(approval_key) : "-"}
              {record.approval_progress && record.approval_progress.total > 0 ? ` (${record.approval_progress.approved}-out-${record.approval_progress.total})` : ""}
            </MetaRow>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 min-[560px]:px-6 py-3 flex-shrink-0" style={{ borderTop: "1px solid #E0E0E0" }}>
          <div className="w-32">
            <DcsButtonOutline onClick={onClose}>{translate("DCS_BTN_CLOSE")}</DcsButtonOutline>
          </div>
          {onEdit && (
            <div className="w-40">
              <DcsButtonPrimary onClick={onEdit}>{translate("DCS_TABLE_EDIT_RECORD")}</DcsButtonPrimary>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
