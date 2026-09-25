import React from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { render_answer_cell } from "../../fields/dataColumns.jsx";
import { build_palette, with_alpha } from "../appearance.js";
import { chart_density } from "./density.js";

/**
 * A TABLE widget, drawn from the data the server computed for it.
 *
 * RECORDS: the submissions themselves, the chosen fields as columns, a
 * page at a time. The foot of the card carries the page count, Previous
 * and Next, and how many rows a page holds - ten to a hundred, which the
 * viewer may change for themselves without touching the widget. Paging
 * asks the board for that one card again (onPage), nothing else moves.
 *
 * SUMMARY: one row per value of the group field, a column per measure or
 * per split value, and the totals the author asked for - the total row
 * across the bottom, the total column down the side. Numbers are written
 * in the widget's own unit. A click on a row (or a cell of a split table)
 * opens the records behind it, like a bar of a chart.
 *
 * The first column and the header stay put while the rest scrolls, and
 * the whole thing is painted from the widget's palette so a table on a
 * dark section reads white on blue without any more saying so.
 */

const PAGE_SIZES = [10, 25, 50, 100];

/** The column label in the reader's language, falling back across the three. */
export function pick_label(label, language) {
  if (!label) return "";
  if (typeof label === "string") return label;
  return label[language] || label.en || label.kn || label.fr || "";
}

const format_when = (value, language) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(language === "fr" ? "fr-FR" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
};

function Frame({ palette, density, children, footer }) {
  return (
    <div className="dcs-widget-table-wrap" style={{ maxHeight: density.max_height }}>
      <div className="dcs-widget-table-scroll">
        {/* The header and the total row are a light tint of the widget's
            own text colour laid over its own surface, so they read on a
            dark card as well as on a white one - the theme's grey would
            vanish under white text. */}
        <table className="dcs-widget-table" style={{ fontSize: density.font + 1, color: palette.text, "--table-border": palette.border, "--table-head": with_alpha(palette.text, 0.14), "--table-surface": palette.background_solid }}>
          {children}
        </table>
      </div>
      {footer}
    </div>
  );
}

