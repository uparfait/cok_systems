import React, { useLayoutEffect, useRef, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { SearchIcon, LockIcon, HistoryIcon } from "./TrackingIcons.jsx";

const PRIMARY = "#056daa";
const FONT = "'Montserrat', sans-serif";

/**
 * The search icon that sits INSIDE an input, at its right end. The input
 * itself belongs to whoever rendered the field, so the icon finds it in
 * the wrapper and centers on its own height - a label above or a message
 * below never pushes the icon off the box.
 */
export function InputSearchIcon({ holderRef, onClick, disabled, busy, fieldName }) {
  const { translate } = useDcsLanguage();
  const [top, setTop] = useState(null);
  const title = translate("DCS_TRACKING_SEARCH", { field: fieldName || translate("DCS_TRACKING_KEY_LABEL") });

  useLayoutEffect(() => {
    const measure = () => {
      const holder = holderRef.current;
      const input = holder ? holder.querySelector("input, select, textarea") : null;
      if (!holder || !input) return;
      const holder_box = holder.getBoundingClientRect();
      const input_box = input.getBoundingClientRect();
      setTop(input_box.top - holder_box.top + input_box.height / 2);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  });

  return (
    <button
      type="button"
      className="dcs-key-search-icon dcs-no-print"
      style={{ top: top === null ? "50%" : top }}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
    >
      {busy ? <span className="dcs-inline-spinner" /> : <SearchIcon size={16} />}
    </button>
  );
}

/**
 * The key field of a tracked form with its search icon inside the input:
 * typing the key and pressing it looks the records up (see
 * RecordLookupOverlay). Rendered around the field the renderer drew.
 */
export function KeyFieldWrap({ children, onSearch, disabled, fieldName }) {
  const holder_ref = useRef(null);
  return (
    <div ref={holder_ref} className="dcs-key-field">
      {children}
      <InputSearchIcon holderRef={holder_ref} onClick={onSearch} disabled={disabled} fieldName={fieldName} />
    </div>
  );
}

/**
 * A field of a loaded record this person may not change: drawn as it is,
 * but shielded from clicks and marked with a padlock.
 */
export function LockedFieldWrap({ children }) {
  const { translate } = useDcsLanguage();
  return (
    <div className="dcs-locked-field" title={translate("DCS_TRACKING_LOCKED_HINT")}>
      <div inert={true}>{children}</div>
      <div className="dcs-locked-shield" aria-hidden="true" />
      <span className="dcs-locked-badge dcs-no-print" style={{ color: PRIMARY, fontFamily: FONT }}>
        <LockIcon size={11} />
        {translate("DCS_TRACKING_LOCKED")}
      </span>
    </div>
  );
}

/**
 * The round button pinned to the bottom right of a tracked form: opens
 * the record finder, and with a record loaded its history and value
 * timelines first. A small counter shows how many changes the loaded
 * record has been through.
 */
export function RecordFloatingButton({ onClick, count, disabled }) {
  const { translate } = useDcsLanguage();
  return (
    <button type="button" className="dcs-record-fab dcs-no-print" onClick={onClick} disabled={disabled} title={translate("DCS_TRACKING_LOOKUP_TITLE")} aria-label={translate("DCS_TRACKING_LOOKUP_TITLE")}>
      <HistoryIcon size={22} />
      {count > 0 && <span className="dcs-record-fab-count">{count}</span>}
    </button>
  );
}
