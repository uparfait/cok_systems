import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import RendererEngine from "../renderer/RendererEngine.jsx";
import { field_name, format_when } from "./trackingConfig.js";
import { history_entry_label } from "./RecordHistory.jsx";
import { read_only_field } from "./MediaAnswer.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsOverlayHeader from "../components/DcsOverlayHeader.jsx";

const PRIMARY = "#056daa";
const MUTED = "#9E9E9E";
const TEXT = "#333333";
const FONT = "'Montserrat', sans-serif";

function created_entry(record) {
  return { at: record.submitted_at, kind: "created", by: record.respondent || null, changes: [] };
}

export function build_snapshots(record) {
  const sorted = (record.history || []).slice().sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  const entries = sorted.length > 0 && sorted[0].kind === "created" ? sorted : [created_entry(record)].concat(sorted);
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

export function slide_position(index, total_slides, translate) {
  if (index <= 0) return translate("DCS_HISTORY_SLIDE_ORIGINAL");
  return translate("DCS_HISTORY_SLIDE_POSITION", { index, total: Math.max(0, total_slides - 1) });
}

export function slide_caption(entry, translate) {
  const kind = history_entry_label(entry, translate);
  return entry.by && entry.by.name ? `${kind} - ${translate("DCS_TRACKING_HISTORY_BY", { name: entry.by.name })}` : kind;
}

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
  }, [index, snapshots.length]);

  const wrap_field = (element, field) => {
    const inner = read_only_field(element, field, (current.data || {})[field.id], language);
    return changed.has(field.id) ? <div className="dcs-slide-changed">{inner}</div> : inner;
  };

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

      <div className="dcs-slide-form" key={`${current.entry.at}_${index}`}>
        <RendererEngine schema={schema} mode="renderer" values={current.data} onValueChange={() => {}} fieldErrors={{}} fieldValidMessages={{}} wrapField={wrap_field} />
      </div>

      <div className="dcs-history-nav">
        <DcsButtonOutline onClick={() => setIndex(Math.max(0, index - 1))} disabled={index <= 0}>
          {translate("DCS_BTN_BACK")}
        </DcsButtonOutline>
        <p className="text-xs font-bold uppercase text-center min-w-0 flex-1" style={{ color: MUTED, fontFamily: FONT, letterSpacing: 0.5 }}>
          {slide_position(index, snapshots.length, translate)}
        </p>
        <DcsButtonOutline onClick={() => setIndex(Math.min(snapshots.length - 1, index + 1))} disabled={is_latest}>
          {translate("DCS_BTN_NEXT")}
        </DcsButtonOutline>
      </div>
    </div>
  );
}

export function RecordHistorySlidesOverlay({ record, fields, onClose, onLoadLatest }) {
  const { translate } = useDcsLanguage();
  const [shown, setShown] = useState(null);
  return createPortal(
    <div className="dcs-tracking-overlay dcs-no-print" role="dialog" aria-modal="true" aria-label={translate("DCS_HISTORY_SLIDES_TITLE")}>
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="dcs-tracking-panel is-full">
        <DcsOverlayHeader
          title={shown ? format_when(shown.entry.at) : translate("DCS_HISTORY_SLIDES_TITLE")}
          subtitle={shown ? `${translate("DCS_HISTORY_SLIDES_TITLE")} - ${slide_position(shown.index, shown.total, translate)}` : translate("DCS_HISTORY_CHANGED_HINT")}
          onClose={onClose}
        />
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
