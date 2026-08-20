import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsButtonOutline from "./DcsButtonOutline.jsx";

const MAX_COLUMN_WIDTH_PX = 400;

/**
 * Generic paginated table used for collected submissions. Columns and rows
 * are supplied by the caller - this component never hardcodes any field
 * knowledge of its own. The header always renders, even with zero rows -
 * an author needs to see what columns a form actually produced just as
 * much when it has no submissions yet as when it has thousands. Every
 * column is capped at MAX_COLUMN_WIDTH_PX and wraps normally (full text,
 * broken only at word boundaries) once content reaches that cap, rather
 * than truncating or letting one long answer stretch the whole table -
 * the table itself is free to grow wider than its container, scrolling
 * horizontally instead of squeezing every column down to fit.
 */
export default function DcsDataTable({ columns, rows, page, totalPages, onPageChange, loading }) {
  const { translate } = useDcsLanguage();
  const has_rows = rows && rows.length > 0;
  const cell_style = { maxWidth: MAX_COLUMN_WIDTH_PX, whiteSpace: "normal", wordBreak: "normal", overflowWrap: "break-word" };

  return (
    <div className="w-full">
      <div className="table-responsive-container">
        <table className="text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="text-left px-3 py-2"
                  style={Object.assign(
                    {
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: 12,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      color: "#FFFFFF",
                      border: "1px solid #056daa",
                      backgroundColor: "#056daa",
                    },
                    cell_style,
                  )}
                >
                  {column.label !== undefined ? column.label : translate(column.labelKey)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {has_rows &&
              rows.map((row) => (
                <tr key={row.dcs_row_key}>
                  {columns.map((column) => (
                    <td key={column.key} className="px-3 py-2" style={Object.assign({ border: "1px solid #E0E0E0", color: "#333333" }, cell_style)}>
                      {row[column.key]}
                    </td>
                  ))}
                </tr>
              ))}
            {!has_rows && !loading && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center" style={{ border: "1px solid #E0E0E0", color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
                  {translate("DCS_TABLE_NO_DATA")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <DcsButtonOutline disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          {translate("DCS_TABLE_PREVIOUS")}
        </DcsButtonOutline>
        <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, color: "#333333" }}>
          {translate("DCS_TABLE_PAGE_INFO", { page })}
        </span>
        <DcsButtonOutline disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          {translate("DCS_TABLE_NEXT")}
        </DcsButtonOutline>
      </div>
    </div>
  );
}
