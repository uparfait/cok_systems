import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { IconButton, CLOSE_SVG } from "./BoardIcons.jsx";
import WidgetCard from "./WidgetCard.jsx";
import { useBoardTheme } from "./boardTheme.jsx";
import { useNarrowViewport } from "./useNarrowViewport.js";
import { drill_target, derive_child_widget, field_label } from "./cascade.js";
import { portal_root } from "./portalRoot.js";
import { useBoardColors, portal_tint } from "./boardColors.jsx";

const PRIMARY = "#056daa";
const FONT = { fontFamily: "'Montserrat', sans-serif" };

/**
 * The levels a widget was drilled down through, one panel each, stacked
 * on top of one another - the last one opened on top and the only one
 * that answers to the pointer. Every panel holds the derived widget as a
 * full card, computed under the board's own period and filters, and its
 * header carries the two ways on: the table of its records, and the level
 * below it, until the chain ends. They are buttons in the header rather
 * than anything that appears on a hover. On a phone or a tablet each panel
 * fills the screen.
 *
 * Every panel is the same width as the one it was opened from - only its
 * top edge steps down, which is what shows the depth - so a cascade five
 * levels deep is still five panels of one width rather than a card
 * shrinking towards the middle of the screen.
 */
export default function DrillOverlay({ stack, fields, onDrill, onOpenRecords, onBack, onClose }) {
  const { translate } = useDcsLanguage();
  const board = useBoardTheme();
  const tint = portal_tint(useBoardColors());
  const narrow = useNarrowViewport();
  useEffect(() => {
    const on_key = (event) => {
      if (event.key === "Escape") onBack();
    };
    document.addEventListener("keydown", on_key);
    return () => document.removeEventListener("keydown", on_key);
  }, [onBack]);
  if (!stack || stack.length === 0) return null;
  const top = stack.length - 1;
  return createPortal(
    <div className={`dcs-drill-overlay ${tint.className || (board.is_dark ? "dcs-board-dark dcs-board-dark-portal" : "")}`} style={tint.style}>
      <div className="dcs-drill-backdrop" onClick={onClose} />
      {stack.map((level, index) => {
        const is_top = index === top;
        const target = drill_target(level.widget, fields);
        const step = narrow ? 0 : Math.min(index, 4) * 18;
        return (
          <div key={level.widget.id} className={`dcs-drill-panel dcs-board-root ${is_top ? "is-top" : ""} ${narrow ? "is-full" : ""}`} style={{ top: step, left: 0, right: 0, bottom: 0 }} aria-hidden={!is_top}>
            <div className="flex items-center justify-between gap-3 flex-shrink-0 px-4 py-2" style={{ backgroundColor: PRIMARY }}>
              <div className="min-w-0 flex items-center gap-3">
                {index > 0 && is_top && (
                  <button type="button" className="text-xs font-bold uppercase px-2 py-1 cursor-pointer" style={{ color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.7)", background: "none", letterSpacing: "0.4px", ...FONT }} onClick={onBack}>
                    {translate("DCS_DB_DRILL_BACK")}
                  </button>
                )}
                {is_top && onOpenRecords && (
                  <button type="button" className="text-xs font-bold uppercase px-2 py-1 cursor-pointer flex-shrink-0" style={{ color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.7)", background: "none", letterSpacing: "0.4px", ...FONT }} onClick={() => onOpenRecords(level.widget, null)}>
                    {translate("DCS_DB_DRILL_TABLE")}
                  </button>
                )}
                {is_top && target && (
                  <button type="button" className="text-xs font-bold uppercase px-2 py-1 cursor-pointer flex-shrink-0" style={{ color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.7)", background: "none", letterSpacing: "0.4px", ...FONT }} onClick={() => onDrill(level.widget)}>
                    {translate("DCS_DB_DRILL_CHILD", { field: field_label(target.child) })}
                  </button>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase leading-tight truncate" style={{ color: "#FFFFFF", letterSpacing: "0.3px", ...FONT }}>
                    {level.widget.title}
                  </p>
                  <p className="text-[11px] font-semibold truncate" style={{ color: "rgba(255,255,255,0.85)", ...FONT }}>
                    {stack.slice(0, index + 1).map((entry) => field_label(entry.child)).join(" > ")}
                  </p>
                </div>
              </div>
              <IconButton title={translate("DCS_BTN_CLOSE")} onClick={onClose} onDark danger>
                {CLOSE_SVG}
              </IconButton>
            </div>
            <div className="dcs-drill-body">
              <WidgetCard
                widget={level.widget}
                data={level.data}
                loading={level.loading}
                editable={false}
                expanded
                fields={fields}
                onOpenRecords={onOpenRecords ? (pick) => onOpenRecords(level.widget, pick) : undefined}
                onDrill={target ? () => onDrill(level.widget) : undefined}
                drillChild={target ? field_label(target.child) : null}
                onRetry={level.retry}
              />
            </div>
          </div>
        );
      })}
    </div>,
    portal_root(),
  );
}

/**
 * The state behind the overlay: the levels open, opening the next one from
 * a widget (its derived child widget is fetched through the board's own
 * data call, under the board's current period and filters), stepping back,
 * and closing everything.
 */
export function useDrillStack({ fields, fetchBatch, onOpenRecords }) {
  const [stack, setStack] = useState([]);
  const fetch_level = (derived) => {
    setStack((current) => current.map((entry) => (entry.widget.id === derived.id ? Object.assign({}, entry, { loading: true, data: null }) : entry)));
    Promise.resolve(fetchBatch([derived]))
      .then((response) => {
        const result = ((response && response.data && response.data.results) || [])[0] || { widget_id: derived.id, error: "FAILED" };
        setStack((current) => current.map((entry) => (entry.widget.id === derived.id ? Object.assign({}, entry, { loading: false, data: result }) : entry)));
      })
      .catch(() => setStack((current) => current.map((entry) => (entry.widget.id === derived.id ? Object.assign({}, entry, { loading: false, data: { widget_id: derived.id, error: "FAILED" } }) : entry))));
  };
  const open = (widget) => {
    const target = drill_target(widget, fields);
    if (!target) return;
    const derived = derive_child_widget(widget, target);
    setStack((current) => (current.some((entry) => entry.widget.id === derived.id) ? current : current.concat([{ widget: derived, child: target.child, data: null, loading: true, retry: () => fetch_level(derived) }])));
    fetch_level(derived);
  };
  const back = () => setStack((current) => current.slice(0, -1));
  const close = () => setStack([]);
  const element = stack.length > 0 ? <DrillOverlay stack={stack} fields={fields} onDrill={open} onOpenRecords={onOpenRecords} onBack={back} onClose={close} /> : null;
  return { open, back, close, element, depth: stack.length };
}
