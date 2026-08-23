import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsButtonPrimary from "./DcsButtonPrimary.jsx";

// Shared with DcsTableSearchSort's search input and sort toggle, so every
// control across the whole filter bar lines up at exactly the same height.
export const FILTER_CONTROL_HEIGHT_PX = 40;

const PERIOD_OPTIONS = [
  { value: "all", labelKey: "DCS_STATS_PERIOD_ALL" },
  { value: "today", labelKey: "DCS_STATS_PERIOD_TODAY" },
  { value: "this_month", labelKey: "DCS_STATS_PERIOD_THIS_MONTH" },
  { value: "this_year", labelKey: "DCS_STATS_PERIOD_THIS_YEAR" },
  { value: "custom", labelKey: "DCS_STATS_PERIOD_CUSTOM" },
];

/**
 * Shared date-range filter bar (chart and the submissions tables) - a
 * preset dropdown plus, only for "custom", a from/to pair and an explicit
 * Apply button (a preset period fetches immediately on selection, custom
 * only fetches once Apply is clicked, so a partially-typed range is never
 * silently applied). includeAll shows the "All" preset - the tables' own
 * default - which the stats chart never offers itself.
 */
export default function DcsPeriodFilter({ period, onPeriodChange, from, onFromChange, to, onToChange, onApply, includeAll }) {
  const { translate } = useDcsLanguage();
  const options = includeAll ? PERIOD_OPTIONS : PERIOD_OPTIONS.filter((option) => option.value !== "all");

  return (
    <div className="flex flex-row items-center gap-2 flex-shrink-0">
      <select
        value={period}
        onChange={(event) => onPeriodChange(event.target.value)}
        className="cok-auth-input text-sm flex-shrink-0"
        style={{ fontFamily: "'Montserrat', sans-serif", height: FILTER_CONTROL_HEIGHT_PX, minHeight: FILTER_CONTROL_HEIGHT_PX }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {translate(option.labelKey)}
          </option>
        ))}
      </select>
      {period === "custom" && (
        <>
          <input
            type="date"
            value={from}
            onChange={(event) => onFromChange(event.target.value)}
            className="cok-auth-input text-sm flex-shrink-0"
            style={{ minWidth: 150, height: FILTER_CONTROL_HEIGHT_PX, minHeight: FILTER_CONTROL_HEIGHT_PX }}
          />
          <input
            type="date"
            value={to}
            onChange={(event) => onToChange(event.target.value)}
            className="cok-auth-input text-sm flex-shrink-0"
            style={{ minWidth: 150, height: FILTER_CONTROL_HEIGHT_PX, minHeight: FILTER_CONTROL_HEIGHT_PX }}
          />
          <DcsButtonPrimary onClick={onApply} disabled={!from} style={{ padding: "0 1.2rem", height: FILTER_CONTROL_HEIGHT_PX, flexShrink: 0 }}>
            {translate("DCS_BTN_APPLY")}
          </DcsButtonPrimary>
        </>
      )}
    </div>
  );
}
