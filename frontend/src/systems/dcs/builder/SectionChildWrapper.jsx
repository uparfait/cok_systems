import React, { useRef, useState, useEffect } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

const MIN_PERCENT = 4;

const RESIZE_CURSOR_BY_DIRECTION = {
  top: "ns-resize",
  bottom: "ns-resize",
  left: "ew-resize",
  right: "ew-resize",
  corner: "nwse-resize",
};

export default function SectionChildWrapper({ child, layout, sectionRef, onLayoutChange, onOpenSettings, onDeleteChild, children }) {
  const { translate } = useDcsLanguage();
  const drag_state_ref = useRef(null);
  const layout_ref = useRef(layout);
  const on_layout_change_ref = useRef(onLayoutChange);
  const raf_ref = useRef(null);
  const latest_event_ref = useRef(null);
  const [is_hovering, setIsHovering] = useState(false);
  const [is_dragging, setIsDragging] = useState(false);

  layout_ref.current = layout;
  on_layout_change_ref.current = onLayoutChange;

  useEffect(() => {
    const apply_move = () => {
      raf_ref.current = null;
      const drag_state = drag_state_ref.current;
      const event = latest_event_ref.current;
      if (!drag_state || !event || !sectionRef.current) return;
      const current_layout = layout_ref.current;
      const box = sectionRef.current.getBoundingClientRect();
      const dx_percent = ((event.clientX - drag_state.start_mouse_x) / box.width) * 100;
      const dy_percent = ((event.clientY - drag_state.start_mouse_y) / box.height) * 100;

      if (drag_state.mode === "resize") {
        const direction = drag_state.direction;
        let next_x = drag_state.start_x_percent;
        let next_y = drag_state.start_y_percent;
        let next_width = drag_state.start_width_percent;
        let next_height = drag_state.start_height_percent;

        if (direction === "right" || direction === "corner") {
          next_width = Math.min(100 - drag_state.start_x_percent, Math.max(MIN_PERCENT, Math.round(drag_state.start_width_percent + dx_percent)));
        }
        if (direction === "bottom" || direction === "corner") {
          next_height = Math.min(100 - drag_state.start_y_percent, Math.max(MIN_PERCENT, Math.round(drag_state.start_height_percent + dy_percent)));
        }
        if (direction === "left") {
          const raw_width = Math.max(MIN_PERCENT, Math.round(drag_state.start_width_percent - dx_percent));
          const clamped_width = Math.min(drag_state.start_x_percent + drag_state.start_width_percent, raw_width);
          next_width = clamped_width;
          next_x = drag_state.start_x_percent + drag_state.start_width_percent - clamped_width;
        }
        if (direction === "top") {
          const raw_height = Math.max(MIN_PERCENT, Math.round(drag_state.start_height_percent - dy_percent));
          const clamped_height = Math.min(drag_state.start_y_percent + drag_state.start_height_percent, raw_height);
          next_height = clamped_height;
          next_y = drag_state.start_y_percent + drag_state.start_height_percent - clamped_height;
        }

        on_layout_change_ref.current({ x_percent: next_x, y_percent: next_y, width_percent: next_width, height_percent: next_height });
        return;
      }

      on_layout_change_ref.current({
        x_percent: Math.min(100 - current_layout.width_percent, Math.max(0, Math.round(drag_state.start_x_percent + dx_percent))),
        y_percent: Math.min(100 - current_layout.height_percent, Math.max(0, Math.round(drag_state.start_y_percent + dy_percent))),
        width_percent: current_layout.width_percent,
        height_percent: current_layout.height_percent,
      });
    };

    const handle_move = (event) => {
      if (!drag_state_ref.current) return;
      latest_event_ref.current = event;
      if (raf_ref.current === null) raf_ref.current = requestAnimationFrame(apply_move);
    };

    const handle_up = () => {
      drag_state_ref.current = null;
      if (raf_ref.current !== null) {
        cancelAnimationFrame(raf_ref.current);
        raf_ref.current = null;
      }
      document.body.style.cursor = "";
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handle_move);
    document.addEventListener("mouseup", handle_up);
    return () => {
      document.removeEventListener("mousemove", handle_move);
      document.removeEventListener("mouseup", handle_up);
      if (raf_ref.current !== null) cancelAnimationFrame(raf_ref.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start_drag = (mode, direction) => (event) => {
    event.preventDefault();
    event.stopPropagation();
    drag_state_ref.current = {
      mode,
      direction,
      start_mouse_x: event.clientX,
      start_mouse_y: event.clientY,
      start_x_percent: layout.x_percent,
      start_y_percent: layout.y_percent,
      start_width_percent: layout.width_percent,
      start_height_percent: layout.height_percent,
    };
    document.body.style.cursor = mode === "move" ? "move" : RESIZE_CURSOR_BY_DIRECTION[direction];
    setIsDragging(true);
  };

  const show_controls = is_hovering || is_dragging;

  return (
    <div
      className="absolute"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      style={{
        left: `${layout.x_percent}%`,
        top: `${layout.y_percent}%`,
        width: `${layout.width_percent}%`,
        height: `${layout.height_percent}%`,
        outline: show_controls ? "1px dashed #056daa" : "1px solid transparent",
      }}
    >
      <div className="w-full h-full" style={{ overflow: "hidden" }}>
        {children}
      </div>

      {show_controls && (
        <>
          <div
            onMouseDown={start_drag("move")}
            title="Drag to reposition"
            className="absolute flex items-center justify-center"
            style={{ top: -10, left: -10, width: 20, height: 20, borderRadius: "50%", backgroundColor: "#056daa", color: "#FFFFFF", cursor: "move", zIndex: 6, fontSize: 11 }}
          >
            ✥
          </div>
          <div
            onMouseDown={start_drag("resize", "top")}
            title="Drag to resize"
            className="absolute"
            style={{ top: -3, left: 8, right: 8, height: 6, cursor: "ns-resize", zIndex: 6 }}
          />
          <div
            onMouseDown={start_drag("resize", "bottom")}
            title="Drag to resize"
            className="absolute"
            style={{ bottom: -3, left: 8, right: 8, height: 6, cursor: "ns-resize", zIndex: 6 }}
          />
          <div
            onMouseDown={start_drag("resize", "left")}
            title="Drag to resize"
            className="absolute"
            style={{ left: -3, top: 8, bottom: 8, width: 6, cursor: "ew-resize", zIndex: 6 }}
          />
          <div
            onMouseDown={start_drag("resize", "right")}
            title="Drag to resize"
            className="absolute"
            style={{ right: -3, top: 8, bottom: 8, width: 6, cursor: "ew-resize", zIndex: 6 }}
          />
          <div
            onMouseDown={start_drag("resize", "corner")}
            title="Drag to resize"
            className="absolute"
            style={{ bottom: -6, right: -6, width: 12, height: 12, borderRadius: "50%", backgroundColor: "#056daa", cursor: "nwse-resize", zIndex: 6 }}
          />
          <button
            type="button"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => onOpenSettings(child, event.currentTarget.getBoundingClientRect())}
            title={translate("DCS_SETTINGS_TITLE")}
            className="absolute cursor-pointer flex items-center justify-center"
            style={{ top: -10, right: 18, width: 20, height: 20, borderRadius: "50%", backgroundColor: "#FFFFFF", border: "1px solid #056daa", zIndex: 6 }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#056daa" strokeWidth="2.5">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={onDeleteChild}
            title={translate("DCS_BTN_DELETE")}
            className="absolute cursor-pointer flex items-center justify-center"
            style={{ top: -10, right: -10, width: 20, height: 20, borderRadius: "50%", backgroundColor: "#FFFFFF", border: "1px solid #E74C3C", zIndex: 6 }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#E74C3C" strokeWidth="2.5">
              <line x1="5" y1="5" x2="19" y2="19" />
              <line x1="19" y1="5" x2="5" y2="19" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
