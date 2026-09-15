import React, { useEffect, useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { normalize_color } from "../appearance.js";

const BORDER = "#E0E0E0";
const DANGER = "#E74C3C";
const TEXT_MUTED = "#9E9E9E";
const HEADING_FONT = { fontFamily: "'Montserrat', sans-serif" };

/**
 * One color control: a swatch that opens the browser's native picker, next
 * to a text box that accepts a pasted hex ("#0af", "#056daa") or rgb /
 * rgba value and normalizes it to hex on Enter or blur. An invalid entry
 * is flagged in red and never applied. `fallback` is what shows when the
 * value is unset (the automatic color), with an optional Reset link.
 */
export default function ColorInput({ label, value, fallback, onChange, onClear, disabled, autoTag }) {
  const { translate } = useDcsLanguage();
  const shown = value || fallback || "#000000";
  const [draft, setDraft] = useState(shown);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setDraft(shown);
    setInvalid(false);
  }, [shown]);

  const commit = () => {
    const normalized = normalize_color(draft);
    if (!normalized) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setDraft(normalized);
    if (normalized !== value) onChange(normalized);
  };

  return (
    <div className="flex items-center gap-2 min-w-0">
      {label && (
        <span className="text-xs flex-1 min-w-0 truncate" style={{ color: "#333333", ...HEADING_FONT }} title={label}>
          {label}
        </span>
      )}
      {!value && autoTag && (
        <span className="text-[10px] font-bold uppercase flex-shrink-0" style={{ color: TEXT_MUTED, letterSpacing: "0.4px" }}>
          {autoTag}
        </span>
      )}
      <label className="relative flex-shrink-0 cursor-pointer" title={translate("DCS_DB_COLOR_PICK")} style={{ width: 30, height: 30, border: `1px solid ${BORDER}`, backgroundColor: shown }}>
        <input
          type="color"
          value={shown}
          disabled={disabled}
          onChange={(event) => {
            setInvalid(false);
            setDraft(event.target.value);
            onChange(event.target.value);
          }}
          className="absolute inset-0 opacity-0 cursor-pointer"
          style={{ width: "100%", height: "100%" }}
        />
      </label>
      <input
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
        placeholder="#RRGGBB"
        aria-invalid={invalid}
        title={invalid ? translate("DCS_DB_COLOR_INVALID") : ""}
        className="text-xs px-2 py-1.5 flex-shrink-0"
        style={{ width: 118, border: `1px solid ${invalid ? DANGER : BORDER}`, color: invalid ? DANGER : "#333333", backgroundColor: "#FFFFFF", fontFamily: "Consolas, monospace", outline: "none" }}
      />
      {onClear && value && (
        <button type="button" disabled={disabled} onClick={onClear} className="text-[11px] font-semibold flex-shrink-0 cursor-pointer" style={{ color: TEXT_MUTED, background: "none", border: "none", padding: 0, ...HEADING_FONT }}>
          {translate("DCS_DB_COLOR_RESET_ONE")}
        </button>
      )}
    </div>
  );
}
