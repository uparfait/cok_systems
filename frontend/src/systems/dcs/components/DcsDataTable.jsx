import React, { useEffect, useMemo, useRef } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

const MAX_COLUMN_WIDTH_PX = 400;
const MIN_COLUMN_WIDTH_PX = 96;
const CELL_HORIZONTAL_PADDING_PX = 28;
const HEADER_FONT = "700 12px 'Montserrat', sans-serif";
const DATA_FONT = "400 14px 'Montserrat', sans-serif";
const SKELETON_ROW_COUNT = 8;
const PAGE_WINDOW_SIZE = 10;

const TINT_CELL_COLORS = {
  green: "rgba(76,175,80,0.10)",
  red: "rgba(231,76,60,0.10)",
};

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
 * A contiguous run of up to `window_size` page numbers centered on the
 * current page - "1 2 3 4 5 6 7 8 9 10 …" rather than every page ever, so
 * the footer stays a fixed, glanceable width no matter how many pages
 * exist.
 */
function build_page_window(current_page, total_pages, window_size) {
  if (total_pages <= window_size) return { start: 1, end: total_pages };
  let start = Math.max(1, current_page - Math.floor(window_size / 2));
  let end = start + window_size - 1;
  if (end > total_pages) {
    end = total_pages;
    start = Math.max(1, end - window_size + 1);
  }
  return { start, end };
}

function PageArrowButton({ direction, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="dcs-page-arrow flex-shrink-0 flex items-center justify-center"
      style={{
        width: 38,
        height: 38,
        borderRadius: "50%",
        border: "1px solid #E0E0E0",
        backgroundColor: "#FFFFFF",
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? "default" : "pointer",
      }}
      aria-label={direction === "prev" ? "Previous page" : "Next page"}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#056daa" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        {direction === "prev" ? <polyline points="15 6 9 12 15 18" /> : <polyline points="9 6 15 12 9 18" />}
      </svg>
    </button>
  );
}

function PageNumberButton({ number, isActive, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`dcs-page-number flex-shrink-0 ${isActive ? "is-active" : ""}`}
      style={{
        minWidth: 38,
        height: 38,
        padding: "0 7px",
        borderRadius: "50%",
        border: isActive ? "1px solid #056daa" : "1px solid transparent",
        backgroundColor: isActive ? "#056daa" : "transparent",
        color: isActive ? "#FFFFFF" : "#333333",
        transform: isActive ? "scale(1)" : "scale(0.82)",
        fontFamily: "'Montserrat', sans-serif",
        fontSize: 14,
        fontWeight: isActive ? 700 : 500,
        cursor: "pointer",
      }}
    >
      {number}
    </button>
  );
}

/**
 * Generic table used for collected submissions, always filling its parent's
 * height exactly (the parent must give it a bounded height) rather than
 * growing the page - a sticky header keeps column names visible while only
 * the body scrolls, and the previous/next footer sits below that scrolling
 * region entirely, so it can never scroll out of view itself. Columns and
 * rows are supplied by the caller - this component never hardcodes any
 * field knowledge of its own. The header always renders, even with zero
 * rows - an author needs to see what columns a form actually produced just
 * as much when it has no submissions yet as when it has thousands.
 *
 * Column widths are computed explicitly (see compute_column_width) and
 * applied via <colgroup> with table-layout:fixed, rather than left to the
 * browser's automatic table layout. The scroll container centers the table
 * horizontally (flex + justify-content:center) whenever the sum of column
 * widths is narrower than the container, instead of leaving it pinned to
 * one edge with the leftover space on the other side; flexShrink:0 on the
 * table itself means that centering can never shrink a column back down -
 * once the table's natural width exceeds the container, it overflows and
 * scrolls exactly as before.
 *
 * columnTints marks a whole column green/red (the version-diff feature: a
 * field added in the active version, or removed from it) - every body cell
 * in that column picks up a light tint, and legendItems renders the color
 * key below the table.
 *
 * scrollResetKey resets the body's own scroll position to the top whenever
 * it changes - the caller passes something that changes exactly when fresh
 * data has landed (e.g. a page number), so a page/filter change is always
 * seen starting from row one instead of wherever the previous page's
 * scroll happened to be.
 */
