import React, { useEffect, useRef, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";
import WidgetChart from "./WidgetChart.jsx";
import LibraryIcon from "./icons/LibraryIcon.jsx";
import { chart_definition } from "./chartCatalog.js";
import { build_palette, with_alpha } from "./appearance.js";
import CardMenu from "./WidgetCardMenu.jsx";
import { useBoardTheme } from "./boardTheme.jsx";
import { useBoardColors } from "./boardColors.jsx";
import { chart_density, kpi_density } from "./charts/density.js";
import TextWidget from "./charts/TextWidget.jsx";
import { period_of, period_label } from "./builder/widgetBehavior.js";
import { shown_title } from "./cascade.js";

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
  if (!data || data.locked || data.error || ["kpi", "table", "text"].includes(data.kind)) return null;
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
function KpiIconSlot({ icon, color, size }) {
  // A card too narrow to hold both an icon and its number keeps the number.
  if (!icon || !size) return null;
  return (
    <span className="flex items-center justify-center flex-shrink-0" style={{ width: size + 6, height: size + 6 }}>
      <LibraryIcon icon={icon} size={size} color={color} />
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
export default function WidgetCard({ widget, data, loading, busy, onRetry, fitMode, editable, savingText, onUpdateText, onRemove, onChangeType, onChangeSize, onShowSkipped, onPickIcon, onAppearance, expanded, onOpenRecords, canMap, canHeat, onMapMode, fields, onOverTime, onReconfigure, onBehavior, onTablePage, onDrill, drillChild, slot, onContextMenu }) {
  const { translate } = useDcsLanguage();
  const board = useBoardTheme();
  const definition = chart_definition(widget.chart_type);
  // A canvas is a section of the layout: no data, so no total, no records
  // behind it, and no heading unless one was actually written.
  const is_canvas = widget.chart_type === "canvas";
  // A text block is words: it fetches nothing and, like a canvas, needs no
  // title bar unless it was given a title.
  const is_text = widget.chart_type === "text";
  const wordless = is_canvas || is_text;
  // A window the card is locked to is said on the card; which board
  // filters it ignores is the author's business (the Date & filters
  // dialog) and is not written on it.
  const own_period = period_of(widget);
  const fixed = own_period.locked && !wordless;
  // The card paints itself from the widget's own appearance (light or dark
  // mode with its background, text and number colors) - unless the viewer
  // switched the whole board to dark mode, which paints every card dark.
  const board_colors = useBoardColors();
  const palette = build_palette(widget.appearance, board.theme, board_colors);
  // The title as shown: a card stacked on one value always names it, in
  // brackets when the author's own title does not.
  const title_shown = wordless ? widget.title : shown_title(widget, palette.name_for);
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
  // What the area needs on its own, for a surface that sizes the card to
  // its content (see freeFlow): the chart at the height its width earns,
  // plus the room under it, or the state area while there is no chart.
  // A chart that FILLS the room it was given says so, because its drawn
  // height then tells nothing about what it needs.
  const has_chart = !!data && !data.error && !data.locked && !loading;
  const base_chart_height = chart_density(chart_size.width).height;
  // What a KPI card of this width may draw: its icon, its title, its
  // number and its padding all follow the room it ended up with.
  const kpi = kpi_density(chart_size.width, widget.size);
  const base_need = wordless ? 0 : !has_chart ? state_height : is_kpi ? 0 : base_chart_height + 56;
  const filled = has_chart && !is_kpi && !wordless && fill_height > base_chart_height;
  useEffect(() => {
    if (data && !data.error && !data.locked) drawn_ref.current = true;
  }, [data]);

  // OPENING THE RECORDS. A bar, a slice, a point, a cell or a legend entry
  // opens its own: that is a deliberate click on a mark, and it stays.
  // Everything else about a widget - the table behind all of it, the level
  // below it in a cascade, filling the screen, and everything an editor can
  // change - is in ONE MENU, opened by a right click or, where there is no
  // right button to press, by a double click. The card carries no control
  // that waits for a hover: nothing appears when the pointer arrives and
  // nothing is hidden when it leaves.
  const is_map = widget.chart_type === "map";
  const can_drill = !wordless && !!onOpenRecords && !!data && !data.error && !data.locked;
  const pick_records = can_drill ? (pick) => onOpenRecords(pick) : undefined;
  // A double click is a right click on a screen that has no right button.
  // On a map the two clicks belong to the map (zooming), so there the menu
  // is reached by a long press, which the browser reports as a context menu.
  const handle_double_click = onContextMenu && !is_map ? onContextMenu : undefined;

  return (
    <div data-widget-id={widget.id} onContextMenu={onContextMenu} onDoubleClick={handle_double_click} className="dcs-widget-card relative flex flex-col h-full min-w-0 max-w-full overflow-hidden" style={{ backgroundColor: palette.background, color: palette.text, borderStyle: "solid", borderWidth: failed || skipped_count > 0 ? 2 : palette.border_width, borderColor: failed ? DANGER : skipped_count > 0 ? ORANGE : palette.border }}>
      {busy && (
        // The board is fetching again: what the card holds stays on show,
        // under a veil that takes every click until the new data lands.
        <div className="dcs-widget-busy" style={{ backgroundColor: with_alpha(palette.background, 0.45) }} onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
          <SpiralLoader />
        </div>
      )}
      {/* A SECTION and a TEXT BLOCK need not be named: a section holds
          widgets rather than data, and a block carries its words inside
          itself, so an unnamed one shows no title bar at all to a reader -
          an empty strip above it is just a gap. WHILE THE BOARD IS
          EDITABLE THE BAR STAYS on both, because that is where the name is
          added and where the card's own menu lives: its size, its colour
          settings, its words and the way to remove it. */}
      {(!wordless || editable || !!widget.title || !!widget.description) && (
      <div className={`${is_kpi ? `${kpi.pad} pt-2 pb-1` : "px-3 pt-3 pb-2"} flex items-start gap-2`}>
        {is_kpi && <KpiIconSlot icon={widget.icon} color={palette.number} size={kpi.icon} />}
        <div className="min-w-0 flex-1 relative">
          <div className="flex flex-wrap items-baseline gap-x-1.5">
          {/* The name and the description are SHOWN here and set in the
              settings dialog. They used to be typed in place, which made
              every heading on a board a control and renamed a chart on a
              stray click. */}
          <EditableText
            value={title_shown}
            placeholder={wordless ? "" : type_label}
            hideWhenEmpty={wordless}
            editable={false}
            maxLength={120}
            textStyle={{ color: palette.text, fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: is_kpi ? kpi.title : 14 }}
          />
          </div>
          <EditableText
            value={widget.description || ""}
            hideWhenEmpty
            editable={false}
            maxLength={300}
            textStyle={{ color: palette.muted, fontSize: is_kpi ? Math.max(9, kpi.title - 1) : 12 }}
          />
          {fixed && (
            <div className="flex flex-wrap gap-1 mt-1">
              <span className="dcs-widget-chip" style={{ color: palette.number, borderColor: palette.border }} title={translate("DCS_DB_PERIOD_LOCKED_HINT")}>
                {translate("DCS_DB_CHIP_FIXED", { period: period_label(own_period, translate) })}
              </span>
            </div>
          )}
        </div>
        {savingText && <span className="dcs-inline-spinner flex-shrink-0 mt-1" style={{ color: PRIMARY }} />}
        {editable && !savingText && (onRemove || onChangeType || onAppearance || onPickIcon || onMapMode) && (
          <CardMenu widget={widget} palette={palette} canMap={canMap} onChangeType={onChangeType} onChangeSize={onChangeSize} onRemove={onRemove} onAppearance={onAppearance} onPickIcon={is_kpi || is_map ? onPickIcon : undefined} onMapMode={is_map ? onMapMode : undefined} canHeat={canHeat} fields={fields} onOverTime={onOverTime} onReconfigure={onReconfigure} onBehavior={is_canvas ? undefined : onBehavior} />
        )}
      </div>
      )}

      {/* The chart area never widens the card: it is the measured box the
          chart sizes itself to, and anything still wider than it (a long
          time range, a wide heatmap) scrolls inside here instead. */}
      {/* Everything the widget holds is REACHABLE here. A chart opened out
          to all of its values, a legend of three hundred entries, a wide
          heatmap: the area scrolls in both directions rather than clipping
          what will not fit, which is what used to make "Show more" look
          like it had done nothing. min-h-0 is what lets it scroll instead
          of pushing the card taller than the row. */}
      <div ref={chart_ref} className={`dcs-widget-area ${is_canvas ? "" : `px-2 ${is_kpi ? "pb-2" : "pb-3"}`} flex-1 min-w-0 min-h-0 max-w-full`} style={{ overflowX: "auto", overflowY: "auto" }} data-base-need={base_need} data-filled={filled ? "1" : "0"}>
        {slot ? (
          // A canvas has no data to wait for or fail at: what it holds is
          // handed in and drawn straight away.
          slot
        ) : is_text ? (
          // Words need no data either: the block is drawn from the widget.
          <div className="px-1 pt-1">
            <TextWidget widget={widget} palette={palette} data={data && !data.error ? data : null} width={chart_size.width} />
          </div>
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
            {editable && (
              <p className="text-xs text-center px-4" style={{ color: DANGER }}>
                {translate("DCS_DB_WIDGET_REMOVE_HINT")}
              </p>
            )}
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
          <WidgetChart widget={widget} data={data} fitMode={fitMode} animate={animate} cardWidth={chart_size.width} fillHeight={fill_height} onPick={pick_records} canHeat={canHeat} canWorld={canMap} onMapMode={onMapMode} onTablePage={onTablePage ? (page, page_size) => onTablePage(widget, page, page_size) : undefined} />
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
