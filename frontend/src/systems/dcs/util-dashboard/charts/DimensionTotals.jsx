import React from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";

/**
 * The count line every chart carries under its legend: for each choice
 * field the widget reads - what it groups by, splits by, patterns by, the
 * field a KPI legends by or an occurrence card counts - how many different
 * values that field holds right now, so a district chart says "TOTAL
 * DISTRICTS 40". The server counts them under the same filters and window
 * the chart was drawn with, so filtering the board changes these numbers
 * too.
 */
export default function DimensionTotals({ totals, palette }) {
  const { translate } = useDcsLanguage();
  const items = (totals || []).filter((entry) => entry && entry.label);
  if (items.length === 0) return null;
  return (
    <div className="dcs-chart-totals">
      {items.map((entry) => (
        <span key={entry.field_id} className="dcs-chart-total" style={{ color: palette.muted }}>
          {translate("DCS_DB_TOTAL_OF", { field: entry.label })}
          <b style={{ color: palette.number }}>{Number(entry.count || 0).toLocaleString("en-US")}</b>
        </span>
      ))}
    </div>
  );
}
