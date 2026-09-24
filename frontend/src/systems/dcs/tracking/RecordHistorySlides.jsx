import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import RendererEngine from "../renderer/RendererEngine.jsx";
import { field_name, format_when } from "./trackingConfig.js";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsCloseIconButton from "../components/DcsCloseIconButton.jsx";

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

/** The moment's own line: when it was written, by whom, as a fresh record or a change. */
export function slide_caption(entry, translate) {
  const kind = translate(KIND_KEYS[entry.kind] || KIND_KEYS.updated);
  return entry.by && entry.by.name ? `${kind} - ${translate("DCS_TRACKING_HISTORY_BY", { name: entry.by.name })}` : kind;
}

/**
 * A record's history as slides of the form itself, exactly as the form
 * looks, read-only: one slide per moment the record was written. The
 * moment's date leads at the top, the fields that changed at that moment
 * are listed and drawn in blue in the form, and Back, "3 of 6" and Next
 * sit at the bottom. Opens on the latest slide; Back walks to the first
 * record, Next forward again. On the latest slide only, onLoadLatest
 * (when given) offers to load the record into the form. onSlideChange
 * reports the moment on show, for a host that titles itself with it.
 */
export default function RecordHistorySlides({ record, fields, onLoadLatest, onSlideChange, hideDate }) {
  const { translate, language } = useDcsLanguage();
  const snapshots = useMemo(() => build_snapshots(record), [record]);
  const [index, setIndex] = useState(snapshots.length - 1);
  const current = snapshots[Math.min(index, snapshots.length - 1)];
  const by_id = useMemo(() => new Map(flatten_fields(fields || []).map((field) => [field.id, field])), [fields]);
  const changed = new Set(index > 0 ? (current.entry.changes || []).map((change) => change.field_id) : []);
  const schema = useMemo(() => ({ fields: fields || [] }), [fields]);
  const is_latest = index >= snapshots.length - 1;

  useEffect(() => {
    if (onSlideChange) onSlideChange(current.entry, index, snapshots.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, snapshots.length]);

  const wrap_field = (element, field) => (changed.has(field.id) ? <div className="dcs-slide-changed">{element}</div> : element);

  return (
    <div className="dcs-history-slides">
      <div className="dcs-history-head">
        {!hideDate && <p className="text-base font-bold" style={{ color: TEXT, fontFamily: FONT }}>{format_when(current.entry.at)}</p>}
        <p className="text-xs" style={{ color: PRIMARY, fontFamily: FONT }}>{slide_caption(current.entry, translate)}</p>
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
      {index === 0 && snapshots.length > 1 && (
        <p className="text-xs" style={{ color: MUTED, fontFamily: FONT }}>{translate("DCS_HISTORY_FIRST_HINT")}</p>
      )}

      {is_latest && onLoadLatest && (
        <DcsButtonPrimary className="w-full" onClick={onLoadLatest}>
          {translate("DCS_TRACKING_LOAD")}
        </DcsButtonPrimary>
      )}

      <div className="dcs-slide-form" inert={true} key={`${current.entry.at}_${index}`}>
        <RendererEngine schema={schema} mode="renderer" values={current.data} onValueChange={() => {}} fieldErrors={{}} fieldValidMessages={{}} wrapField={wrap_field} />
      </div>

      <div className="dcs-history-nav">
        <DcsButtonOutline onClick={() => setIndex(Math.max(0, index - 1))} disabled={index <= 0}>
          {translate("DCS_BTN_BACK")}
        </DcsButtonOutline>
        <p className="text-xs font-bold uppercase text-center min-w-0 flex-1" style={{ color: MUTED, fontFamily: FONT, letterSpacing: 0.5 }}>
          {translate("DCS_HISTORY_SLIDE_POSITION", { index: index + 1, total: snapshots.length })}
        </p>
        <DcsButtonOutline onClick={() => setIndex(Math.min(snapshots.length - 1, index + 1))} disabled={is_latest}>
          {translate("DCS_BTN_NEXT")}
        </DcsButtonOutline>
      </div>
    </div>
  );
}

/**
 * The slides on their own, over the whole screen - the public form's
 * history is read this way, and the tables' history button opens it too.
 * The title bar carries the date and time of the moment on show.
 */
export function RecordHistorySlidesOverlay({ record, fields, onClose, onLoadLatest }) {
  const { translate } = useDcsLanguage();
  const [shown, setShown] = useState(null);
  return createPortal(
    <div className="dcs-tracking-overlay dcs-no-print" role="dialog" aria-modal="true" aria-label={translate("DCS_HISTORY_SLIDES_TITLE")}>
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="dcs-tracking-panel is-full">
        <div className="cok-bg-primary px-4 py-3 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate" style={{ fontFamily: FONT }}>
              {shown ? format_when(shown.entry.at) : translate("DCS_HISTORY_SLIDES_TITLE")}
            </p>
            <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.85)", fontFamily: FONT }}>
              {shown ? `${translate("DCS_HISTORY_SLIDES_TITLE")} - ${translate("DCS_HISTORY_SLIDE_POSITION", { index: shown.index + 1, total: shown.total })}` : translate("DCS_HISTORY_CHANGED_HINT")}
            </p>
          </div>
          <DcsCloseIconButton onClick={onClose} />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 min-[560px]:px-6 py-4">
          <div className="w-full mx-auto" style={{ maxWidth: 760 }}>
            <RecordHistorySlides
              record={record}
              fields={fields}
              onLoadLatest={onLoadLatest}
              hideDate
              onSlideChange={(entry, index, total) => setShown({ entry, index, total })}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
