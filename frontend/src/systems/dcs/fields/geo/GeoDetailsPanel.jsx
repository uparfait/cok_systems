import React from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { GEO_DETAIL_ROWS } from "./geoHelpers.js";

export default function GeoDetailsPanel({ details }) {
  const { translate } = useDcsLanguage();
  const format_accuracy = (accuracy_meters) =>
    accuracy_meters == null ? translate("DCS_GEO_NOT_AVAILABLE") : translate("DCS_GEO_ACCURACY_METERS", { value: Math.round(accuracy_meters) });

  return (
    <div className="p-3" style={{ border: "1px solid #E0E0E0", borderRadius: 10 }}>
      <p className="text-xs font-semibold uppercase mb-2" style={{ color: "#9E9E9E", letterSpacing: "0.5px" }}>
        {translate("DCS_GEO_DETAILS_TITLE")}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.75rem" }}>
        {GEO_DETAIL_ROWS.map((row) => {
          const raw_value = row.is_accuracy ? details.accuracy : details[row.key];
          return (
            <div key={row.key} style={{ gridColumn: row.full_width ? "1 / -1" : undefined, minWidth: 0 }}>
              <p className="text-xs" style={{ color: "#9E9E9E" }}>
                {translate(row.labelKey)}
              </p>
              <p className="text-sm font-semibold" style={{ color: "#333333", wordBreak: "break-word" }}>
                {row.is_accuracy ? format_accuracy(details.accuracy) : raw_value == null || raw_value === "" ? translate("DCS_GEO_NOT_AVAILABLE") : raw_value}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
