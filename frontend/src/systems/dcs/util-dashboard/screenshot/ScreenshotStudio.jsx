import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { useToast } from "../../../../core/contexts/ToastContext.tsx";
import { useBoardTheme } from "../boardTheme.jsx";
import { portal_root } from "../portalRoot.js";
import { IconButton, CLOSE_SVG } from "../BoardIcons.jsx";
import DcsButtonPrimary from "../../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../../components/DcsButtonOutline.jsx";
import WidgetCard from "../WidgetCard.jsx";
import StudioItem from "./StudioItem.jsx";
import { initial_items, canvas_size, move_rect, resize_rect, snap_rect, bring_to_front, replace_item, file_name_of } from "./studioLayout.js";
import { export_canvas_png, export_canvas_pdf } from "./exportCanvas.js";

const PRIMARY = "#056daa";
const FONT = { fontFamily: "'Montserrat', sans-serif" };
const LIGHT_BG = "#F4F7F9";
const DARK_BG = "#0F171F";

/**
 * The screenshot studio: a large overlay holding the board exactly as it
 * looked when opened - every widget with the data it showed, nothing
 * refreshing - laid out as free boxes on a canvas. Each box can be
 * dragged, resized from any edge or corner, stacked above the others,
 * snapped into alignment (guide lines appear) or removed; "Reset" puts
 * everything back. The canvas is saved as a PNG or a single-page PDF. It
 * closes from its Close button only.
 */
