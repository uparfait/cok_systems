import React from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import BuilderFieldSelect from "./BuilderFieldSelect.jsx";

export const PRIMARY = "#056daa";
export const BORDER = "#E0E0E0";
export const TEXT_DARK = "#333333";
export const TEXT_MUTED = "#9E9E9E";
export const WARNING = "#B9770E";
export const HEADING_FONT = { fontFamily: "'Montserrat', sans-serif" };

/** A numbered step heading with its short explanation. */
export function Step({ number, titleKey, hintKey, children }) {
  const { translate } = useDcsLanguage();
  return (
    <section className="dcs-builder-step">
      <div className="flex items-start gap-2 mb-2">
        <span
          className="flex items-center justify-center text-[11px] font-bold flex-shrink-0"
          style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: PRIMARY, color: "#FFFFFF", ...HEADING_FONT }}
        >
          {number}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase leading-[22px]" style={{ color: TEXT_DARK, letterSpacing: "0.5px", ...HEADING_FONT }}>
            {translate(titleKey)}
          </p>
          {hintKey && (
            <p className="text-xs" style={{ color: TEXT_MUTED }}>
              {translate(hintKey)}
            </p>
          )}
        </div>
      </div>
      <div className="pl-[30px]">{children}</div>
    </section>
  );
}

/** A grid of pick-one chips; the chosen one fills solid and shows its hint below. */
export function ChipGrid({ options, value, onChange, disabled, columns }) {
  const { translate } = useDcsLanguage();
  const selected = options.find((option) => option.id === value) || null;
  return (
    <div>
      <div className={`grid gap-1.5 ${columns || "grid-cols-2 sm:grid-cols-3"}`}>
        {options.map((option) => {
          const active = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onChange(option.id)}
              className="dcs-builder-chip text-xs font-semibold text-left px-3 py-2 truncate cursor-pointer disabled:cursor-not-allowed"
              title={option.label}
              style={{
                border: `1px solid ${active ? PRIMARY : BORDER}`,
                backgroundColor: active ? PRIMARY : "#FFFFFF",
                color: active ? "#FFFFFF" : TEXT_DARK,
                ...HEADING_FONT,
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {selected && selected.hintKey && (
        <p className="dcs-view-swap text-xs mt-2" style={{ color: TEXT_MUTED }}>
          {translate(selected.hintKey)}
        </p>
      )}
    </div>
  );
}

/** A labeled on/off switch. */
export function Switch({ checked, onChange, label, disabled }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none" style={{ opacity: disabled ? 0.6 : 1 }}>
      <span
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => !disabled && onChange(!checked)}
        onKeyDown={(event) => {
          if ((event.key === " " || event.key === "Enter") && !disabled) {
            event.preventDefault();
            onChange(!checked);
          }
        }}
        className="dcs-builder-switch"
        style={{ backgroundColor: checked ? PRIMARY : "#C7C7C7" }}
      >
        <span className="dcs-builder-switch-knob" style={{ transform: checked ? "translateX(18px)" : "translateX(0)" }} />
      </span>
      <span className="text-sm font-semibold" style={{ color: TEXT_DARK, ...HEADING_FONT }}>
        {label}
      </span>
    </label>
  );
}

/** A quiet, amber "what is still missing" line. */
export function Problem({ children }) {
  if (!children) return null;
  return (
    <p className="dcs-view-swap text-xs px-3 py-2 mt-2" style={{ backgroundColor: "rgba(243,156,18,0.08)", borderLeft: "3px solid #F39C12", color: WARNING }}>
      {children}
    </p>
  );
}

/** A blue "this is what you get" line. */
export function Preview({ children }) {
  if (!children) return null;
  return (
    <p className="dcs-view-swap text-xs px-3 py-2" style={{ backgroundColor: "rgba(5,109,170,0.06)", borderLeft: `3px solid ${PRIMARY}`, color: TEXT_DARK }}>
      {children}
    </p>
  );
}

/** The searchable field select, labeled. */
export function FieldSelect({ label, options, value, onChange, placeholder, disabled, allowClear }) {
  return (
    <div className="mb-2">
      {label && (
        <p className="text-xs mb-1" style={{ color: TEXT_MUTED }}>
          {label}
        </p>
      )}
      <BuilderFieldSelect options={options} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} allowClear={allowClear} />
    </div>
  );
}

/** Title and description inputs shared by every composer. */
export function TitleFields({ title, description, onTitle, onDescription, disabled }) {
  const { translate } = useDcsLanguage();
  return (
    <>
      <input
        className="cok-auth-input w-full py-2"
        placeholder={translate("DCS_DB_WIDGET_TITLE")}
        value={title}
        maxLength={120}
        disabled={disabled}
        onChange={(event) => onTitle(event.target.value)}
      />
      <textarea
        className="cok-auth-input w-full py-2 mt-2"
        rows={2}
        maxLength={300}
        placeholder={translate("DCS_DB_REVIEW_DESC_PLACEHOLDER")}
        value={description}
        disabled={disabled}
        onChange={(event) => onDescription(event.target.value)}
      />
    </>
  );
}
