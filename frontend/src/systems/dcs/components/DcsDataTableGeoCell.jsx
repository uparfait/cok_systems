import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

const GEO_CELL_COLUMNS = [
  { key: "latitude", labelKey: "DCS_GEO_LATITUDE_LABEL", widthPx: 140 },
  { key: "longitude", labelKey: "DCS_GEO_LONGITUDE_LABEL", widthPx: 140 },
  { key: "accuracy", labelKey: "DCS_GEO_ACCURACY_LABEL", is_accuracy: true, widthPx: 100 },
  { key: "province", labelKey: "DCS_GEO_PROVINCE_LABEL", widthPx: 100 },
  { key: "district", labelKey: "DCS_GEO_DISTRICT_LABEL", widthPx: 140 },
  { key: "sector", labelKey: "DCS_GEO_SECTOR_LABEL", widthPx: 100 },
  { key: "cell", labelKey: "DCS_GEO_CELL_LABEL", widthPx: 90 },
  { key: "village", labelKey: "DCS_GEO_VILLAGE_LABEL", widthPx: 100 },
  { key: "street", labelKey: "DCS_GEO_STREET_LABEL", widthPx: 130 },
  { key: "full_address", labelKey: "DCS_GEO_FULL_ADDRESS_LABEL", widthPx: 320 },
];

// "Map location" is just one more header in this same row, at the end -
// not a separate spanning caption above the others - it labels the whole
// nested table the same way any of the real attribute headers label their
// own column; its own data cell (below) reports whether this particular
// answer was device-detected or hand-typed.
const RECORDED_LABEL_COLUMN = { key: "recorded_label", labelKey: "DCS_GEO_TABLE_CELL_TITLE", widthPx: 170 };
const ALL_COLUMNS = GEO_CELL_COLUMNS.concat([RECORDED_LABEL_COLUMN]);

// The outer collected-data table's own td adds its own horizontal padding
// (px-3 = 12px each side) around this nested table's content - reserving
// only the nested table's own width for the column would leave it just
// short of the space it actually needs once that padding is subtracted
// back out, the exact gap that let it visually spill into the next
// column's cell.
const OUTER_CELL_HORIZONTAL_PADDING_PX = 32;

// The nested table below is naturally this wide (every attribute plus the
// trailing label, all side by side) - the outer collected-data table's own
// column for a geolocation field needs to be told to actually reserve this
// much space (see DcsDataTable's minWidthPx column override), since its
// normal text-measuring auto-width logic has no way to measure a nested
// table.
export const GEO_CELL_TABLE_MIN_WIDTH_PX = ALL_COLUMNS.reduce((sum, column) => sum + column.widthPx, 0) + OUTER_CELL_HORIZONTAL_PADDING_PX;

const HEADER_CELL_STYLE = {
  padding: "2px 6px",
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.3px",
  color: "#9E9E9E",
  fontFamily: "'Montserrat', sans-serif",
  borderBottom: "1px solid #E0E0E0",
  whiteSpace: "nowrap",
};

/**
 * One collected-data table cell for a geolocation answer. The stored value
 * is a plain object (latitude/longitude/accuracy plus the reverse-geocoded
 * administrative levels) - stringifying it directly would show up as
 * unreadable "[object Object]" text, so this renders a nested table with
 * every one of those attributes as its own column header (plus a trailing
 * "Map location" header, styled and positioned exactly like the rest,
 * whose own value reports Recorded vs. Manually entered) and the actual
 * values as the single row underneath.
 */
export default function DcsDataTableGeoCell({ value }) {
  const { translate } = useDcsLanguage();
  if (!value || typeof value !== "object" || value.latitude == null || value.longitude == null) return null;

  const format_accuracy = (accuracy_meters) =>
    accuracy_meters == null ? translate("DCS_GEO_NOT_AVAILABLE") : translate("DCS_GEO_ACCURACY_METERS", { value: Math.round(accuracy_meters) });

  return (
    <table style={{ borderCollapse: "collapse", tableLayout: "fixed", width: GEO_CELL_TABLE_MIN_WIDTH_PX }}>
      <colgroup>
        {ALL_COLUMNS.map((column) => (
          <col key={column.key} style={{ width: column.widthPx }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {ALL_COLUMNS.map((column) => (
            <th key={column.key} className="text-left" style={HEADER_CELL_STYLE}>
              {translate(column.labelKey)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {GEO_CELL_COLUMNS.map((column) => {
            const raw_value = column.is_accuracy ? value.accuracy : value[column.key];
            return (
              <td
                key={column.key}
                className="align-top"
                style={{ padding: "2px 6px", fontSize: 12, color: "#333333", fontFamily: "'Montserrat', sans-serif", wordBreak: "break-word" }}
              >
                {column.is_accuracy
                  ? format_accuracy(value.accuracy)
                  : raw_value == null || raw_value === ""
                    ? translate("DCS_GEO_NOT_AVAILABLE")
                    : raw_value}
              </td>
            );
          })}
          <td className="align-top" style={{ padding: "2px 6px", fontSize: 12, color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
            {translate(value.is_manual ? "DCS_GEO_STATUS_MANUALLY_ENTERED" : "DCS_GEO_STATUS_RECORDED")}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
