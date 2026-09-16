import React from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";

// Every edge and corner resizes: eight handles plus wide invisible edge strips.
const HANDLES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
const EDGES = ["n", "s", "e", "w"];

const CLOSE_SVG = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

/**
 * One widget box on the studio canvas: dragged by its body, resized from
 * any of its four edges or four corners, lifted above the others when
 * pressed, removed from its hover button. The pointer maths live in the
 * studio (one gesture at a time); this only reports where a gesture starts.
 */
export default function StudioItem({ item, active, moving, onStart, onRemove, children }) {
  const { translate } = useDcsLanguage();
  const start = (kind) => (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onStart(item.id, kind, event);
  };

  return (
    <div
      className={`dcs-studio-item ${active ? "is-active" : ""} ${moving ? "is-moving" : ""}`}
      style={{ left: item.x, top: item.y, width: item.w, height: item.h, zIndex: item.z }}
      onPointerDown={start("move")}
    >
      <div className="dcs-studio-body">{children}</div>
      {EDGES.map((edge) => (
        <div key={edge} className={`dcs-studio-edge is-${edge}`} onPointerDown={start(edge)} />
      ))}
      {HANDLES.map((handle) => (
        <div key={handle} className={`dcs-studio-handle is-${handle}`} onPointerDown={start(handle)} />
      ))}
      <button
        type="button"
        className="dcs-studio-remove"
        title={translate("DCS_DB_SHOT_REMOVE")}
        aria-label={translate("DCS_DB_SHOT_REMOVE")}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onRemove(item.id);
        }}
      >
        {CLOSE_SVG}
      </button>
    </div>
  );
}
