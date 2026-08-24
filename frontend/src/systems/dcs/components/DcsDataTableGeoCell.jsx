import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

const GEO_CELL_ROWS = [
  { key: "latitude", labelKey: "DCS_GEO_LATITUDE_LABEL" },
  { key: "longitude", labelKey: "DCS_GEO_LONGITUDE_LABEL" },
  { key: "accuracy", labelKey: "DCS_GEO_ACCURACY_LABEL", is_accuracy: true },
  { key: "province", labelKey: "DCS_GEO_PROVINCE_LABEL" },
  { key: "district", labelKey: "DCS_GEO_DISTRICT_LABEL" },
  { key: "sector", labelKey: "DCS_GEO_SECTOR_LABEL" },
  { key: "cell", labelKey: "DCS_GEO_CELL_LABEL" },
  { key: "village", labelKey: "DCS_GEO_VILLAGE_LABEL" },
  { key: "street", labelKey: "DCS_GEO_STREET_LABEL" },
  { key: "full_address", labelKey: "DCS_GEO_FULL_ADDRESS_LABEL" },
];

/**
 * One collected-data table cell for a geolocation answer. The stored value
 * is a plain object (latitude/longitude/accuracy plus the reverse-geocoded
 * administrative levels) - stringifying it directly would show up as
 * unreadable "[object Object]" text, so this renders a short caption plus a
 * compact nested table breaking every field of it out into its own row.
 */
export default function DcsDataTableGeoCell({ value }) {
  const { translate } = useDcsLanguage();
  if (!value || typeof value !== "object" || value.latitude == null || value.longitude == null) return null;

  const format_accuracy = (accuracy_meters) =>
    accuracy_meters == null ? translate("DCS_GEO_NOT_AVAILABLE") : translate("DCS_GEO_ACCURACY_METERS", { value: Math.round(accuracy_meters) });

  return (
    <div>
      <p className="text-xs font-bold mb-1" style={{ color: "#056daa", fontFamily: "'Montserrat', sans-serif" }}>
        {translate("DCS_GEO_TABLE_CELL_TITLE")}
      </p>
      <table style={{ borderCollapse: "collapse" }}>
        <tbody>
          {GEO_CELL_ROWS.map((row) => {
            const raw_value = row.is_accuracy ? value.accuracy : value[row.key];
            return (
              <tr key={row.key}>
                <td className="pr-2 py-0.5 align-top" style={{ color: "#9E9E9E", fontSize: 11, whiteSpace: "nowrap", fontFamily: "'Montserrat', sans-serif" }}>
                  {translate(row.labelKey)}
                </td>
                <td className="py-0.5 align-top" style={{ color: "#333333", fontSize: 12, fontFamily: "'Montserrat', sans-serif" }}>
                  {row.is_accuracy
                    ? format_accuracy(value.accuracy)
                    : raw_value == null || raw_value === ""
                      ? translate("DCS_GEO_NOT_AVAILABLE")
                      : raw_value}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
