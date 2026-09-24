import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import RendererEngine from "../renderer/RendererEngine.jsx";
import { field_name, format_when } from "./trackingConfig.js";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsButtonOutlineReverse from "../components/DcsButtonOutlineReverse.jsx";

const PRIMARY = "#056daa";
const MUTED = "#9E9E9E";
const TEXT = "#333333";
const FONT = "'Montserrat', sans-serif";

const KIND_KEYS = {
  created: "DCS_TRACKING_HISTORY_CREATED",
  updated: "DCS_TRACKING_HISTORY_UPDATED",
  edited: "DCS_TRACKING_HISTORY_EDITED",
};

/**
 * The record at every moment it was written, oldest first. The latest
 * moment holds the answers as they are now; each earlier one is rebuilt
 * by putting back the "from" value of every change made after it, so a
 * slide shows exactly what the form held at that time - for every field,
 * tracked or not.
 */
export function build_snapshots(record) {
  const entries = (record.history || []).slice().sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  if (entries.length === 0) {
    return [{ entry: { at: record.submitted_at, kind: "created", by: record.respondent || null, changes: [] }, data: record.data || {} }];
  }
  const snapshots = new Array(entries.length);
  let data = Object.assign({}, record.data || {});
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    snapshots[index] = { entry: entries[index], data };
    if (index > 0) {
      const previous = Object.assign({}, data);
      (entries[index].changes || []).forEach((change) => {
        previous[change.field_id] = change.from === undefined ? null : change.from;
      });
      data = previous;
    }
  }
  return snapshots;
}

/**
 * A record's history as slides of the form itself: each moment the record
 * was written shows the whole form with the answers it held then, titled
 * by its date, with the fields that changed at that moment drawn in blue.
 * Opens on the latest moment; Older and Newer walk back to the first
 * record and forward again. Read-only throughout.
 */
export default function RecordHistorySlides({ record, fields }) {
  const { translate, language } = useDcsLanguage();
  const snapshots = useMemo(() => build_snapshots(record), [record]);
  const [index, setIndex] = useState(snapshots.length - 1);
  const current = snapshots[Math.min(index, snapshots.length - 1)];
  const by_id = useMemo(() => new Map(flatten_fields(fields || []).map((field) => [field.id, field])), [fields]);
  const changed = new Set((current.entry.changes || []).map((change) => change.field_id));
  const schema = useMemo(() => ({ fields: fields || [] }), [fields]);

  const wrap_field = (element, field) => (changed.has(field.id) ? <div className="dcs-slide-changed">{element}</div> : element);
  const is_latest = index >= snapshots.length - 1;

  return (
    <div className="dcs-history-slides">
      <div className="dcs-history-nav">
        <DcsButtonOutline onClick={() => setIndex(Math.max(0, index - 1))} disabled={index <= 0}>
          {translate("DCS_BTN_OLDER")}
        </DcsButtonOutline>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[11px] font-bold uppercase" style={{ color: MUTED, fontFamily: FONT, letterSpacing: 0.5 }}>
            {translate("DCS_HISTORY_SLIDE_POSITION", { index: index + 1, total: snapshots.length })}
            {is_latest ? ` - ${translate("DCS_HISTORY_SLIDE_LATEST")}` : ""}
          </p>
          <p className="text-sm font-bold truncate" style={{ color: TEXT, fontFamily: FONT }}>{format_when(current.entry.at)}</p>
          <p className="text-xs truncate" style={{ color: PRIMARY, fontFamily: FONT }}>
            {translate(KIND_KEYS[current.entry.kind] || KIND_KEYS.updated)}
            {current.entry.by && current.entry.by.name ? ` - ${translate("DCS_TRACKING_HISTORY_BY", { name: current.entry.by.name })}` : ""}
          </p>
        </div>
        <DcsButtonOutline onClick={() => setIndex(Math.min(snapshots.length - 1, index + 1))} disabled={is_latest}>
          {translate("DCS_BTN_NEWER")}
        </DcsButtonOutline>
      </div>

      {changed.size > 0 && (
        <div className="dcs-history-changed">
          <span className="text-[11px] font-bold uppercase" style={{ color: PRIMARY, fontFamily: FONT, letterSpacing: 0.4 }}>
            {translate("DCS_HISTORY_CHANGED_COUNT", { count: changed.size })}
          </span>
          {Array.from(changed).map((field_id) => (
            <span key={field_id} className="dcs-history-chip">{field_name(by_id.get(field_id), language) || field_id}</span>
          ))}
        </div>
      )}
      {changed.size === 0 && index === 0 && (
        <p className="text-xs" style={{ color: MUTED, fontFamily: FONT }}>{translate("DCS_HISTORY_FIRST_HINT")}</p>
      )}

      <div className="dcs-slide-form" inert={true} key={`${current.entry.at}_${index}`}>
        <RendererEngine schema={schema} mode="renderer" values={current.data} onValueChange={() => {}} fieldErrors={{}} fieldValidMessages={{}} wrapField={wrap_field} />
      </div>
    </div>
  );
}

/** The slides on their own, over the page: full screen on a phone, an 80 by 80 percent card from 750px up. */
export function RecordHistorySlidesOverlay({ record, fields, onClose }) {
  const { translate } = useDcsLanguage();
  return createPortal(
    <div className="dcs-tracking-overlay dcs-no-print" role="dialog" aria-modal="true" aria-label={translate("DCS_HISTORY_SLIDES_TITLE")}>
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="dcs-tracking-panel">
        <div className="cok-bg-primary px-4 py-3 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <p className="text-white font-semibold uppercase tracking-wide text-sm truncate" style={{ fontFamily: FONT }}>
              {translate("DCS_HISTORY_SLIDES_TITLE")}
            </p>
            <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.85)", fontFamily: FONT }}>
              {translate("DCS_HISTORY_CHANGED_HINT")}
            </p>
          </div>
          <DcsButtonOutlineReverse onClick={onClose}>{translate("DCS_BTN_CLOSE")}</DcsButtonOutlineReverse>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 min-[560px]:px-6 py-4">
          <RecordHistorySlides record={record} fields={fields} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
