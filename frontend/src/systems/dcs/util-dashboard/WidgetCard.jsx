import React, { useEffect, useRef, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";
import WidgetChart from "./WidgetChart.jsx";
import { chart_definition } from "./chartCatalog.js";

const PRIMARY = "#056daa";
const DANGER = "#E74C3C";

function StateMessage({ children, tone }) {
  return (
    <div className="flex items-center justify-center text-center text-xs px-4" style={{ height: 180, color: tone || "#9E9E9E" }}>
      {children}
    </div>
  );
}

/**
 * One inline click-to-edit text line: clicking the text swaps it for an
 * input with explicit SAVE (check) and CANCEL (cross) icon buttons; Enter
 * saves and Escape cancels too. The buttons prevent the input's blur on
 * mousedown so a click on Cancel can never be swallowed by a blur-save.
 */
function EditableText({ value, placeholder, editable, saving, onCommit, textStyle, maxLength, hint }) {
  const { translate } = useDcsLanguage();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const start = () => {
    if (!editable || saving) return;
    setDraft(value || "");
    setEditing(true);
  };
  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next !== (value || "")) onCommit(next);
  };
  const cancel = () => setEditing(false);

  const edit_action_style = (color) => ({
    width: 26,
    height: 26,
    border: `1px solid ${color}`,
    color,
    backgroundColor: "#FFFFFF",
    cursor: "pointer",
    flexShrink: 0,
  });

  if (editing) {
    return (
      <span className="flex items-center gap-1 w-full">
        <input
          autoFocus
          className="min-w-0 flex-1 text-sm px-1 py-0.5"
          style={{ border: `1px solid ${PRIMARY}`, outline: "none", fontFamily: "'Montserrat', sans-serif" }}
          value={draft}
          maxLength={maxLength}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
            if (event.key === "Escape") cancel();
          }}
        />
        <button
          type="button"
          title={translate("DCS_BTN_SAVE")}
          aria-label={translate("DCS_BTN_SAVE")}
          className="flex items-center justify-center"
          style={edit_action_style("#4CAF50")}
          onMouseDown={(event) => event.preventDefault()}
          onClick={commit}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="4 12.5 10 18.5 20 6" />
          </svg>
        </button>
        <button
          type="button"
          title={translate("DCS_BTN_CANCEL")}
          aria-label={translate("DCS_BTN_CANCEL")}
          className="flex items-center justify-center"
          style={edit_action_style(DANGER)}
          onMouseDown={(event) => event.preventDefault()}
          onClick={cancel}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </span>
    );
  }
  return (
    <p
      className="truncate"
      style={{ ...textStyle, cursor: editable ? "pointer" : "default" }}
      title={editable ? hint : value || placeholder}
      onClick={start}
    >
      {value || placeholder}
    </p>
  );
}

// Any category chart can be redrawn as bars or columns on the spot -
// single-series ones become plain bar/column, split ones (stacked, grouped,
// 100 percent) become their horizontal or vertical counterpart.
const TO_BAR = {
  column: "bar",
  lollipop: "bar",
  dot_plot: "bar",
  pie: "bar",
  donut: "bar",
  waffle: "bar",
  grouped_column: "grouped_bar",
  stacked_column: "stacked_bar",
  stacked_100: "stacked_bar_100",
};
const TO_COLUMN = {
  bar: "column",
  lollipop: "column",
  dot_plot: "column",
  pie: "column",
  donut: "column",
  waffle: "column",
  grouped_bar: "grouped_column",
  stacked_bar: "stacked_column",
  stacked_bar_100: "stacked_100",
};

/**
 * The three-dots menu at each card's top right: turn any category chart -
 * stacked or not - into its bar or column form, and remove the widget.
 * Closes on outside click.
 */
function CardMenu({ widget, onChangeType, onRemove }) {
  const { translate } = useDcsLanguage();
  const [open, setOpen] = useState(false);
  const menu_ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handle_outside = (event) => {
      if (menu_ref.current && !menu_ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handle_outside);
    return () => document.removeEventListener("mousedown", handle_outside);
  }, [open]);

  const item_style = (danger) => ({
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "0.5rem 0.75rem",
    fontSize: 12,
    fontFamily: "'Montserrat', sans-serif",
    color: danger ? DANGER : "#333333",
    background: "none",
    border: "none",
    cursor: "pointer",
    whiteSpace: "nowrap",
  });

  const pick = (action) => {
    setOpen(false);
    action();
  };

  return (
    <div ref={menu_ref} className="relative flex-shrink-0">
      <button
        type="button"
        title={translate("DCS_DB_MENU")}
        aria-label={translate("DCS_DB_MENU")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center"
        style={{ width: 26, height: 26, border: "1px solid #E0E0E0", color: "#555555", backgroundColor: open ? "#F0F7FB" : "#FFFFFF", cursor: "pointer" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 bg-white border-2 shadow-lg" style={{ top: "100%", marginTop: 4, borderColor: "#E0E0E0", minWidth: 170 }}>
          {onChangeType && TO_BAR[widget.chart_type] && (
            <button type="button" role="menuitem" className="dcs-db-menu-item" style={item_style(false)} onClick={() => pick(() => onChangeType(TO_BAR[widget.chart_type]))}>
              {translate("DCS_DB_TO_BAR")}
            </button>
          )}
          {onChangeType && TO_COLUMN[widget.chart_type] && (
            <button type="button" role="menuitem" className="dcs-db-menu-item" style={item_style(false)} onClick={() => pick(() => onChangeType(TO_COLUMN[widget.chart_type]))}>
              {translate("DCS_DB_TO_COLUMN")}
            </button>
          )}
          {onRemove && (
            <button type="button" role="menuitem" className="dcs-db-menu-item" style={item_style(true)} onClick={() => pick(onRemove)}>
              {translate("DCS_DB_REMOVE_WIDGET")}
            </button>
          )}
          <style>{`.dcs-db-menu-item:hover { background-color: #F0F7FB !important; }`}</style>
        </div>
      )}
    </div>
  );
}

