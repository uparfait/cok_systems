import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

const FONT = { fontFamily: "'Montserrat', sans-serif" };

/**
 * What the board filters mean for one widget, as the server reported it in
 * board_context: every applied value the widget runs under, and which of
 * them reshaped the widget (a drill-down into a cascade child, a collapse
 * to the one picked value, a legend that went).
 */

/** The strip above the title: every applied filter, small, "Field: value". */
export function FilterStrip({ context, color }) {
  const { translate } = useDcsLanguage();
  if (!Array.isArray(context) || context.length === 0) return null;
  const seen = new Set();
  const entries = context.filter((entry) => {
    const key = `${entry.field_id}|${entry.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return (
    <p className="dcs-widget-filter-strip text-[10px] font-semibold uppercase truncate px-3 pt-2" style={{ color, letterSpacing: "0.4px", margin: 0, ...FONT }} title={entries.map((entry) => `${entry.field_label}: ${entry.value}`).join(" | ")}>
      {translate("DCS_DB_FILTERS_APPLIED")}: {entries.map((entry) => `${entry.field_label} ${entry.value}`).join(" | ")}
    </p>
  );
}

/** After the title: the values that RESHAPED this widget ("(Kigali)"), in the accent color. */
export function TitleContext({ context, color }) {
  if (!Array.isArray(context)) return null;
  const seen = new Set();
  const entries = context.filter((entry) => {
    if (entry.role === "filter") return false;
    const key = String(entry.value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (entries.length === 0) return null;
  return (
    <span className="text-xs font-bold break-words" style={{ color, ...FONT }} title={entries.map((entry) => `${entry.field_label}: ${entry.value}`).join(", ")}>
      ({entries.map((entry) => String(entry.value)).join(", ")})
    </span>
  );
}
