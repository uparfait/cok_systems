import React, { useEffect, useRef, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";
import WidgetChart from "./WidgetChart.jsx";
import LibraryIcon from "./icons/LibraryIcon.jsx";
import { chart_definition, convertible_types } from "./chartCatalog.js";
import { build_palette } from "./appearance.js";
import { useBoardTheme } from "./boardTheme.jsx";

const PRIMARY = "#056daa";
const DANGER = "#E74C3C";
const ORANGE = "#E67E22";
// The widths a chart can take on the board (KPI cards keep their own dense grid).
const SIZE_OPTIONS = [
  { id: "small", labelKey: "DCS_DB_SIZE_SMALL" },
  { id: "medium", labelKey: "DCS_DB_SIZE_MEDIUM" },
  { id: "large", labelKey: "DCS_DB_SIZE_LARGE" },
];
const SURFACE = "var(--board-surface, #FFFFFF)";
const SURFACE_BORDER = "var(--board-border, #E0E0E0)";
const SURFACE_TEXT = "var(--board-text, #333333)";

/**
 * The live inner width of the card's chart area. Charts size everything
 * they draw from it (see charts/density.js), so a widget set to "small"
 * really draws a small chart instead of stretching its card open.
 */
function useCardWidth(element_ref) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = element_ref.current;
    if (!element) return undefined;
    const measure = () => setWidth(element.clientWidth);
    measure();
    if (typeof window.ResizeObserver !== "function") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new window.ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element_ref]);
  return width;
}

