import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import { get_field_text } from "../fields/fieldText.js";
import { NON_DATA_TYPES, column_label, render_answer_cell } from "../fields/dataColumns.jsx";
import { format_respondent } from "../offline/respondentStore.js";
import { approval_status_label_key } from "./DcsApprovalStatusChip.jsx";
import { ApprovalDetailsBody } from "./DcsApprovalDetailsDialog.jsx";
import { RecordHistoryList, FieldTimeline, RecordFieldsList } from "../tracking/RecordHistory.jsx";
import { is_tracking_enabled } from "../tracking/trackingConfig.js";
import DcsButtonOutline from "./DcsButtonOutline.jsx";
import DcsButtonPrimary from "./DcsButtonPrimary.jsx";
import DcsButtonOutlineReverse from "./DcsButtonOutlineReverse.jsx";

const PRIMARY = "#056daa";
const MUTED = "#9E9E9E";
const TEXT = "#333333";
const BORDER = "#E0E0E0";
const FONT = "'Montserrat', sans-serif";

/**
 * One whole record, opened from a table row. The table can only show an
 * answer as much of a cell as three lines allow; this shows every answer
 * at full size in the form's own order, with sections and groups kept as
 * the headings they were authored as, so a long paragraph, a photo and a
 * map all get the room they need. Its tabs: the answers, the approval
 * trail (loaded when opened), and - on a tracked form - the change history
 * with each updatable field's value timeline.
 *
 * Full screen on a phone; an 80 by 80 percent card from 750px up, the
 * same frame as every other overlay of the module.
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
    out.push({ kind: "answer", key: field.id, label: column_label(field, language, translate), field, value: values ? values[field.id] : undefined, depth });
  });
  return out;
}

function is_empty(value) {
  if (value === null || value === undefined || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function MetaItem({ label, children }) {
  return (
    <div className="border px-3 py-2 min-w-0" style={{ borderColor: BORDER, backgroundColor: "#F7F9FB" }}>
      <p className="text-[10px] font-bold uppercase truncate" style={{ color: MUTED, fontFamily: FONT, letterSpacing: 0.4 }}>{label}</p>
      <p className="text-sm truncate" style={{ color: TEXT, fontFamily: FONT }} title={typeof children === "string" ? children : undefined}>
        {children}
      </p>
    </div>
  );
}

function AnswersTab({ entries, translate, editableIds }) {
  if (entries.filter((entry) => entry.kind === "answer").length === 0) {
    return <p className="text-sm py-4" style={{ color: MUTED, fontFamily: FONT }}>{translate("DCS_RECORD_VIEW_EMPTY")}</p>;
  }
  return (
    <dl>
      {entries.map((entry) =>
        entry.kind === "heading" ? (
          <p key={`h-${entry.key}`} className="text-xs font-bold uppercase pt-4 pb-1" style={{ color: PRIMARY, fontFamily: FONT, letterSpacing: 0.5, paddingLeft: entry.depth * 10 }}>
            {entry.text}
          </p>
        ) : (
          <div key={entry.key} className="dcs-record-answer" style={{ paddingLeft: entry.depth * 10, borderLeftColor: editableIds.has(entry.key) ? PRIMARY : "transparent" }}>
            <dt className="text-xs font-semibold" style={{ color: editableIds.has(entry.key) ? PRIMARY : "#6B7280", fontFamily: FONT, overflowWrap: "anywhere" }}>
              {entry.label}
            </dt>
            <dd className="text-sm min-w-0" style={{ color: is_empty(entry.value) ? "#B0B7BE" : TEXT, fontFamily: FONT, whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.6 }}>
              {is_empty(entry.value) ? translate("DCS_RECORD_VIEW_UNANSWERED") : render_answer_cell(entry.field, entry.value)}
            </dd>
          </div>
        ),
      )}
    </dl>
  );
}

export default function DcsRecordViewOverlay({ record, fields, tracking, onClose, onEdit }) {
  const { language, translate } = useDcsLanguage();
  const tracked = is_tracking_enabled(tracking);
  const [tab, setTab] = useState("answers");

  const entries = walk(fields || [], language, translate, record.data || {}, 0, []);
  const editable_ids = new Set(tracked ? tracking.editable_field_ids || [] : []);
  const approval_key = approval_status_label_key(record.approval_status);
  const change_count = Math.max(0, (record.history || []).length - 1);
  const answered = flatten_fields(fields || []).filter((field) => !NON_DATA_TYPES.includes(field.type) && !is_empty((record.data || {})[field.id])).length;

  const tabs = [
    { key: "answers", label: `${translate("DCS_RECORD_VIEW_SECTION_ANSWERS")} (${answered})` },
    { key: "approval", label: translate("DCS_TABLE_APPROVAL") },
  ];
  if (tracked) tabs.push({ key: "history", label: `${translate("DCS_TRACKING_TABLE_HISTORY")} (${change_count})` });

  return createPortal(
    <div className="dcs-tracking-overlay dcs-no-print" role="dialog" aria-modal="true" aria-label={translate("DCS_RECORD_VIEW_TITLE")}>
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="dcs-tracking-panel">
        <div className="cok-bg-primary px-4 py-3 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <p className="text-white font-semibold uppercase tracking-wide text-sm truncate" style={{ fontFamily: FONT }}>
              {translate("DCS_RECORD_VIEW_TITLE")}
            </p>
            <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.85)", fontFamily: FONT }}>
              {record.submitted_at ? new Date(record.submitted_at).toLocaleString() : ""}
            </p>
          </div>
          <DcsButtonOutlineReverse onClick={onClose}>{translate("DCS_BTN_CLOSE")}</DcsButtonOutlineReverse>
        </div>

        <div className="dcs-record-meta flex-shrink-0">
          <MetaItem label={translate("DCS_TABLE_APPROVAL")}>
            {approval_key ? translate(approval_key) : "-"}
            {record.approval_progress && record.approval_progress.total > 0 ? ` (${record.approval_progress.approved}/${record.approval_progress.total})` : ""}
          </MetaItem>
          <MetaItem label={translate("DCS_TABLE_SUBMITTED_BY")}>{format_respondent(record.respondent) || "-"}</MetaItem>
          <MetaItem label={translate("DCS_TABLE_VERSION")}>{String(record.version || "-")}</MetaItem>
          <MetaItem label={translate("DCS_TRACKING_TABLE_UPDATED_AT")}>{record.updated_at ? new Date(record.updated_at).toLocaleString() : "-"}</MetaItem>
        </div>

        <div className="dcs-record-tabs flex-shrink-0">
          {tabs.map((entry) => (
            <button key={entry.key} type="button" onClick={() => setTab(entry.key)} className={`dcs-record-tab ${tab === entry.key ? "is-active" : ""}`}>
              {entry.label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 min-[560px]:px-6 py-4">
          {tab === "answers" && <AnswersTab entries={entries} translate={translate} editableIds={editable_ids} />}
          {tab === "approval" && <ApprovalDetailsBody submission_id={record._id} />}
          {tab === "history" && tracked && (
            <div className="space-y-4">
              <RecordFieldsList record={record} fields={fields} editableIds={tracking.editable_field_ids} />
              <RecordHistoryList record={record} fields={fields} />
              <FieldTimeline record={record} fields={fields} editableIds={tracking.editable_field_ids} />
            </div>
          )}
        </div>

        <div className="dcs-tracking-footer">
          <span className="flex-1" />
          <DcsButtonOutline onClick={onClose}>{translate("DCS_BTN_CLOSE")}</DcsButtonOutline>
          {onEdit && <DcsButtonPrimary onClick={onEdit}>{translate("DCS_TABLE_EDIT_RECORD")}</DcsButtonPrimary>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