export default function ScreenshotStudio({ form, widgets, dataByWidget, rects, base, onClose }) {
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const board = useBoardTheme();
  const [items, setItems] = useState(() => initial_items(rects));
  const [active_id, setActiveId] = useState(null);
  const [guides, setGuides] = useState({ x: [], y: [] });
  const [exporting, setExporting] = useState(false);
  const [fit, setFit] = useState(1);
  const scroll_ref = useRef(null);
  const canvas_ref = useRef(null);
  const gesture_ref = useRef(null);
  const items_ref = useRef(items);
  items_ref.current = items;

  const widget_by_id = useMemo(() => new Map((widgets || []).map((widget) => [widget.id, widget])), [widgets]);
  const canvas = canvas_size(items, base || { w: 0, h: 0 });
  const background = board.is_dark ? DARK_BG : LIGHT_BG;
  // While exporting the canvas is drawn at its real size; otherwise it is
  // scaled down to fit the studio's width.
  const scale = exporting ? 1 : fit;

  useLayoutEffect(() => {
    const measure = () => {
      const node = scroll_ref.current;
      if (!node || !canvas.w) return;
      setFit(Math.min(1, (node.clientWidth - 32) / canvas.w));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [canvas.w]);

  // One gesture at a time: the pointer's travel (in canvas pixels, so the
  // fit scale is undone) moves or resizes the held box, snapping as it goes.
  const start_gesture = (id, kind, event) => {
    const item = items_ref.current.find((entry) => entry.id === id);
    if (!item) return;
    setItems((current) => bring_to_front(current, id));
    setActiveId(id);
    gesture_ref.current = { id, kind, start: { ...item }, origin_x: event.clientX, origin_y: event.clientY };
  };

  useEffect(() => {
    const on_move = (event) => {
      const gesture = gesture_ref.current;
      if (!gesture) return;
      event.preventDefault();
      const dx = (event.clientX - gesture.origin_x) / scale;
      const dy = (event.clientY - gesture.origin_y) / scale;
      const raw = gesture.kind === "move" ? move_rect(gesture.start, dx, dy) : resize_rect(gesture.start, gesture.kind, dx, dy);
      const others = items_ref.current.filter((entry) => entry.id !== gesture.id);
      const snapped = snap_rect(raw, gesture.kind, others, canvas_size(others.concat([raw]), base || { w: 0, h: 0 }));
      setGuides(snapped.guides);
      setItems((current) => replace_item(current, gesture.id, snapped.rect));
    };
    const on_up = () => {
      if (!gesture_ref.current) return;
      gesture_ref.current = null;
      setGuides({ x: [], y: [] });
    };
    window.addEventListener("pointermove", on_move);
    window.addEventListener("pointerup", on_up);
    window.addEventListener("pointercancel", on_up);
    return () => {
      window.removeEventListener("pointermove", on_move);
      window.removeEventListener("pointerup", on_up);
      window.removeEventListener("pointercancel", on_up);
    };
  }, [scale, base]);

  const remove_item = (id) => {
    setItems((current) => current.filter((entry) => entry.id !== id));
    if (active_id === id) setActiveId(null);
  };

  const reset = () => {
    setItems(initial_items(rects));
    setActiveId(null);
  };

  const save = async (format) => {
    if (exporting || items.length === 0) return;
    setExporting(true);
    setActiveId(null);
    try {
      // Let the canvas repaint at full size before it is rasterised.
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      const name = file_name_of(form.dashboard_name || form.form_name);
      if (format === "pdf") await export_canvas_pdf(canvas_ref.current, name, background);
      else await export_canvas_png(canvas_ref.current, name, background);
      showSuccess(translate("DCS_DB_SHOT_SAVED"));
    } catch (error) {
      showError(translate("DCS_DB_SHOT_FAILED"));
    } finally {
      setExporting(false);
    }
  };

  return createPortal(
    <div className={`dcs-studio-root fixed inset-0 z-[10000] flex flex-col ${board.is_dark ? "dcs-board-dark dcs-board-dark-portal" : ""}`} style={{ backgroundColor: "#0B1219" }}>
      <div className="flex items-center justify-between gap-3 flex-shrink-0 px-4 sm:px-5 py-2" style={{ backgroundColor: PRIMARY }}>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase leading-tight truncate" style={{ color: "#FFFFFF", letterSpacing: "0.3px", ...FONT }}>
            {translate("DCS_DB_SHOT_TITLE")}
          </p>
          <p className="text-[11px] font-semibold truncate" style={{ color: "rgba(255,255,255,0.85)", ...FONT }}>
            {form.dashboard_name || form.form_name || ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="hidden sm:block w-40">
            <DcsButtonOutline type="button" onClick={reset} disabled={exporting} className="dcs-studio-outline-btn">
              {translate("DCS_DB_SHOT_RESET")}
            </DcsButtonOutline>
          </div>
          <div className="w-32 sm:w-40">
            <DcsButtonPrimary type="button" onClick={() => save("png")} disabled={exporting || items.length === 0} className="dcs-studio-save-btn">
              {exporting ? translate("DCS_DB_SHOT_EXPORTING") : translate("DCS_DB_SHOT_SAVE_PNG")}
            </DcsButtonPrimary>
          </div>
          <div className="w-32 sm:w-40">
            <DcsButtonPrimary type="button" onClick={() => save("pdf")} disabled={exporting || items.length === 0} className="dcs-studio-save-btn">
              {exporting ? translate("DCS_DB_SHOT_EXPORTING") : translate("DCS_DB_SHOT_SAVE_PDF")}
            </DcsButtonPrimary>
          </div>
          <IconButton title={translate("DCS_BTN_CLOSE")} onClick={onClose} onDark danger disabled={exporting}>
            {CLOSE_SVG}
          </IconButton>
        </div>
      </div>
      <p className="flex-shrink-0 px-4 sm:px-5 py-1.5 text-[11px]" style={{ color: "rgba(255,255,255,0.7)", backgroundColor: "#12202C", ...FONT }}>
        {translate("DCS_DB_SHOT_HINT")}
        <button type="button" className="dcs-link-action sm:hidden ml-2 font-bold uppercase" style={{ color: "#FFFFFF", background: "none", border: "none", padding: 0 }} onClick={reset}>
          {translate("DCS_DB_SHOT_RESET")}
        </button>
      </p>

      <div ref={scroll_ref} className="dcs-studio-scroll flex-1 min-h-0 overflow-auto p-4">
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-center" style={{ color: "rgba(255,255,255,0.75)", ...FONT }}>
              {translate("DCS_DB_SHOT_EMPTY")}
            </p>
          </div>
        ) : (
          <div style={{ width: canvas.w * scale, height: canvas.h * scale }} onPointerDown={() => setActiveId(null)}>
            <div ref={canvas_ref} className="dcs-studio-canvas dcs-board-root" style={{ width: canvas.w, height: canvas.h, backgroundColor: background, transform: `scale(${scale})` }}>
              {items.map((item) => {
                const widget = widget_by_id.get(item.id);
                if (!widget) return null;
                return (
                  <StudioItem key={item.id} item={item} active={active_id === item.id} moving={!!gesture_ref.current && gesture_ref.current.id === item.id} onStart={start_gesture} onRemove={remove_item}>
                    <WidgetCard widget={widget} data={dataByWidget[item.id]} loading={false} editable={false} fitMode={false} expanded />
                  </StudioItem>
                );
              })}
              {guides.x.map((x) => (
                <div key={`x${x}`} className="dcs-studio-guide is-x" style={{ left: x }} />
              ))}
              {guides.y.map((y) => (
                <div key={`y${y}`} className="dcs-studio-guide is-y" style={{ top: y }} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>,
    portal_root(),
  );
}