function StateMessage({ children, tone, height }) {
  return (
    <div className="flex items-center justify-center text-center text-xs px-4" style={{ height: height || 180, color: tone || "#9E9E9E" }}>
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
function EditableText({ value, placeholder, editable, saving, onCommit, textStyle, maxLength, hint, wrap }) {
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
    backgroundColor: SURFACE,
    cursor: "pointer",
    flexShrink: 0,
  });

  if (editing) {
    return (
      <span className="flex items-center gap-1 w-full">
        <input
          autoFocus
          className="min-w-0 flex-1 text-sm px-1 py-0.5"
          style={{ border: `1px solid ${PRIMARY}`, outline: "none", fontFamily: "'Montserrat', sans-serif", backgroundColor: SURFACE, color: SURFACE_TEXT }}
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
      className={wrap ? "" : "truncate"}
      style={{ ...textStyle, cursor: editable ? "pointer" : "default" }}
      title={editable ? hint : value || placeholder}
      onClick={start}
    >
      {value || placeholder}
    </p>
  );
}

/**
 * The three-dots menu at each card's top right: flip the widget into ANY
 * compatible look (single-series category charts reach every bar, column,
 * lollipop, dot, slice, waffle, treemap, line and area form; split ones
 * reach every grouped/clustered, stacked, 100 percent, heatmap and
 * multi-series line form - see convertible_types), and remove the widget.
 * Closes on outside click.
 */
function CardMenu({ widget, onChangeType, onChangeSize, onRemove, onAppearance, onPickIcon }) {
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
    color: danger ? DANGER : SURFACE_TEXT,
    background: "none",
    border: "none",
    cursor: "pointer",
    whiteSpace: "nowrap",
  });
  const section_title = (key) => (
    <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase" style={{ color: "var(--board-muted, #9E9E9E)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.4px", margin: 0 }}>
      {translate(key)}
    </p>
  );

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
        style={{ width: 26, height: 26, border: `1px solid ${SURFACE_BORDER}`, color: "var(--board-muted, #555555)", backgroundColor: open ? "var(--board-surface-hover, #F0F7FB)" : SURFACE, cursor: "pointer" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 border-2 shadow-lg" style={{ top: "100%", marginTop: 4, backgroundColor: SURFACE, borderColor: SURFACE_BORDER, minWidth: 190 }}>
          {onChangeSize && (
            <>
              {section_title("DCS_DB_SIZE")}
              <div className="flex gap-1 px-3 pb-2">
                {SIZE_OPTIONS.map((option) => {
                  const current = (widget.size || "medium") === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={current}
                      className="dcs-db-menu-item flex-1 text-xs font-semibold py-1 px-2"
                      style={{ border: `1px solid ${current ? PRIMARY : SURFACE_BORDER}`, color: current ? "#FFFFFF" : PRIMARY, backgroundColor: current ? PRIMARY : "transparent", cursor: current ? "default" : "pointer", fontFamily: "'Montserrat', sans-serif" }}
                      onClick={() => !current && pick(() => onChangeSize(option.id))}
                    >
                      {translate(option.labelKey)}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {onChangeType && convertible_types(widget).filter((type) => type !== widget.chart_type).length > 0 && (
            <>
              {section_title("DCS_DB_TURN_INTO")}
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                {convertible_types(widget)
                  .filter((type) => type !== widget.chart_type)
                  .map((type) => {
                    const definition = chart_definition(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        role="menuitem"
                        className="dcs-db-menu-item"
                        style={item_style(false)}
                        onClick={() => pick(() => onChangeType(type))}
                      >
                        {definition ? translate(definition.labelKey) : type}
                      </button>
                    );
                  })}
              </div>
            </>
          )}
          {onPickIcon && (
            <button type="button" role="menuitem" className="dcs-db-menu-item" style={{ ...item_style(false), borderTop: "1px solid #E0E0E0", color: PRIMARY, fontWeight: 600 }} onClick={() => pick(onPickIcon)}>
              {translate(widget.icon ? "DCS_DB_ICON_CHANGE" : "DCS_DB_ICON_SET")}
            </button>
          )}
          {onAppearance && (
            <button type="button" role="menuitem" className="dcs-db-menu-item" style={{ ...item_style(false), borderTop: onPickIcon ? "none" : "1px solid #E0E0E0", color: PRIMARY, fontWeight: 600 }} onClick={() => pick(onAppearance)}>
              {translate("DCS_DB_COLOR_SETTINGS")}
            </button>
          )}
          {onRemove && (
            <button type="button" role="menuitem" className="dcs-db-menu-item" style={item_style(true)} onClick={() => pick(onRemove)}>
              {translate("DCS_DB_REMOVE_WIDGET")}
            </button>
          )}
          <style>{`.dcs-db-menu-item:hover { background-color: var(--board-surface-hover, #F0F7FB) !important; }`}</style>
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
 * A KPI card's icon slot, left of its title: the chosen icon, or -
 * for editors only - a dashed placeholder inviting one. Clicking it (like
 * clicking the card's number) opens the icon picker.
 */
function KpiIconSlot({ icon, color }) {
  if (!icon) return null;
  return (
    <span className="flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40 }}>
      <LibraryIcon icon={icon} size={34} color={color} />
    </span>
  );
}

/**
 * The frame of every dashboard widget: a title bar (title and description
 * are click-to-edit for users allowed to edit the form, with a spinner
 * while the change saves, the widget's grand total, and a three-dots menu
 * on the top right) and the loading / error states around the chart itself.
 * A KPI card also carries an optional icon; editors click the card's number
 * area (or the icon slot) to set or change it.
 */
export default function WidgetCard({ widget, data, loading, onRetry, fitMode, editable, savingText, onUpdateText, onRemove, onChangeType, onChangeSize, onShowSkipped, onPickIcon, onAppearance, selectable, selected, onSelect }) {
  const { translate } = useDcsLanguage();
  const board = useBoardTheme();
  const definition = chart_definition(widget.chart_type);
  // The card paints itself from the widget's own appearance (light or dark
  // mode with its background, text and number colors) - unless the viewer
  // switched the whole board to dark mode, which paints every card dark.
  const palette = build_palette(widget.appearance, board.theme);
  const type_label = definition ? translate(definition.labelKey) : widget.chart_type;
  const total = widget_total(widget, data);
  // A failed or timed-out widget is marked in red - it likely causes errors
  // or heavy computation and is a removal candidate.
  const failed = !!(data && data.error);
  // A KPI whose numeric formula had to SKIP answers it could not read as
  // numbers is marked orange; clicking the note lists every skipped entry.
  const skipped_count = !failed && data && data.kind === "kpi" ? Number(data.skipped) || 0 : 0;
  // KPI cards are deliberately COMPACT: small paddings and short state
  // areas, so a row of them stays low - only a description adds height.
  const is_kpi = widget.chart_type === "kpi";
  const state_height = is_kpi ? 90 : 180;
  // Charts animate in once, on their first data; the silent refresh every
  // 30 seconds then only moves marks to their new values, so numbers never
  // vanish and reappear on the card.
  const drawn_ref = useRef(false);
  const animate = !drawn_ref.current;
  const chart_ref = useRef(null);
  const chart_width = useCardWidth(chart_ref);
  useEffect(() => {
    if (data && !data.error && !data.locked) drawn_ref.current = true;
  }, [data]);

  return (
    <div className="dcs-widget-card relative border-2 flex flex-col h-full min-w-0 max-w-full overflow-hidden" style={{ backgroundColor: palette.background, color: palette.text, borderColor: failed ? DANGER : skipped_count > 0 ? ORANGE : palette.border }}>
      {selectable && (
        // The selection mode's click surface: covers the whole card so no
        // inner control fires, and carries the tick that marks a selection.
        <button
          type="button"
          aria-pressed={!!selected}
          onClick={onSelect}
          className="dcs-select-surface absolute inset-0 z-20 cursor-pointer"
          style={{ background: selected ? "rgba(5,109,170,0.08)" : "transparent", border: "none" }}
        >
          <span
            className="absolute flex items-center justify-center"
            style={{ top: 8, left: 8, width: 22, height: 22, border: `2px solid ${PRIMARY}`, backgroundColor: selected ? PRIMARY : "#FFFFFF" }}
          >
            {selected && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="4 12.5 10 18.5 20 6" />
              </svg>
            )}
          </span>
        </button>
      )}
      <div className={`px-3 ${is_kpi ? "pt-2 pb-1" : "pt-3 pb-2"} flex items-start gap-2`}>
        {is_kpi && <KpiIconSlot icon={widget.icon} color={palette.number} />}
        <div className="min-w-0 flex-1">
          <EditableText
            value={widget.title}
            placeholder={type_label}
            editable={editable}
            saving={savingText}
            hint={translate("DCS_DB_CLICK_TO_EDIT")}
            maxLength={120}
            textStyle={{ color: palette.text, fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: is_kpi ? 12 : 14 }}
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
            wrap={is_kpi}
            textStyle={{ color: palette.muted, fontSize: is_kpi ? 11 : 12 }}
            onCommit={(next) => onUpdateText({ description: next || null })}
          />
        </div>
        {savingText && <span className="dcs-inline-spinner flex-shrink-0 mt-1" style={{ color: PRIMARY }} />}
        {editable && !savingText && (onRemove || onChangeType || onAppearance || onPickIcon) && (
          <CardMenu widget={widget} onChangeType={onChangeType} onChangeSize={is_kpi ? undefined : onChangeSize} onRemove={onRemove} onAppearance={onAppearance} onPickIcon={is_kpi ? onPickIcon : undefined} />
        )}
      </div>

      {/* The chart area never widens the card: it is the measured box the
          chart sizes itself to, and anything still wider than it (a long
          time range, a wide heatmap) scrolls inside here instead. */}
      <div ref={chart_ref} className={`px-2 ${is_kpi ? "pb-2" : "pb-3"} flex-1 min-w-0 max-w-full`} style={{ overflowX: "auto", overflowY: "hidden" }}>
        {loading ? (
          <div className="flex items-center justify-center" style={{ height: state_height }}>
            <SpiralLoader />
          </div>
        ) : !data ? (
          <StateMessage height={state_height}>{translate("DCS_DB_NO_DATA")}</StateMessage>
        ) : data.locked ? (
          <StateMessage height={state_height}>{translate("DCS_DB_LOCKED")}</StateMessage>
        ) : data.error ? (
          <div className="flex flex-col items-center justify-center gap-2" style={{ height: state_height }}>
            <p className="text-xs text-center px-4 font-semibold" style={{ color: DANGER, fontFamily: "'Montserrat', sans-serif" }}>
              {translate(data.error === "TIMEOUT" ? "DCS_DB_WIDGET_SLOW" : "DCS_DB_WIDGET_ERROR")}
            </p>
            <p className="text-xs text-center px-4" style={{ color: DANGER }}>
              {translate("DCS_DB_WIDGET_REMOVE_HINT")}
            </p>
            {onRetry && (
              <button
                type="button"
                className="text-xs font-semibold uppercase px-2 py-1"
                style={{ color: PRIMARY, border: `1px solid ${PRIMARY}`, fontFamily: "'Montserrat', sans-serif", cursor: "pointer", background: palette.background }}
                onClick={onRetry}
              >
                {translate("DCS_DB_RETRY")}
              </button>
            )}
          </div>
        ) : (
          <WidgetChart widget={widget} data={data} fitMode={fitMode} animate={animate} cardWidth={chart_width} />
        )}
      </div>

      {skipped_count > 0 && (
        <button
          type="button"
          className="px-3 pb-2 text-xs font-semibold text-left"
          style={{ color: ORANGE, fontFamily: "'Montserrat', sans-serif", background: "none", border: "none", cursor: "pointer" }}
          onClick={() => onShowSkipped && onShowSkipped(widget)}
        >
          {translate("DCS_DB_SKIPPED_BADGE", { count: skipped_count })}
        </button>
      )}

      {total !== null && (
        <p className="px-3 pb-2 text-xs font-semibold text-right mt-auto" style={{ color: palette.number, fontFamily: "'Montserrat', sans-serif" }}>
          {translate("DCS_DB_TOTAL")}: {total.toLocaleString("en-US")}
        </p>
      )}
    </div>
  );
}
