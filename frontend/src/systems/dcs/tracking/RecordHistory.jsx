import React, { useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import { field_name, format_value, format_when, change_count } from "./trackingConfig.js";
import { MediaAnswer, is_media_field } from "./MediaAnswer.jsx";

const PRIMARY = "#056daa";
const MUTED = "#9E9E9E";
const TEXT = "#333333";
const BORDER = "#E0E0E0";
const FONT = "'Montserrat', sans-serif";
const PAGE_SIZE = 10;

function fields_map(fields) {
  return new Map(flatten_fields(fields || []).map((field) => [field.id, field]));
}

export function history_entry_label(entry, translate) {
  if (!entry) return "";
  if (entry.kind === "created") return translate("DCS_TRACKING_HISTORY_CREATED");
  if (entry.kind === "corrected") return translate("DCS_TRACKING_HISTORY_CORRECTED", { when: format_when(entry.as_of) });
  if (entry.kind === "edited") return translate("DCS_TRACKING_HISTORY_EDITED");
  return translate("DCS_TRACKING_HISTORY_UPDATED");
}

function AnswerText({ field, value, color, bold }) {
  if (is_media_field(field)) return <MediaAnswer field={field} value={value} />;
  const text = format_value(value);
  return (
    <span className={`text-xs truncate block ${bold ? "font-semibold" : ""}`} style={{ color }} title={text}>
      {text}
    </span>
  );
}

function ChangeRow({ change, by_id, language }) {
  const field = by_id.get(change.field_id);
  return (
    <div className="dcs-history-change">
      <span className="text-xs font-bold truncate" style={{ color: TEXT, fontFamily: FONT }}>
        {field_name(field, language) || change.field_id}
      </span>
      <span className="min-w-0">
        <AnswerText field={field} value={change.from} color={MUTED} />
      </span>
      <span className="min-w-0">
        <AnswerText field={field} value={change.to} color={PRIMARY} bold />
      </span>
    </div>
  );
}

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
        {translate("DCS_TRACKING_HISTORY_COUNT", { count: change_count(record) })}
      </li>
      {entries.slice(0, shown).map((entry, index) => (
        <li key={`${entry.at}_${index}`} className="border p-3" style={{ borderColor: BORDER, backgroundColor: entry.kind === "created" ? "#F7F9FB" : "#FFFFFF" }}>
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase" style={{ color: entry.kind === "created" ? MUTED : PRIMARY, fontFamily: FONT, letterSpacing: 0.4 }}>
              {history_entry_label(entry, translate)}
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

function LoadMoreButton({ left, onClick }) {
  const { translate } = useDcsLanguage();
  return (
    <button type="button" onClick={onClick} className="dcs-history-more">
      {translate("DCS_TRACKING_LOAD_MORE", { count: Math.min(left, PAGE_SIZE), left })}
    </button>
  );
}

export function FieldTimeline({ record, fields, editableIds }) {
  const { translate, language } = useDcsLanguage();
  const by_id = fields_map(fields);
  const ids = (editableIds || []).filter((id) => by_id.has(id));
  const [field_id, setFieldId] = useState(ids[0] || "");
  const [shown, setShown] = useState(PAGE_SIZE);
  if (ids.length === 0) return null;
  const chosen = ids.includes(field_id) ? field_id : ids[0];
  const chosen_field = by_id.get(chosen);
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
        <div className="text-xs mt-2" style={{ color: MUTED }}>
          {is_media_field(chosen_field) ? (
            <MediaAnswer field={chosen_field} value={(record.data || {})[chosen]} />
          ) : (
            translate("DCS_TRACKING_TIMELINE_CURRENT_ONLY", { value: format_value((record.data || {})[chosen]) })
          )}
        </div>
      ) : (
        <ul className="mt-2 space-y-1.5">
          <li className="text-xs font-semibold" style={{ color: MUTED, fontFamily: FONT }}>
            {translate("DCS_TRACKING_PERIOD_COUNT", { count: periods.length })}
          </li>
          {periods.slice(0, shown).map((period, index) => (
            <li key={`${period.from}_${index}`} className="border px-3 py-2" style={{ borderColor: period.to ? BORDER : PRIMARY }}>
              {is_media_field(chosen_field) ? (
                <MediaAnswer field={chosen_field} value={period.value} />
              ) : (
                <p className="text-sm font-semibold truncate" style={{ color: TEXT, fontFamily: FONT }} title={format_value(period.value)}>
                  {format_value(period.value)}
                </p>
              )}
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
          const value = (record.data || {})[field.id];
          return (
            <div key={field.id} className="dcs-record-field" style={{ borderColor: can_change ? PRIMARY : BORDER, backgroundColor: can_change ? "rgba(5,109,170,0.06)" : "#FFFFFF" }}>
              <span className="block text-[11px] font-bold truncate" style={{ color: can_change ? PRIMARY : MUTED, fontFamily: FONT }}>
                {field_name(field, language)}
              </span>
              {is_media_field(field) ? (
                <MediaAnswer field={field} value={value} />
              ) : (
                <span className="block text-sm truncate" style={{ color: can_change ? PRIMARY : TEXT }} title={format_value(value)}>
                  {format_value(value)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RecordDates({ record }) {
  const { translate } = useDcsLanguage();
  return (
    <p className="text-xs" style={{ color: MUTED, fontFamily: FONT }}>
      {translate("DCS_TRACKING_RECORDED_AT", { when: format_when(record.submitted_at) })}
      {record.updated_at ? ` - ${translate("DCS_TRACKING_UPDATED_AT", { when: format_when(record.updated_at) })}` : ""}
    </p>
  );
}
