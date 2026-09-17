import React, { useEffect, useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { normalize_color, color_alpha, with_color_alpha, opaque_color } from "../appearance.js";

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
 *
 * With `alpha`, the color may also be SEE-THROUGH: a slider sets how solid
 * it is and the value carries that as two more hex digits ("#1e2a3580").
 * The swatch sits on a chequerboard so the transparency is visible rather
 * than guessed at, and the native picker - which only understands six
 * digits - is fed the color and handed back its opacity unchanged.
 */
export default function ColorInput({ label, value, fallback, onChange, onClear, disabled, autoTag, alpha }) {
  const { translate } = useDcsLanguage();
  const shown = value || fallback || "#000000";
  const solid = opaque_color(shown) || "#000000";
  const opacity = color_alpha(shown);
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
      <label className={`relative flex-shrink-0 cursor-pointer ${alpha ? "dcs-color-swatch" : ""}`} title={translate("DCS_DB_COLOR_PICK")} style={{ width: 30, height: 30, border: `1px solid ${BORDER}` }}>
        <span className="absolute inset-0" style={{ backgroundColor: shown }} />
        <input
          type="color"
          value={solid}
          disabled={disabled}
          onChange={(event) => {
            // The native picker has no opacity of its own, so whatever
            // this control already had is kept.
            const next = alpha ? with_color_alpha(event.target.value, opacity) : event.target.value;
            setInvalid(false);
            setDraft(next);
            onChange(next);
          }}
          className="absolute inset-0 opacity-0 cursor-pointer"
          style={{ width: "100%", height: "100%" }}
        />
      </label>
      {alpha && (
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={Math.round(opacity * 100)}
          disabled={disabled}
          title={translate("DCS_DB_COLOR_OPACITY", { percent: Math.round(opacity * 100) })}
          aria-label={translate("DCS_DB_COLOR_OPACITY", { percent: Math.round(opacity * 100) })}
          onChange={(event) => {
            const next = with_color_alpha(shown, Number(event.target.value) / 100);
            setInvalid(false);
            setDraft(next);
            onChange(next);
          }}
          className="dcs-color-opacity flex-shrink-0"
        />
      )}
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
        placeholder={alpha ? "#RRGGBBAA" : "#RRGGBB"}
        aria-invalid={invalid}
        title={invalid ? translate("DCS_DB_COLOR_INVALID") : ""}
        className="text-xs px-2 py-1.5 flex-shrink-0"
        style={{ width: alpha ? 104 : 118, border: `1px solid ${invalid ? DANGER : BORDER}`, color: invalid ? DANGER : "#333333", backgroundColor: "#FFFFFF", fontFamily: "Consolas, monospace", outline: "none" }}
      />
      {onClear && value && (
        <button type="button" disabled={disabled} onClick={onClear} className="text-[11px] font-semibold flex-shrink-0 cursor-pointer" style={{ color: TEXT_MUTED, background: "none", border: "none", padding: 0, ...HEADING_FONT }}>
          {translate("DCS_DB_COLOR_RESET_ONE")}
        </button>
      )}
    </div>
  );
}
