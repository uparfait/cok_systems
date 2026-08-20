import React, { useRef, useState, useEffect } from "react";
import { build_design_styles, PIXEL_SIZED_TYPES } from "../renderer/designStyles.js";

const MIN_WIDTH_PERCENT = 10;
const MIN_PIXEL_SIZE = 24;
const MAX_PIXEL_SIZE = 3000;

/**
 * Wraps a form design component in the builder canvas so it sits exactly
 * where it will end up once published, and lets the author resize it
 * visually, right on top of the component itself - never in Field
 * Settings. Resizing an image changes ITS OWN pixel width (width_px),
 * exactly like resizing that object in any design tool - not some
 * invisible wrapper around it. Header, paragraph, file and horizontal
 * line have no independent size of their own, so resizing them changes
 * how wide their column is (width_percent). Position is fixed at drop
 * time; only size is adjustable afterward.
 */
export default function DesignableFieldWrapper({ field, onFieldChange, children }) {
  const design = field.design || {};
  const is_pixel_sized = PIXEL_SIZED_TYPES.includes(field.type);
  const row_ref = useRef(null);
  const drag_state_ref = useRef(null);
  const field_ref = useRef(field);
  const on_field_change_ref = useRef(onFieldChange);
  const raf_ref = useRef(null);
  const latest_event_ref = useRef(null);
  const [is_hovering, setIsHovering] = useState(false);
  const [is_dragging, setIsDragging] = useState(false);

  field_ref.current = field;
  on_field_change_ref.current = onFieldChange;

  useEffect(() => {
    const apply_move = () => {
      raf_ref.current = null;
      const drag_state = drag_state_ref.current;
      const event = latest_event_ref.current;
      if (!drag_state || !event || !row_ref.current) return;
      const current_field = field_ref.current;
      const current_design = current_field.design || {};
      const row_width = row_ref.current.getBoundingClientRect().width;
      const dx = event.clientX - drag_state.start_mouse_x;

      if (is_pixel_sized) {
        on_field_change_ref.current(
          Object.assign({}, current_field, { width_px: Math.min(MAX_PIXEL_SIZE, Math.max(MIN_PIXEL_SIZE, Math.round(drag_state.start_width_px + dx))) }),
        );
        return;
      }

      const delta_percent = (dx / row_width) * 100;
      const next_width_percent = Math.min(100, Math.max(MIN_WIDTH_PERCENT, Math.round(drag_state.start_width_percent + delta_percent)));
      on_field_change_ref.current(Object.assign({}, current_field, { design: Object.assign({}, current_design, { width_percent: next_width_percent }) }));
    };

    // Coalesced into at most one update per animation frame - see
    // SectionChildWrapper for why: firing a state update on every raw
    // mousemove can outrun React's render cycle and stomp on other
    // just-applied changes with a stale pre-commit snapshot.
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
    // Mount-once: field/onFieldChange are read from refs above, kept fresh
    // on every render, so this subscription never needs to be torn down
    // and rebuilt mid-drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is_pixel_sized]);

  const start_resize = (event) => {
    event.preventDefault();
    event.stopPropagation();
    drag_state_ref.current = {
      start_mouse_x: event.clientX,
      start_mouse_y: event.clientY,
      start_width_percent: design.width_percent || 100,
      start_width_px: field.width_px || 120,
    };
    setIsDragging(true);
  };

  if (design.full_device_width) {
    const { inner_style } = build_design_styles(field);
    return <div style={inner_style}>{children}</div>;
  }

  const { outer_style, inner_style } = build_design_styles(field);
  const show_handles = is_hovering || is_dragging;

  return (
    <div ref={row_ref} style={outer_style} onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)}>
      <div style={Object.assign({ position: "relative", display: "inline-block" }, inner_style)}>
        {children}

        {show_handles &&
          (is_pixel_sized ? (
            <div
              onMouseDown={start_resize}
              title="Drag to resize"
              className="absolute"
              style={{
                bottom: -6,
                right: -6,
                width: 14,
                height: 14,
                borderRadius: "50%",
                backgroundColor: "#056daa",
                cursor: "nwse-resize",
                zIndex: 5,
              }}
            />
          ) : (
            <div
              onMouseDown={start_resize}
              title="Drag to resize"
              className="absolute"
              style={{
                top: 0,
                right: -4,
                width: 8,
                height: "100%",
                cursor: "ew-resize",
                backgroundColor: "rgba(5,109,170,0.35)",
                zIndex: 5,
              }}
            />
          ))}
      </div>
    </div>
  );
}
