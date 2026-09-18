import React, { useEffect, useRef, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";
import WidgetChart from "./WidgetChart.jsx";
import LibraryIcon from "./icons/LibraryIcon.jsx";
import { chart_definition } from "./chartCatalog.js";
import { build_palette, with_alpha } from "./appearance.js";
import CardMenu from "./WidgetCardMenu.jsx";
import { useBoardTheme } from "./boardTheme.jsx";

const PRIMARY = "#056daa";
const DANGER = "#E74C3C";
const ORANGE = "#E67E22";
const SURFACE = "var(--board-surface, #FFFFFF)";
const SURFACE_BORDER = "var(--board-border, #E0E0E0)";
const SURFACE_TEXT = "var(--board-text, #333333)";

/**
 * The live inner width of the card's chart area. Charts size everything
 * they draw from it (see charts/density.js), so a widget set to "small"
 * really draws a small chart instead of stretching its card open.
 */
function useCardSize(element_ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = element_ref.current;
    if (!element) return undefined;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    if (typeof window.ResizeObserver !== "function") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new window.ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element_ref]);
  return size;
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
function EditableText({ value, placeholder, editable, saving, onCommit, textStyle, maxLength, hint, hideWhenEmpty }) {
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
  // An empty line says nothing: it is left out entirely, and only an
  // editor sees it - on hovering the card - as a place to write one.
  if (!value && hideWhenEmpty && !editable) return null;
  return (
    <p
      className={`break-words ${editable ? "dcs-no-drill" : ""} ${!value && hideWhenEmpty ? "dcs-widget-hint" : ""}`}
      style={{ ...textStyle, cursor: editable ? "pointer" : "default" }}
      title={editable ? hint : value || placeholder}
      onClick={start}
    >
      {value || placeholder}
    </p>
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
export default function WidgetCard({ widget, data, loading, busy, onRetry, fitMode, editable, savingText, onUpdateText, onRemove, onChangeType, onChangeSize, onShowSkipped, onPickIcon, onAppearance, selectable, selected, onSelect, expanded, onOpenRecords, canMap, canHeat, onMapMode, fields, onOverTime, onReconfigure, slot, onContextMenu }) {
  const { translate } = useDcsLanguage();
  const board = useBoardTheme();
  const definition = chart_definition(widget.chart_type);
  // A canvas is a section of the layout: no data, so no total, no records
  // behind it, and no heading unless one was actually written.
  const is_canvas = widget.chart_type === "canvas";
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
  const chart_size = useCardSize(chart_ref);
  // Lifted to fill the screen, the chart grows to the room it is given
  // (minus the axis and padding under it) instead of its usual height.
  const fill_height = expanded ? Math.max(0, chart_size.height - 56) : 0;
  useEffect(() => {
    if (data && !data.error && !data.locked) drawn_ref.current = true;
  }, [data]);

  // Opening the records: a bar, slice, point, cell or legend entry picks its
  // own; a click anywhere else on the card (not on a control) opens them
  // all - on a map, where a single click belongs to panning the city, that
  // whole-widget click is a DOUBLE click outside the map itself. The specific pick runs first and marks the click consumed so the
  // card's own handler, reached next as the event bubbles, stays quiet.
  const is_map = widget.chart_type === "map";
  const consumed_ref = useRef(false);
  const can_drill = !is_canvas && !!onOpenRecords && !!data && !data.error && !data.locked && !selectable;
  const pick_records = can_drill
    ? (pick) => {
        consumed_ref.current = true;
        window.setTimeout(() => {
          consumed_ref.current = false;
        }, 0);
        onOpenRecords(pick);
      }
    : undefined;
  const handle_card_click = (event) => {
    if (!can_drill) return;
    if (consumed_ref.current) return;
    if (event.target.closest("button, input, a, textarea, select, .dcs-no-drill, .recharts-tooltip-wrapper")) return;
    onOpenRecords(null);
  };

  return (
    <div data-widget-id={widget.id} onContextMenu={onContextMenu} {...(is_map ? { onDoubleClick: handle_card_click } : { onClick: handle_card_click })} className="dcs-widget-card dcs-widget-hover relative border-2 flex flex-col h-full min-w-0 max-w-full overflow-hidden" style={{ backgroundColor: palette.background, color: palette.text, borderColor: failed ? DANGER : skipped_count > 0 ? ORANGE : palette.border }}>
      {busy && (
        // The board is fetching again: what the card holds stays on show,
        // under a veil that takes every click until the new data lands.
        <div className="dcs-widget-busy" style={{ backgroundColor: with_alpha(palette.background, 0.45) }} onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
          <SpiralLoader />
        </div>
      )}
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
        <div className="min-w-0 flex-1 relative">
          <div className="flex flex-wrap items-baseline gap-x-1.5">
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
          </div>
          <EditableText
            value={widget.description || ""}
            placeholder={translate("DCS_DB_ADD_DESCRIPTION")}
            hideWhenEmpty
            editable={editable}
            saving={savingText}
            hint={translate("DCS_DB_CLICK_TO_EDIT")}
            maxLength={300}
            textStyle={{ color: palette.muted, fontSize: is_kpi ? 11 : 12 }}
            onCommit={(next) => onUpdateText({ description: next || null })}
          />
        </div>
        {savingText && <span className="dcs-inline-spinner flex-shrink-0 mt-1" style={{ color: PRIMARY }} />}
        {editable && !savingText && (onRemove || onChangeType || onAppearance || onPickIcon || onMapMode) && (
          <CardMenu widget={widget} palette={palette} canMap={canMap} onChangeType={onChangeType} onChangeSize={is_kpi ? undefined : onChangeSize} onRemove={onRemove} onAppearance={onAppearance} onPickIcon={is_kpi || is_map ? onPickIcon : undefined} onMapMode={is_map ? onMapMode : undefined} canHeat={canHeat} fields={fields} onOverTime={onOverTime} onReconfigure={onReconfigure} />
        )}
      </div>

      {/* The chart area never widens the card: it is the measured box the
          chart sizes itself to, and anything still wider than it (a long
          time range, a wide heatmap) scrolls inside here instead. */}
      <div ref={chart_ref} className={`px-2 ${is_kpi ? "pb-2" : "pb-3"} flex-1 min-w-0 max-w-full`} style={{ overflowX: "auto", overflowY: "hidden" }}>
        {slot ? (
          // A canvas has no data to wait for or fail at: what it holds is
          // handed in and drawn straight away.
          slot
        ) : loading ? (
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
          <WidgetChart widget={widget} data={data} fitMode={fitMode} animate={animate} cardWidth={chart_size.width} fillHeight={fill_height} onPick={pick_records} canHeat={canHeat} canWorld={canMap} onMapMode={onMapMode} />
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
          {translate("DCS_DB_TOTAL")}: {palette.number_text(total)}
        </p>
      )}
    </div>
  );
}
