import React, { useRef, useState, useEffect } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

const MIN_PERCENT = 4;

/**
 * One child field placed freely inside a Section: absolutely positioned by
 * percentage of the section's own box (so it scales proportionally on any
 * device), with its own move handle, resize handle, settings and delete
 * buttons - a section is the one place multiple fields can sit side by
 * side in the same row instead of stacking.
 */
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
        on_layout_change_ref.current({
          x_percent: current_layout.x_percent,
          y_percent: current_layout.y_percent,
          width_percent: Math.min(100 - current_layout.x_percent, Math.max(MIN_PERCENT, Math.round(drag_state.start_width_percent + dx_percent))),
          height_percent: Math.min(100 - current_layout.y_percent, Math.max(MIN_PERCENT, Math.round(drag_state.start_height_percent + dy_percent))),
        });
        return;
      }

      on_layout_change_ref.current({
        x_percent: Math.min(100 - current_layout.width_percent, Math.max(0, Math.round(drag_state.start_x_percent + dx_percent))),
        y_percent: Math.min(100 - current_layout.height_percent, Math.max(0, Math.round(drag_state.start_y_percent + dy_percent))),
        width_percent: current_layout.width_percent,
        height_percent: current_layout.height_percent,
      });
    };

    // Coalesces every mousemove into at most one update per animation
    // frame - dragging fires far faster than React can commit + re-render,
    // and without this, each update reads the field's children from a
    // stale pre-commit snapshot, so a fast drag/resize could silently
    // overwrite fresh content with that stale copy. Throttling keeps every
    // update working from the just-committed state.
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
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handle_move);
    document.addEventListener("mouseup", handle_up);
    return () => {
      document.removeEventListener("mousemove", handle_move);
      document.removeEventListener("mouseup", handle_up);
      if (raf_ref.current !== null) cancelAnimationFrame(raf_ref.current);
    };
    // Mount-once: onLayoutChange/layout are read from refs above, kept
    // fresh on every render, so this subscription never needs to be torn
    // down and rebuilt mid-drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start_drag = (mode) => (event) => {
    event.preventDefault();
    event.stopPropagation();
    drag_state_ref.current = {
      mode,
      start_mouse_x: event.clientX,
      start_mouse_y: event.clientY,
      start_x_percent: layout.x_percent,
      start_y_percent: layout.y_percent,
      start_width_percent: layout.width_percent,
      start_height_percent: layout.height_percent,
    };
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
      <div className="w-full h-full">{children}</div>

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
            onMouseDown={start_drag("resize")}
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
