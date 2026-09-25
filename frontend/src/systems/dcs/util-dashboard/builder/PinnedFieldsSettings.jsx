import React from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { PRIMARY, BORDER, TEXT_DARK, TEXT_MUTED, HEADING_FONT } from "./builderUi.jsx";
import { filter_candidates } from "../boardFilters.js";

const TICK = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12l5 5L20 7" />
  </svg>
);

/**
 * The board filters one widget IGNORES. Every filter field the board
 * carries is listed; ticking one pins the widget on it, so a district
 * chart keeps every district when the board is filtered to one - and a
 * filter on a field under it in the cascade (its sectors) is ignored with
 * it, because a sector already names a district. Nothing here changes the
 * board's filters themselves.
 */
export default function PinnedFieldsSettings({ fields, filterDefs, value, onChange, disabled }) {
  const { translate } = useDcsLanguage();
  const candidates = filter_candidates(fields || []);
  const listed = (filterDefs || []).map((def) => candidates.find((field) => field.id === def.field_id)).filter(Boolean);
  const chosen = new Set(value || []);
  const toggle = (field_id) => {
    const next = chosen.has(field_id) ? (value || []).filter((id) => id !== field_id) : (value || []).concat([field_id]);
    onChange(next.slice(0, 10));
  };
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs" style={{ color: TEXT_MUTED }}>{translate("DCS_DB_PINNED_HINT")}</p>
      {listed.length === 0 ? (
        <p className="text-xs px-3 py-2" style={{ color: TEXT_MUTED, backgroundColor: "#F7F9FB" }}>{translate("DCS_DB_PINNED_NONE")}</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {listed.map((field) => {
            const on = chosen.has(field.id);
            return (
              <li key={field.id}>
                <button
                  type="button"
                  disabled={disabled}
                  aria-pressed={on}
                  className="dcs-filter-tab-row w-full text-left flex items-center gap-3 p-2 border-2"
                  style={{ borderColor: on ? PRIMARY : BORDER, backgroundColor: on ? "rgba(5,109,170,0.05)" : "#FFFFFF", cursor: disabled ? "not-allowed" : "pointer" }}
                  onClick={() => toggle(field.id)}
                >
                  <span className="flex items-center justify-center flex-shrink-0" style={{ width: 18, height: 18, border: `2px solid ${on ? PRIMARY : BORDER}`, backgroundColor: on ? PRIMARY : "#FFFFFF" }}>
                    {on ? TICK : null}
                  </span>
                  <span className="text-xs font-semibold break-words min-w-0" style={{ color: TEXT_DARK, ...HEADING_FONT }}>
                    {translate("DCS_DB_PINNED_IGNORE", { field: field.label })}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
