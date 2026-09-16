import React from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { field_type_key } from "./composeWidgets.js";
import { filter_candidates, filter_usage, toggle_filter_def, MAX_BOARD_FILTERS } from "../boardFilters.js";

const PRIMARY = "#056daa";
const BORDER = "#E0E0E0";
const TEXT_DARK = "#333333";
const TEXT_MUTED = "#9E9E9E";
const HEADING_FONT = { fontFamily: "'Montserrat', sans-serif" };

const TICK = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12l5 5L20 7" />
  </svg>
);

/**
 * The builder's "Filters" tab: the form's fields that can filter the board
 * (selects, radios, cascading selects, select groups), each toggled on or
 * off. Fields the widgets on the board or in the drafts already read are
 * marked, because a filter on them changes what those widgets show: a
 * chart per district drills down to sectors once a district is picked, a
 * KPI legend by gender disappears once a gender is picked. The chosen
 * filters are saved together with the widgets.
 */
export default function FiltersTab({ fields, widgets, selected, onChange, disabled }) {
  const { translate } = useDcsLanguage();
  const candidates = filter_candidates(fields);
  const usage = filter_usage(widgets);
  const chosen = new Set((selected || []).map((def) => def.field_id));
  const full = chosen.size >= MAX_BOARD_FILTERS;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-bold uppercase" style={{ color: TEXT_DARK, letterSpacing: "0.3px", ...HEADING_FONT }}>
          {translate("DCS_DB_FILTERS_TAB_TITLE")}
        </p>
        <p className="text-xs mt-1" style={{ color: TEXT_MUTED }}>
          {translate("DCS_DB_FILTERS_TAB_INTRO")}
        </p>
        <p className="text-xs mt-1" style={{ color: TEXT_MUTED }}>
          {translate("DCS_DB_FILTERS_TAB_EXAMPLE")}
        </p>
      </div>

      {candidates.length === 0 ? (
        <div className="border-2 p-6 text-center" style={{ borderColor: BORDER }}>
          <p className="text-sm font-semibold" style={{ color: TEXT_DARK, ...HEADING_FONT }}>
            {translate("DCS_DB_FILTER_NO_CANDIDATES")}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {candidates.map((field) => {
            const on = chosen.has(field.id);
            const used = usage.get(field.id) || 0;
            const type_key = field_type_key(field);
            const blocked = !on && full;
            return (
              <li key={field.id}>
                <button
                  type="button"
                  disabled={disabled || blocked}
                  aria-pressed={on}
                  className="dcs-filter-tab-row w-full text-left flex items-start gap-3 p-3 border-2"
                  style={{ borderColor: on ? PRIMARY : BORDER, backgroundColor: on ? "rgba(5,109,170,0.05)" : "#FFFFFF", cursor: disabled || blocked ? "not-allowed" : "pointer", opacity: blocked ? 0.55 : 1 }}
                  onClick={() => onChange(toggle_filter_def(selected || [], field.id))}
                >
                  <span className="flex items-center justify-center flex-shrink-0 mt-0.5" style={{ width: 18, height: 18, border: `2px solid ${on ? PRIMARY : BORDER}`, backgroundColor: on ? PRIMARY : "#FFFFFF" }}>
                    {on ? TICK : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold break-words" style={{ color: TEXT_DARK, ...HEADING_FONT }}>
                      {field.label}
                    </span>
                    <span className="block text-xs mt-0.5" style={{ color: TEXT_MUTED }}>
                      {type_key ? translate(type_key) : field.type}
                    </span>
                    {used > 0 && (
                      <span className="inline-block text-[10px] font-bold uppercase mt-1.5 px-1.5 py-0.5" style={{ color: PRIMARY, border: `1px solid ${PRIMARY}`, letterSpacing: "0.4px", ...HEADING_FONT }}>
                        {translate("DCS_DB_FILTER_USED_BY", { count: used })}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs" style={{ color: TEXT_MUTED }}>
        {translate("DCS_DB_FILTERS_TAB_COUNT", { count: chosen.size, max: MAX_BOARD_FILTERS })}
      </p>
    </div>
  );
}
