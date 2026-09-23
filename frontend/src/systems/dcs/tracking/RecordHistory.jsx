import React, { useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import { field_name, format_value, format_when } from "./trackingConfig.js";

const PRIMARY = "#056daa";
const MUTED = "#9E9E9E";
const TEXT = "#333333";
const BORDER = "#E0E0E0";
const FONT = "'Montserrat', sans-serif";
// A field may change hundreds of times: lists open a page at a time.
const PAGE_SIZE = 10;

function fields_map(fields) {
  return new Map(flatten_fields(fields || []).map((field) => [field.id, field]));
}

/** One change inside a history entry: the field, what it was, what it became. */
function ChangeRow({ change, by_id, language }) {
  return (
    <div className="dcs-history-change">
      <span className="text-xs font-bold truncate" style={{ color: TEXT, fontFamily: FONT }}>
        {field_name(by_id.get(change.field_id), language) || change.field_id}
      </span>
      <span className="text-xs truncate" style={{ color: MUTED }} title={format_value(change.from)}>
        {format_value(change.from)}
      </span>
      <span className="text-xs truncate font-semibold" style={{ color: PRIMARY }} title={format_value(change.to)}>
        {format_value(change.to)}
      </span>
    </div>
  );
}

/**
 * The whole change history of one record, newest first: when the record
 * was made, and every later update with who made it and each field's
 * previous and new value.
 */
export function RecordHistoryList({ record, fields }) {
  const { translate, language } = useDcsLanguage();
  const by_id = fields_map(fields);
  const [shown, setShown] = useState(PAGE_SIZE);
  const entries = (record.history || []).slice().reverse();
  if (entries.length === 0) {
    return <p className="text-xs py-3" style={{ color: MUTED }}>{translate("DCS_TRACKING_HISTORY_EMPTY")}</p>;
  }
  return (
    <ol className="space-y-2">
      <li className="text-xs font-semibold" style={{ color: MUTED, fontFamily: FONT }}>
        {translate("DCS_TRACKING_HISTORY_COUNT", { count: entries.length - 1 })}
      </li>
      {entries.slice(0, shown).map((entry, index) => (
        <li key={`${entry.at}_${index}`} className="border p-3" style={{ borderColor: BORDER, backgroundColor: entry.kind === "created" ? "#F7F9FB" : "#FFFFFF" }}>
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase" style={{ color: entry.kind === "created" ? MUTED : PRIMARY, fontFamily: FONT, letterSpacing: 0.4 }}>
              {translate(entry.kind === "created" ? "DCS_TRACKING_HISTORY_CREATED" : "DCS_TRACKING_HISTORY_UPDATED")}
            </span>
            <span className="text-xs" style={{ color: TEXT, fontFamily: FONT }}>{format_when(entry.at)}</span>
          </div>
          {entry.by && entry.by.name && (
            <p className="text-xs mt-1" style={{ color: MUTED }}>{translate("DCS_TRACKING_HISTORY_BY", { name: entry.by.name })}</p>
          )}
          {entry.changes && entry.changes.length > 0 && (
            <div className="mt-2">
              <div className="dcs-history-change dcs-history-head">
                <span>{translate("DCS_TRACKING_COL_FIELD")}</span>
                <span>{translate("DCS_TRACKING_COL_PREVIOUS")}</span>
                <span>{translate("DCS_TRACKING_COL_CURRENT")}</span>
              </div>
              {entry.changes.map((change, change_index) => (
                <ChangeRow key={`${change.field_id}_${change_index}`} change={change} by_id={by_id} language={language} />
              ))}
            </div>
          )}
        </li>
      ))}
      {entries.length > shown && (
        <li>
          <LoadMoreButton left={entries.length - shown} onClick={() => setShown(shown + PAGE_SIZE)} />
        </li>
      )}
    </ol>
  );
}

/** Long histories - hundreds of changes on one field - open a page at a time. */
function LoadMoreButton({ left, onClick }) {
  const { translate } = useDcsLanguage();
  return (
    <button type="button" onClick={onClick} className="dcs-history-more">
      {translate("DCS_TRACKING_LOAD_MORE", { count: Math.min(left, PAGE_SIZE), left })}
    </button>
  );
}

/**
 * One updatable field at a time: every value it held on this record and
 * from when to when, the open period reading "until now".
 */
export function FieldTimeline({ record, fields, editableIds }) {
  const { translate, language } = useDcsLanguage();
  const by_id = fields_map(fields);
  const ids = (editableIds || []).filter((id) => by_id.has(id));
  const [field_id, setFieldId] = useState(ids[0] || "");
  const [shown, setShown] = useState(PAGE_SIZE);
  if (ids.length === 0) return null;
  const chosen = ids.includes(field_id) ? field_id : ids[0];
  const periods = ((record.tracking_periods || {})[chosen] || []).slice().reverse();

  return (
    <div>
      <label className="cok-auth-label">{translate("DCS_TRACKING_TIMELINE_FIELD")}</label>
      <select
        className="cok-auth-input w-full py-2"
        value={chosen}
        onChange={(event) => {
          setFieldId(event.target.value);
          setShown(PAGE_SIZE);
        }}
      >
        {ids.map((id) => (
          <option key={id} value={id}>{field_name(by_id.get(id), language)}</option>
        ))}
      </select>
      {periods.length === 0 ? (
        <p className="text-xs mt-2" style={{ color: MUTED }}>
          {translate("DCS_TRACKING_TIMELINE_CURRENT_ONLY", { value: format_value((record.data || {})[chosen]) })}
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          <li className="text-xs font-semibold" style={{ color: MUTED, fontFamily: FONT }}>
            {translate("DCS_TRACKING_PERIOD_COUNT", { count: periods.length })}
          </li>
          {periods.slice(0, shown).map((period, index) => (
            <li key={`${period.from}_${index}`} className="border px-3 py-2" style={{ borderColor: period.to ? BORDER : PRIMARY }}>
              <p className="text-sm font-semibold truncate" style={{ color: TEXT, fontFamily: FONT }} title={format_value(period.value)}>
                {format_value(period.value)}
              </p>
              <p className="text-xs" style={{ color: MUTED, fontFamily: FONT }}>
                {translate("DCS_TRACKING_PERIOD_FROM", { when: format_when(period.from) })}
                {" - "}
                {period.to ? translate("DCS_TRACKING_PERIOD_TO", { when: format_when(period.to) }) : translate("DCS_TRACKING_PERIOD_NOW")}
              </p>
            </li>
          ))}
          {periods.length > shown && (
            <li>
              <LoadMoreButton left={periods.length - shown} onClick={() => setShown(shown + PAGE_SIZE)} />
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

const NOT_SHOWN_TYPES = ["paragraph", "header", "file", "image_block", "horizontal_line", "section", "group"];

/**
 * Every answer the record holds, in the form's own order, the fields that
 * may be updated drawn in blue and the rest in grey - so what can change
 * and what stays is read at a glance beside the history.
 */
export function RecordFieldsList({ record, fields, editableIds }) {
  const { translate, language } = useDcsLanguage();
  const editable = new Set(editableIds || []);
  const shown = flatten_fields(fields || []).filter((field) => !NOT_SHOWN_TYPES.includes(field.type));
  if (shown.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-bold uppercase" style={{ color: MUTED, fontFamily: FONT, letterSpacing: 0.5 }}>{translate("DCS_TRACKING_ALL_FIELDS")}</p>
      <p className="text-xs mb-2" style={{ color: MUTED }}>{translate("DCS_TRACKING_ALL_FIELDS_HINT")}</p>
      <div className="dcs-record-fields">
        {shown.map((field) => {
          const can_change = editable.has(field.id);
          return (
            <div key={field.id} className="dcs-record-field" style={{ borderColor: can_change ? PRIMARY : BORDER, backgroundColor: can_change ? "rgba(5,109,170,0.06)" : "#FFFFFF" }}>
              <span className="block text-[11px] font-bold truncate" style={{ color: can_change ? PRIMARY : MUTED, fontFamily: FONT }}>
                {field_name(field, language)}
              </span>
              <span className="block text-sm truncate" style={{ color: can_change ? PRIMARY : TEXT }} title={format_value((record.data || {})[field.id])}>
                {format_value((record.data || {})[field.id])}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A record's heading line: when it was recorded and, if ever, last changed. */
export function RecordDates({ record }) {
  const { translate } = useDcsLanguage();
  return (
    <p className="text-xs" style={{ color: MUTED, fontFamily: FONT }}>
      {translate("DCS_TRACKING_RECORDED_AT", { when: format_when(record.submitted_at) })}
      {record.updated_at ? ` - ${translate("DCS_TRACKING_UPDATED_AT", { when: format_when(record.updated_at) })}` : ""}
    </p>
  );
}