/**
 * The grand total behind one widget's data - the sum across ALL its rows,
 * series, points or tree nodes. Only meaningful for additive measures
 * (count/sum); averages and extremes show no total.
 */
function widget_total(widget, data) {
  if (!data || data.locked || data.error || data.kind === "kpi") return null;
  const aggregation = (widget.metric && widget.metric.aggregation) || "count";
  if (aggregation !== "count" && aggregation !== "sum") return null;
  if (Array.isArray(data.points)) return data.points.length;
  if (Array.isArray(data.nodes)) return data.nodes.reduce((sum, node) => sum + (node.value || 0), 0);
  if (!Array.isArray(data.rows)) return null;
  if (data.series && data.series.length > 0) {
    return data.rows.reduce((sum, row) => sum + data.series.reduce((inner, key) => inner + (row[key] || 0), 0), 0);
  }
  return data.rows.reduce((sum, row) => sum + (row.value || 0), 0);
}

/**
 * The frame of every dashboard widget: a title bar (title and description
 * are click-to-edit for users allowed to edit the form, with a spinner
 * while the change saves, the widget's grand total, and a three-dots menu
 * on the top right) and the loading / error states around the chart itself.
 */
export default function WidgetCard({ widget, data, loading, onRetry, fitMode, editable, savingText, onUpdateText, onRemove, onChangeType }) {
  const { translate } = useDcsLanguage();
  const definition = chart_definition(widget.chart_type);
  const type_label = definition ? translate(definition.labelKey) : widget.chart_type;
  const total = widget_total(widget, data);

  return (
    <div className="bg-white border-2 flex flex-col h-full" style={{ borderColor: "#E0E0E0" }}>
      <div className="px-3 pt-3 pb-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <EditableText
            value={widget.title}
            placeholder={type_label}
            editable={editable}
            saving={savingText}
            hint={translate("DCS_DB_CLICK_TO_EDIT")}
            maxLength={120}
            textStyle={{ color: "#333333", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 14 }}
            onCommit={(next) => {
              // A widget must keep a title - an emptied one falls back.
              if (next) onUpdateText({ title: next });
            }}
          />
          <EditableText
            value={widget.description || ""}
            placeholder={type_label}
            editable={editable}
            saving={savingText}
            hint={translate("DCS_DB_CLICK_TO_EDIT")}
            maxLength={300}
            textStyle={{ color: "#9E9E9E", fontSize: 12 }}
            onCommit={(next) => onUpdateText({ description: next || null })}
          />
        </div>
        {total !== null && (
          <span
            className="flex-shrink-0 text-xs font-semibold px-2 py-0.5"
            style={{ color: PRIMARY, backgroundColor: "#F0F7FB", border: `1px solid ${PRIMARY}`, fontFamily: "'Montserrat', sans-serif" }}
            title={translate("DCS_DB_TOTAL")}
          >
            {translate("DCS_DB_TOTAL")}: {total.toLocaleString("en-US")}
          </span>
        )}
        {savingText && <span className="dcs-inline-spinner flex-shrink-0 mt-1" style={{ color: PRIMARY }} />}
        {editable && !savingText && (onRemove || onChangeType) && (
          <CardMenu widget={widget} onChangeType={onChangeType} onRemove={onRemove} />
        )}
      </div>

      <div className="px-2 pb-3 flex-1">
        {loading ? (
          <div className="flex items-center justify-center" style={{ height: 180 }}>
            <SpiralLoader />
          </div>
        ) : !data ? (
          <StateMessage>{translate("DCS_DB_NO_DATA")}</StateMessage>
        ) : data.locked ? (
          <StateMessage>{translate("DCS_DB_LOCKED")}</StateMessage>
        ) : data.error ? (
          <div className="flex flex-col items-center justify-center gap-2" style={{ height: 180 }}>
            <p className="text-xs text-center px-4" style={{ color: DANGER }}>
              {translate("DCS_DB_WIDGET_ERROR")}
            </p>
            {onRetry && (
              <button
                type="button"
                className="text-xs font-semibold uppercase px-2 py-1"
                style={{ color: PRIMARY, border: `1px solid ${PRIMARY}`, fontFamily: "'Montserrat', sans-serif", cursor: "pointer", background: "#FFFFFF" }}
                onClick={onRetry}
              >
                {translate("DCS_DB_RETRY")}
              </button>
            )}
          </div>
        ) : (
          <WidgetChart widget={widget} data={data} fitMode={fitMode} />
        )}
      </div>
    </div>
  );
}
