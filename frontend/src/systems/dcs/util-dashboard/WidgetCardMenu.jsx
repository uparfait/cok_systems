import React, { useRef, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { chart_definition, convertible_types } from "./chartCatalog.js";
import { can_over_time, over_time_of, default_over_time, time_sources } from "./overTime.js";
import MenuPopover from "./MenuPopover.jsx";

const PRIMARY = "#056daa";
const DANGER = "#E74C3C";
const SURFACE = "var(--board-surface, #FFFFFF)";
const SURFACE_BORDER = "var(--board-border, #E0E0E0)";
const SURFACE_TEXT = "var(--board-text, #333333)";
// The widths a chart can take on the board (KPI cards keep their own dense grid).
const SIZE_OPTIONS = [
  { id: "small", labelKey: "DCS_DB_SIZE_SMALL" },
  { id: "medium", labelKey: "DCS_DB_SIZE_MEDIUM" },
  { id: "large", labelKey: "DCS_DB_SIZE_LARGE" },
];

/**
 * The three-dots menu at each card's top right: pick the icon a KPI card
 * shows or the marker a map plants, flip the widget into ANY
 * compatible look (single-series category charts reach every bar, column,
 * lollipop, dot, slice, waffle, treemap, line and area form; split ones
 * reach every grouped/clustered, stacked, 100 percent, heatmap and
 * multi-series line form - see convertible_types), and remove the widget.
 * Closes on outside click.
 *
 * The menu is drawn in the BOARD's colors, never the widget's. What a
 * widget's color settings paint is the widget itself - its surface, its
 * text and its marks - and nothing that merely hangs off it.
 */
/**
 * The Over time section of a card's menu: a switch, and - once it is on -
 * the clock the widget is read against and whether the time line runs
 * along the bottom or down the side. Only on widgets whose look has an
 * axis to spend on it (see overTime).
 */
function OverTimeSection({ widget, fields, translate, onOverTime, sectionTitle, itemStyle }) {
  const current = over_time_of(widget);
  const set = (changes) => onOverTime(Object.assign({}, current || default_over_time(), changes));
  return (
    <>
      {sectionTitle("DCS_DB_OVER_TIME")}
      <button type="button" role="menuitemcheckbox" aria-checked={!!current} className="dcs-db-menu-item" style={{ ...itemStyle(false), color: PRIMARY, fontWeight: 600 }} onClick={() => onOverTime(current ? null : default_over_time())}>
        {translate(current ? "DCS_DB_OVER_TIME_OFF" : "DCS_DB_OVER_TIME_ON")}
      </button>
      {current && (
        <div className="px-3 pb-2 flex flex-col gap-1.5">
          <select
            className="dcs-over-time-select"
            value={current.field_id}
            aria-label={translate("DCS_DB_OVER_TIME_CLOCK")}
            onChange={(event) => set({ field_id: event.target.value })}
          >
            {time_sources(fields, translate).map((source) => (
              <option key={source.id} value={source.id}>
                {source.label}
              </option>
            ))}
          </select>
          <div className="flex gap-1">
            {["x", "y"].map((axis) => {
              const active = current.axis === axis;
              return (
                <button
                  key={axis}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  className="dcs-db-menu-item flex-1 text-xs font-semibold py-1 px-2"
                  style={{ border: `1px solid ${active ? PRIMARY : SURFACE_BORDER}`, color: active ? "#FFFFFF" : PRIMARY, backgroundColor: active ? PRIMARY : "transparent", cursor: active ? "default" : "pointer", fontFamily: "'Montserrat', sans-serif" }}
                  onClick={() => !active && set({ axis })}
                >
                  {translate(axis === "x" ? "DCS_DB_OVER_TIME_X" : "DCS_DB_OVER_TIME_Y")}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

export default function CardMenu({ widget, palette, canMap, canHeat, fields, onChangeType, onChangeSize, onRemove, onAppearance, onPickIcon, onMapMode, onOverTime, onReconfigure, onBehavior }) {
  // A canvas draws no data, so there is nothing in it to reconfigure and
  // no other look to turn it into: its menu is about size and colors.
  const is_canvas = widget.chart_type === "canvas";
  const { translate } = useDcsLanguage();
  const [open, setOpen] = useState(false);
  const button_ref = useRef(null);

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
    <div className="flex-shrink-0">
      <button
        ref={button_ref}
        type="button"
        title={translate("DCS_DB_MENU")}
        aria-label={translate("DCS_DB_MENU")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center"
        style={{ width: 26, height: 26, border: `1px solid ${palette ? palette.border : SURFACE_BORDER}`, color: palette ? palette.muted : "var(--board-muted, #555555)", backgroundColor: open ? "var(--board-surface-hover, #F0F7FB)" : palette ? palette.background : SURFACE, cursor: "pointer" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>
      <MenuPopover open={open} anchorRef={button_ref} onClose={() => setOpen(false)} minWidth={200}>
        <>
          {onChangeSize && !is_canvas && (
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
          {onChangeType && convertible_types(widget, canMap).filter((type) => type !== widget.chart_type).length > 0 && (
            <>
              {section_title("DCS_DB_TURN_INTO")}
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                {convertible_types(widget, canMap)
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
            <button type="button" role="menuitem" className="dcs-db-menu-item" style={{ ...item_style(false), borderTop: `1px solid ${SURFACE_BORDER}`, color: PRIMARY, fontWeight: 600 }} onClick={() => pick(onPickIcon)}>
              {translate(widget.chart_type === "map" ? "DCS_DB_MAP_CHANGE_MARKER" : widget.icon ? "DCS_DB_ICON_CHANGE" : "DCS_DB_ICON_SET")}
            </button>
          )}
          {onMapMode && (widget.map && widget.map.mode === "heat" ? canMap : canHeat) && (
            <button type="button" role="menuitem" className="dcs-db-menu-item" style={{ ...item_style(false), borderTop: onPickIcon ? "none" : `1px solid ${SURFACE_BORDER}`, color: PRIMARY, fontWeight: 600 }} onClick={() => pick(() => onMapMode(widget.map && widget.map.mode === "heat" ? "world" : "heat"))}>
              {translate(widget.map && widget.map.mode === "heat" ? "DCS_DB_MAP_KIND_WORLD" : "DCS_DB_MAP_KIND_HEAT")}
            </button>
          )}
          {onOverTime && can_over_time(widget) && (
            <OverTimeSection widget={widget} fields={fields} translate={translate} onOverTime={(next) => pick(() => onOverTime(next))} sectionTitle={section_title} itemStyle={item_style} />
          )}
          {onReconfigure && !is_canvas && (
            <button type="button" role="menuitem" className="dcs-db-menu-item" style={{ ...item_style(false), borderTop: `1px solid ${SURFACE_BORDER}`, color: PRIMARY, fontWeight: 600 }} onClick={() => pick(onReconfigure)}>
              {translate("DCS_DB_RECONFIGURE")}
            </button>
          )}
          {onBehavior && !is_canvas && (
            <button type="button" role="menuitem" className="dcs-db-menu-item" style={{ ...item_style(false), borderTop: `1px solid ${SURFACE_BORDER}`, color: PRIMARY, fontWeight: 600 }} onClick={() => pick(onBehavior)}>
              {translate("DCS_DB_BEHAVIOR")}
            </button>
          )}
          {onAppearance && (
            <button type="button" role="menuitem" className="dcs-db-menu-item" style={{ ...item_style(false), borderTop: onPickIcon ? "none" : `1px solid ${SURFACE_BORDER}`, color: PRIMARY, fontWeight: 600 }} onClick={() => pick(onAppearance)}>
              {translate("DCS_DB_COLOR_SETTINGS")}
            </button>
          )}
          {onRemove && (
            <button type="button" role="menuitem" className="dcs-db-menu-item" style={item_style(true)} onClick={() => pick(onRemove)}>
              {translate("DCS_DB_REMOVE_WIDGET")}
            </button>
          )}
          <style>{`.dcs-db-menu-item:hover { background-color: var(--board-surface-hover, #F0F7FB) !important; }`}</style>
        </>
      </MenuPopover>
    </div>
  );
}
