import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";

const PRIMARY = "#056daa";
const MUTED = "#9E9E9E";
const HEADING_FONT = { fontFamily: "'Montserrat', sans-serif" };
const DEFAULT_TOP_PX = 100;
const PANEL_WIDTH_PX = 320;
const RIGHT_MARGIN_PX = 24;

/**
 * Find one field in a long form. Typing here hides every field that does
 * not match, so the one being looked for can be edited on its own instead
 * of hunted for down a page of questions - it filters what is shown and
 * never touches the form itself, so nothing is reordered or lost by
 * searching.
 *
 * Opens pinned near the top right (100px down, clear of the page header)
 * and can be dragged anywhere, because the field it finds may well end up
 * underneath where it started.
 */
export default function FieldSearchPanel({ query, matchCount, onQueryChange, onClose }) {
  const { translate } = useDcsLanguage();
  const input_ref = useRef(null);
  const drag_state_ref = useRef(null);
  const [position, setPosition] = useState(() => ({
    top: DEFAULT_TOP_PX,
    left: Math.max(RIGHT_MARGIN_PX, window.innerWidth - PANEL_WIDTH_PX - RIGHT_MARGIN_PX),
  }));

  useEffect(() => {
    if (input_ref.current) input_ref.current.focus();
  }, []);

  useEffect(() => {
    const handle_move = (event) => {
      const drag_state = drag_state_ref.current;
      if (!drag_state) return;
      setPosition({
        top: Math.max(0, drag_state.start_top + (event.clientY - drag_state.start_mouse_y)),
        left: Math.max(0, drag_state.start_left + (event.clientX - drag_state.start_mouse_x)),
      });
    };
    const handle_up = () => {
      drag_state_ref.current = null;
    };
    document.addEventListener("mousemove", handle_move);
    document.addEventListener("mouseup", handle_up);
    return () => {
      document.removeEventListener("mousemove", handle_move);
      document.removeEventListener("mouseup", handle_up);
    };
  }, []);

  const start_drag = (event) => {
    drag_state_ref.current = {
      start_top: position.top,
      start_left: position.left,
      start_mouse_x: event.clientX,
      start_mouse_y: event.clientY,
    };
  };

  const has_query = !!(query || "").trim();

  return createPortal(
    <div className="dcs-field-search" style={{ top: position.top, left: position.left, width: PANEL_WIDTH_PX }}>
      <div className="dcs-field-search-grip flex items-center justify-between gap-2 px-3 py-2" onMouseDown={start_drag}>
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#FFFFFF", ...HEADING_FONT }}>
          {translate("DCS_SEARCH_FIELD_TITLE")}
        </p>
        <span className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.85)", ...HEADING_FONT }}>
          {translate("DCS_SEARCH_FIELD_DRAG_HINT")}
        </span>
      </div>

      <div className="p-3">
        <input
          ref={input_ref}
          type="text"
          className="cok-auth-input w-full py-2"
          style={{ paddingLeft: 10 }}
          placeholder={translate("DCS_SEARCH_FIELD_PLACEHOLDER")}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onClose();
          }}
        />

        <p className="text-[11px] mt-2" style={{ color: has_query ? PRIMARY : MUTED, ...HEADING_FONT }}>
          {has_query
            ? translate("DCS_SEARCH_FIELD_MATCHES", { count: matchCount })
            : translate("DCS_SEARCH_FIELD_HINT")}
        </p>

        <div className="grid grid-cols-2 gap-2 mt-3">
          <DcsButtonOutline type="button" disabled={!has_query} onClick={() => onQueryChange("")}>
            {translate("DCS_BTN_CLEAR")}
          </DcsButtonOutline>
          <DcsButtonOutline type="button" onClick={onClose}>
            {translate("DCS_BTN_CLOSE")}
          </DcsButtonOutline>
        </div>
      </div>
    </div>,
    document.body,
  );
}