function RecordsTable({ widget, data, palette, density, onPage }) {
  const { translate, language } = useDcsLanguage();
  const show_when = data.show_submitted_at !== false;
  const columns = data.columns || [];
  const total = Number(data.total) || 0;
  const pages = Math.max(1, Number(data.pages) || 1);
  const page = Math.min(pages, Math.max(1, Number(data.page) || 1));
  const page_size = Number(data.page_size) || 10;
  const sizes = PAGE_SIZES.includes(page_size) ? PAGE_SIZES : PAGE_SIZES.concat([page_size]).sort((a, b) => a - b);
  const control = { border: `1px solid ${palette.border}`, color: palette.text, backgroundColor: palette.background_solid, fontFamily: "'Montserrat', sans-serif", fontSize: 11 };
  const footer = (
    <div className="dcs-widget-table-foot dcs-no-drill" style={{ color: palette.muted }}>
      <span>{translate("DCS_DB_TABLE_RECORDS_COUNT", { count: total.toLocaleString("en-US") })}</span>
      <span className="dcs-widget-table-pager">
        {onPage && (
          <label className="flex items-center gap-1">
            <span>{translate("DCS_DB_TABLE_ROWS_PER_PAGE")}</span>
            <select className="dcs-widget-table-control" style={control} value={page_size} onChange={(event) => onPage(1, Number(event.target.value))}>
              {sizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}
        <span>{translate("DCS_DB_TABLE_PAGE_OF", { page, pages })}</span>
        {onPage && (
          <>
            <button type="button" className="dcs-widget-table-control" style={{ ...control, cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.45 : 1 }} disabled={page <= 1} onClick={() => onPage(page - 1, page_size)}>
              {translate("DCS_DB_TABLE_PREV")}
            </button>
            <button type="button" className="dcs-widget-table-control" style={{ ...control, cursor: page >= pages ? "default" : "pointer", opacity: page >= pages ? 0.45 : 1 }} disabled={page >= pages} onClick={() => onPage(page + 1, page_size)}>
              {translate("DCS_DB_TABLE_NEXT")}
            </button>
          </>
        )}
      </span>
    </div>
  );
  return (
    <Frame palette={palette} density={density} footer={footer}>
      <thead>
        <tr>
          {show_when && <th className="is-first">{translate("DCS_TABLE_SUBMITTED_AT")}</th>}
          {columns.map((column, index) => (
            <th key={column.id} className={!show_when && index === 0 ? "is-first" : undefined}>
              {pick_label(column.label, language) || column.id}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(data.items || []).length === 0 ? (
          <tr>
            <td colSpan={columns.length + (show_when ? 1 : 0)} className="is-empty" style={{ color: palette.muted }}>
              {translate("DCS_DB_TABLE_EMPTY")}
            </td>
          </tr>
        ) : (
          (data.items || []).map((item) => (
            <tr key={String(item._id)}>
              {show_when && <td className="is-first">{format_when(item.submitted_at, language)}</td>}
              {columns.map((column, index) => (
                <td key={column.id} className={!show_when && index === 0 ? "is-first" : undefined}>
                  {render_answer_cell({ type: column.type }, item.data ? item.data[column.id] : undefined)}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </Frame>
  );
}

function SummaryTable({ data, palette, density, onPick }) {
  const { translate, language } = useDcsLanguage();
  const columns = data.columns || [];
  const totals = data.table_totals || {};
  const total_column = !!totals.column;
  const total_row = totals.row || null;
  const number = (value) => (value === null || value === undefined ? "-" : palette.number_text(Number(value)));
  const name = (label) => (palette.name_for ? palette.name_for(label) : label);
  // A row opens its records; a cell does too, but only in a split table,
  // where the column IS a value the records can be narrowed to - a measure
  // column has its own formula and filters, which a click cannot carry.
  const pick_row = onPick ? (row) => onPick({ kind: "category", label: row.label }) : undefined;
  const pick_cell = onPick ? (row, column) => (column.split_value === undefined ? undefined : onPick({ kind: "category", label: row.label, series: column.split_value })) : undefined;
  const clickable = onPick ? { cursor: "pointer" } : undefined;
  const cell_style = (column) => (onPick && column.split_value !== undefined ? clickable : undefined);
  const column_name = (column) => (column.key === "__other__" ? translate("DCS_DB_OTHER") : column.split_value !== undefined ? name(column.label) : column.label || column.key);
  return (
    <Frame palette={palette} density={density}>
      <thead>
        <tr>
          <th className="is-first">{pick_label(data.group_field && data.group_field.label, language)}</th>
          {columns.map((column) => (
            <th key={column.key}>{column_name(column)}</th>
          ))}
          {total_column && <th className="is-total">{translate("DCS_DB_TABLE_TOTAL")}</th>}
        </tr>
      </thead>
      <tbody>
        {(data.rows || []).length === 0 ? (
          <tr>
            <td colSpan={columns.length + 1 + (total_column ? 1 : 0)} className="is-empty" style={{ color: palette.muted }}>
              {translate("DCS_DB_NO_DATA")}
            </td>
          </tr>
        ) : (
          (data.rows || []).map((row) => (
            <tr key={row.label}>
              <td className="is-first" style={clickable} onClick={pick_row ? () => pick_row(row) : undefined}>
                {name(row.label)}
              </td>
              {columns.map((column) => (
                <td key={column.key} className="is-number" style={{ ...cell_style(column), color: palette.number }} onClick={pick_cell && column.split_value !== undefined ? () => pick_cell(row, column) : undefined}>
                  {number(row.cells ? row.cells[column.key] : null)}
                </td>
              ))}
              {total_column && (
                <td className="is-number is-total" style={{ color: palette.number }}>
                  {number(row.total)}
                </td>
              )}
            </tr>
          ))
        )}
        {totals.capped && (
          <tr>
            <td colSpan={columns.length + 1 + (total_column ? 1 : 0)} className="is-empty" style={{ color: palette.muted }}>
              {translate("DCS_DB_TABLE_CAPPED")}
            </td>
          </tr>
        )}
        {total_row && (data.rows || []).length > 0 && (
          <tr className="is-total-row">
            <td className="is-first">{translate("DCS_DB_TABLE_TOTAL")}</td>
            {columns.map((column) => (
              <td key={column.key} className="is-number" style={{ color: palette.number }}>
                {number(total_row.cells ? total_row.cells[column.key] : null)}
              </td>
            ))}
            {total_column && (
              <td className="is-number is-total" style={{ color: palette.number }}>
                {number(total_row.total)}
              </td>
            )}
          </tr>
        )}
      </tbody>
    </Frame>
  );
}

export default function TableWidget({ widget, data, palette, density, onPage, onPick }) {
  const colors = palette || build_palette(widget && widget.appearance);
  const size = density || chart_density();
  if (!data) return null;
  if (data.mode === "summary") return <SummaryTable data={data} palette={colors} density={size} onPick={onPick} />;
  return <RecordsTable widget={widget} data={data} palette={colors} density={size} onPage={onPage} />;
}
