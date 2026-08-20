import React, { useMemo } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsButtonOutline from "./DcsButtonOutline.jsx";

const MAX_COLUMN_WIDTH_PX = 400;
const MIN_COLUMN_WIDTH_PX = 96;
const CELL_HORIZONTAL_PADDING_PX = 28;
const HEADER_FONT = "700 12px 'Montserrat', sans-serif";
const DATA_FONT = "400 14px 'Montserrat', sans-serif";

let measure_context = null;

/**
 * The actual rendered pixel width of a piece of text in a given font, via
 * an offscreen canvas - the only way to know a column's true natural width
 * ahead of layout, rather than guessing at it through table-layout:auto's
 * min/max-content heuristics (which is exactly what produced both the
 * "trimmed header" and "vertical header" bugs: word-break/overflow-wrap
 * are allowed, by spec, to shrink a browser's own notion of a text node's
 * intrinsic width down to a single character, so relying on the browser to
 * infer "how wide does this content want to be" was never reliable once
 * any wrapping rule was present).
 */
function measure_text_width(text, font) {
  if (!measure_context) {
    measure_context = document.createElement("canvas").getContext("2d");
  }
  if (!measure_context) return 0;
  measure_context.font = font;
  return measure_context.measureText(String(text ?? "")).width;
}

/**
 * A column's own natural width is the LARGER of its header's width and the
 * widest value currently shown in it, capped at MAX_COLUMN_WIDTH_PX and
 * floored at MIN_COLUMN_WIDTH_PX. Non-text cell content (e.g. the file
 * "click to view" trigger) can't be measured this way and simply falls
 * back to the header driving that column's width instead.
 *
 * The header is measured as its actual rendered glyphs, not its raw
 * string - it's displayed uppercase with 0.5px of letter-spacing
 * (see the <th> style below), neither of which canvas.measureText can see
 * on its own. Measuring the original mixed-case text with no spacing
 * compensation under-measured the true rendered width, leaving so little
 * slack after padding that a second word tipped onto its own line the
 * moment the real (wider) glyphs rendered.
 */
function compute_column_width(header_text, rows, column_key) {
  const uppercase_header = String(header_text ?? "").toUpperCase();
  const header_letter_spacing_px = uppercase_header.length * 0.5;
  let natural_width = measure_text_width(uppercase_header, HEADER_FONT) + header_letter_spacing_px;
  (rows || []).forEach((row) => {
    const value = row[column_key];
    if (typeof value === "string" || typeof value === "number") {
      natural_width = Math.max(natural_width, measure_text_width(value, DATA_FONT));
    }
  });
  return Math.min(MAX_COLUMN_WIDTH_PX, Math.max(MIN_COLUMN_WIDTH_PX, Math.round(natural_width + CELL_HORIZONTAL_PADDING_PX)));
}

/**
 * Generic paginated table used for collected submissions. Columns and rows
 * are supplied by the caller - this component never hardcodes any field
 * knowledge of its own. The header always renders, even with zero rows -
 * an author needs to see what columns a form actually produced just as
 * much when it has no submissions yet as when it has thousands.
 *
 * Column widths are computed explicitly (see compute_column_width) and
 * applied via <colgroup> with table-layout:fixed, rather than left to the
 * browser's automatic table layout - that algorithm decides each column's
 * width from cells' intrinsic sizing, which text-wrapping rules are
 * allowed to shrink arbitrarily (down to a single character), making
 * columns collapse unpredictably depending on which rows happen to be
 * present. With an explicit, measured width driving a fixed layout, a
 * column's width is always exactly min(400px, max(header, content)) - not
 * a guess - and content simply wraps within that width once it doesn't
 * fit on one line; the table itself still grows past its container when
 * the sum of column widths calls for it, scrolling horizontally instead of
 * squeezing everything down to fit.
 */
export default function DcsDataTable({ columns, rows, page, totalPages, onPageChange, loading }) {
  const { translate } = useDcsLanguage();
  const has_rows = rows && rows.length > 0;

  const column_widths = useMemo(() => {
    const widths = {};
    columns.forEach((column) => {
      const header_text = column.label !== undefined ? column.label : translate(column.labelKey);
      widths[column.key] = compute_column_width(header_text, rows, column.key);
    });
    return widths;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, rows]);

  // width:100% so the div always fills its <col>-fixed cell exactly, with
  // minWidth pinned to that same computed column width so table-layout:fixed
  // can never shrink it back down to a single word's width. word-break:
  // keep-all so ordinary words only ever wrap at spaces (never mid-word),
  // with overflow-wrap:break-word as the sole, last-resort fallback for a
  // single token wider than the column itself.
  const get_cell_content_style = (column_key) => ({
    width: "100%",
    minWidth: `${column_widths[column_key]}px`,
    whiteSpace: "normal",
    wordBreak: "keep-all",
    overflowWrap: "break-word",
  });

  return (
    <div className="w-full">
      <div className="bg-white border-2 table-responsive-container" style={{ borderColor: "#E0E0E0" }}>
        <table className="text-sm" style={{ borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            {columns.map((column) => (
              <col key={column.key} style={{ width: `${column_widths[column.key]}px` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {columns.map((column, column_index) => (
                <th
                  key={column.key}
                  className="text-left px-3 py-3"
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: "#FFFFFF",
                    backgroundColor: "#056daa",
                    borderBottom: "2px solid #045a8c",
                    borderRight: column_index < columns.length - 1 ? "1px solid rgba(255,255,255,0.25)" : "none",
                  }}
                >
                  <div style={get_cell_content_style(column.key)}>{column.label !== undefined ? column.label : translate(column.labelKey)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {has_rows &&
              rows.map((row, row_index) => (
                <tr key={row.dcs_row_key} style={{ backgroundColor: row_index % 2 === 1 ? "#F7F9FB" : "#FFFFFF" }}>
                  {columns.map((column, column_index) => (
                    <td
                      key={column.key}
                      className="px-3 py-2.5 align-top"
                      style={{
                        color: "#333333",
                        borderBottom: "1px solid #E0E0E0",
                        borderRight: column_index < columns.length - 1 ? "1px solid #E0E0E0" : "none",
                      }}
                    >
                      <div style={get_cell_content_style(column.key)}>{row[column.key]}</div>
                    </td>
                  ))}
                </tr>
              ))}
            {!has_rows && !loading && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
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
