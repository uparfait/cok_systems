import React, { useEffect, useMemo, useRef } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

const MAX_COLUMN_WIDTH_PX = 400;
const MIN_COLUMN_WIDTH_PX = 72;
const CELL_HORIZONTAL_PADDING_PX = 20;
const HEADER_FONT = "700 10.5px 'Montserrat', sans-serif";
const DATA_FONT = "400 12px 'Montserrat', sans-serif";
const SKELETON_ROW_COUNT = 8;
const PAGE_WINDOW_SIZE = 10;

const TINT_CLASSES = ["green", "red", "blue"];

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
 *
 * pinnedColumnKey keeps one column (in practice the first, holding each
 * row's own controls) in place while the rest of the table scrolls
 * sideways underneath it. A column may also carry headerNode - anything
 * the header should render instead of plain text, such as that column's
 * own value filter - while label/labelKey still supplies the text the
 * width measurement reads, since a React element has no measurable width.
 */
export default function DcsDataTable({ columns, rows, page, totalPages, onPageChange, loading, columnTints, legendItems, scrollResetKey, totalCount, onRowClick, pinnedColumnKey, footerSlot }) {
  const { translate } = useDcsLanguage();
  const has_rows = rows && rows.length > 0;
  const scroll_container_ref = useRef(null);

  useEffect(() => {
    if (scroll_container_ref.current) scroll_container_ref.current.scrollTop = 0;
  }, [scrollResetKey]);

  const header_text_of = (column) => (column.label !== undefined ? column.label : translate(column.labelKey));

  /**
   * Every column gets the width its own content needs (header or widest
   * value, within MIN and MAX). When those widths add up to less than the
   * room available, the table stretches to fill it and the extra is shared
   * in proportion; when they add up to more, the table keeps every column
   * at its width and scrolls sideways instead of squeezing columns into
   * slivers. A column that declares its own pixel width (row controls, a
   * map) always keeps exactly that.
   */
  const column_layout = useMemo(() => {
    const widths = {};
    let total = 0;
    columns.forEach((column) => {
      const width = column.minWidthPx ? column.minWidthPx : compute_column_width(header_text_of(column), rows, column.key);
      widths[column.key] = { width: `${width}px` };
      total += width;
    });
    return { widths, total };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, rows]);

  // The text of a cell, for the tooltip that carries what the clamp cut off.
  const cell_title = (value) => (typeof value === "string" || typeof value === "number" ? String(value) : undefined);

  // A column the version diff has marked carries its tint as a class, so
  // it sits over the row striping and the hover rather than replacing
  // the background outright the way an inline colour had to.
  const tint_class = (column_key) => {
    const tint = columnTints && columnTints[column_key];
    return tint && TINT_CLASSES.includes(tint) ? `dcs-tint-${tint}` : "";
  };

  // Nothing scrolls under it any more, so a pinned column is simply the
  // first one; the class is kept so callers need not change.
  const pinned_class = (column_key, extra) => (column_key === pinnedColumnKey ? `dcs-dt-pinned ${extra || ""}` : "");

  const page_window = build_page_window(page, totalPages, PAGE_WINDOW_SIZE);
  const page_numbers = [];
  for (let number = page_window.start; number <= page_window.end; number += 1) page_numbers.push(number);

  return (
    <div className="w-full h-full flex flex-col">
      {/* Scrolls down, and sideways only once the columns' own widths no
          longer fit (see column_layout). The type is set a step smaller
          than the rest of the app so a wide form still reads at a glance,
          and every cell is clamped to three lines - a row is never taller
          than 80px, the rest of a long answer is on the cell's tooltip and
          in the record view a click opens. */}
      <div
        ref={scroll_container_ref}
        className="dcs-dt-scroll flex-1 min-h-0 bg-white border-2 overflow-y-auto overflow-x-auto"
        style={{ borderColor: "#E0E0E0" }}
      >
        <table className="dcs-fancy-table" style={{ minWidth: column_layout.total }}>
          <colgroup>
            {columns.map((column) => (
              <col key={column.key} style={column_layout.widths[column.key]} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {columns.map((column) => {
                const header_text = header_text_of(column);
                return (
                  <th
                    key={column.key}
                    className={pinned_class(column.key)}
                    scope="col"
                    title={typeof header_text === "string" ? header_text : undefined}
                  >
                    {/* The filter sits UNDER the column's name rather
                        than beside it: side by side, a name and a list
                        of picked values fought over the same few
                        characters of width. The name itself is trimmed
                        after two lines (.dcs-th-label) so one long one
                        cannot stretch the whole header band down. */}
                    <div className="flex flex-col items-start gap-1" style={{ width: "100%", minWidth: 0 }}>
                      <span className="dcs-th-label">{header_text}</span>
                      {column.headerNode}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: SKELETON_ROW_COUNT }).map((_, row_index) => (
                <tr key={`skeleton-${row_index}`} aria-hidden="true">
                  {columns.map((column) => (
                    <td key={column.key} className={pinned_class(column.key)}>
                      <div className="animate-pulse h-3.5" style={{ width: "70%", backgroundColor: "rgba(5,109,170,0.1)" }} />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading &&
              has_rows &&
              rows.map((row) => (
                <tr
                  key={row.dcs_row_key}
                  // A click anywhere on the row opens its details, except on a
                  // control the row itself carries (file links, row buttons).
                  className={onRowClick ? "is-clickable" : undefined}
                  onClick={onRowClick ? (event) => (event.target.closest("a,button") ? undefined : onRowClick(row)) : undefined}
                >
                  {columns.map((column) => (
                    <td key={column.key} className={`${tint_class(column.key)} ${pinned_class(column.key)}`.trim() || undefined} title={cell_title(row[column.key])}>
                      <div className="dcs-cell-clamp">{row[column.key]}</div>
                    </td>
                  ))}
                </tr>
              ))}
            {!loading && !has_rows && (
              <tr>
                <td colSpan={columns.length} className="text-center" style={{ padding: "2.5rem 0.5rem", color: "#9E9E9E" }}>
                  {translate("DCS_TABLE_NO_DATA")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend, pagination and the total count all share this single
          compact band instead of each getting their own. On a phone they
          stack and the whole band scrolls sideways rather than clipping;
          from small tablets up it is a 3-column grid that keeps pagination
          centered and the total pinned right regardless of whether a
          legend is even present. Sized in rem rather than a fixed px
          height so it scales down smoothly instead of clipping content. */}
      <div className="flex-shrink-0 flex flex-col gap-1 sm:grid sm:grid-cols-3 sm:items-center py-2 sm:py-0 overflow-x-auto" style={{ minHeight: 52 }}>
        <div className="flex flex-wrap items-center gap-2">
          {legendItems &&
            legendItems.map((item) => (
              <span key={item.labelKey || item.label} className="flex items-center gap-1" style={{ color: "#555555", fontFamily: "'Montserrat', sans-serif", fontSize: 11 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: item.color, flexShrink: 0 }} />
                {item.label !== undefined ? item.label : translate(item.labelKey)}
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

        <div className="flex items-center justify-end gap-3">
          {footerSlot}
          <span className="text-sm font-semibold" style={{ color: "#056daa", fontFamily: "'Montserrat', sans-serif" }}>
            {totalCount}
          </span>
        </div>
      </div>
    </div>
  );
}