export default function DcsDataTable({ columns, rows, page, totalPages, onPageChange, loading, columnTints, legendItems, scrollResetKey, totalCount, onRowClick }) {
  const { translate } = useDcsLanguage();
  const has_rows = rows && rows.length > 0;
  const scroll_container_ref = useRef(null);

  useEffect(() => {
    if (scroll_container_ref.current) scroll_container_ref.current.scrollTop = 0;
  }, [scrollResetKey]);

  const column_widths = useMemo(() => {
    const widths = {};
    columns.forEach((column) => {
      // A column whose cells render something other than plain text (e.g.
      // a nested table) can't be measured by compute_column_width's
      // text-only heuristic - the caller supplies the real width it needs
      // directly instead, bypassing both the measurement and its normal
      // MAX_COLUMN_WIDTH_PX cap.
      if (column.minWidthPx) {
        widths[column.key] = column.minWidthPx;
        return;
      }
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
  // single token wider than the column itself. The actual clip/scroll
  // boundary against content wider than the column (e.g. a nested table)
  // lives on the enclosing <td> itself (see overflowX there), not here -
  // keeping it off this div avoids a second, redundant scroll container.
  const get_cell_content_style = (column_key) => ({
    width: "100%",
    minWidth: `${column_widths[column_key]}px`,
    whiteSpace: "normal",
    wordBreak: "keep-all",
    overflowWrap: "break-word",
  });

  const get_cell_background = (column_key, row_index) => {
    const tint = columnTints && columnTints[column_key];
    if (tint && TINT_CELL_COLORS[tint]) return TINT_CELL_COLORS[tint];
    return row_index % 2 === 1 ? "#F7F9FB" : "#FFFFFF";
  };

  const page_window = build_page_window(page, totalPages, PAGE_WINDOW_SIZE);
  const page_numbers = [];
  for (let number = page_window.start; number <= page_window.end; number += 1) page_numbers.push(number);

  // width:100% lets table-layout:fixed scale every column up proportionally
  // to actually fill the container when there are only a few of them - a
  // bare content-sized table would otherwise sit flush at its natural
  // width, leaving the rest of the container empty. minWidth is a floor,
  // not a cap: once the real sum of column widths exceeds the container,
  // 100% no longer reaches it, the floor takes over instead, and the table
  // overflows into a horizontal scroll exactly as before - no column ever
  // shrinks below what compute_column_width decided it needs.
  const total_columns_width = columns.reduce((sum, column) => sum + (column_widths[column.key] || 0), 0);

  return (
    <div className="w-full h-full flex flex-col">
      <div ref={scroll_container_ref} className="flex-1 min-h-0 bg-white border-2 overflow-auto" style={{ borderColor: "#E0E0E0" }}>
        <table className="text-sm" style={{ borderCollapse: "collapse", tableLayout: "fixed", width: "100%", minWidth: `${total_columns_width}px` }}>
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
                    position: "sticky",
                    top: 0,
                    zIndex: 2,
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
            {loading &&
              Array.from({ length: SKELETON_ROW_COUNT }).map((_, row_index) => (
                <tr key={`skeleton-${row_index}`} aria-hidden="true">
                  {columns.map((column, column_index) => (
                    <td
                      key={column.key}
                      className="px-3 py-2.5"
                      style={{
                        borderBottom: "1px solid #E0E0E0",
                        borderRight: column_index < columns.length - 1 ? "1px solid #E0E0E0" : "none",
                      }}
                    >
                      <div className="animate-pulse h-3.5" style={{ width: "70%", backgroundColor: "rgba(5,109,170,0.1)" }} />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading &&
              has_rows &&
              rows.map((row, row_index) => (
                <tr
                  key={row.dcs_row_key}
                  // A click anywhere on the row opens its details, except on a
                  // control the row itself carries (file links, delete button).
                  onClick={onRowClick ? (event) => (event.target.closest("a,button") ? undefined : onRowClick(row)) : undefined}
                  style={onRowClick ? { cursor: "pointer" } : undefined}
                >
                  {columns.map((column, column_index) => (
                    <td
                      key={column.key}
                      className="px-3 py-2.5 align-top"
                      style={{
                        color: "#333333",
                        backgroundColor: get_cell_background(column.key, row_index),
                        borderBottom: "1px solid #E0E0E0",
                        borderRight: column_index < columns.length - 1 ? "1px solid #E0E0E0" : "none",
                        // Only a column explicitly declaring its own width
                        // (minWidthPx - content compute_column_width's plain
                        // text measurement can't size, e.g. a nested table)
                        // gets a scroll boundary here; an ordinary text
                        // column is already sized to fit its own content
                        // exactly and would otherwise risk showing a
                        // needless scrollbar from nothing more than
                        // sub-pixel layout rounding. table-layout:fixed pins
                        // this cell to its column's exact pixel width either
                        // way, but a table cell never clips its own content
                        // by default - without this, content wider than the
                        // cell (its own padding included) visually bleeds
                        // into the next column instead of staying inside
                        // its own boundary.
                        overflowX: column.minWidthPx ? "auto" : "visible",
                      }}
                    >
                      <div style={get_cell_content_style(column.key)}>{row[column.key]}</div>
                    </td>
                  ))}
                </tr>
              ))}
            {!loading && !has_rows && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
                  {translate("DCS_TABLE_NO_DATA")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend, pagination and the total count all share this single
          compact band instead of each getting their own - a 3-column grid
          keeps pagination centered and the total pinned right regardless
          of whether a legend is even present (an empty first column, when
          there's no diff to explain, doesn't shift the other two). Sized
          in rem rather than a fixed px height so it scales down smoothly
          on a small screen instead of clipping its own content. */}
      <div className="grid grid-cols-3 items-center flex-shrink-0 overflow-x-auto" style={{ height: "3.5rem", minHeight: 52 }}>
        <div className="flex flex-wrap items-center gap-2">
          {legendItems &&
            legendItems.map((item) => (
              <span key={item.labelKey} className="flex items-center gap-1" style={{ color: "#555555", fontFamily: "'Montserrat', sans-serif", fontSize: 11 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: item.color, flexShrink: 0 }} />
                {translate(item.labelKey)}
              </span>
            ))}
        </div>

        <div className="flex items-center justify-center gap-1.5 flex-shrink-0">
          <PageArrowButton direction="prev" disabled={page <= 1} onClick={() => onPageChange(page - 1)} />
          {page_numbers.map((number) => (
            <PageNumberButton key={number} number={number} isActive={number === page} onClick={() => onPageChange(number)} />
          ))}
          {page_window.end < totalPages && (
            <span className="px-1" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif", fontSize: 13 }}>
              …
            </span>
          )}
          <PageArrowButton direction="next" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} />
        </div>

        <div className="flex items-center justify-end">
          <span className="text-sm font-semibold" style={{ color: "#056daa", fontFamily: "'Montserrat', sans-serif" }}>
            {totalCount}
          </span>
        </div>
      </div>
    </div>
  );
}
