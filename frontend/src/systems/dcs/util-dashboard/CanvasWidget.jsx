import React, { useRef, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { child_style, breaks_row, canvas_style, resized_length, default_box } from "./boxLayout.js";

/**
 * A CANVAS: a widget whose content is other widgets.
 *
 * Everywhere else on a board the grid decides where things go. Here the
 * widgets decide for themselves - each one joins the flow along the row,
 * starts a fresh row, or stacks in a column, at whatever width and height
 * it was given in pixels or in percent of the canvas (see boxLayout). A
 * widget with no width of its own takes what is left of its row, so a
 * canvas is useful the moment something is dropped into it and can be
 * sized afterwards, rather than needing to be measured first.
 *
 * While the board is editable each child carries two drag handles - its
 * right edge for width, its bottom edge for height - and the whole canvas
 * is a drop of empty space that invites the first widget in. A viewer sees
 * none of that: the same layout, drawn still.
 */

const HANDLE = 10;

/** One child, in its place, with the handles that resize it. */
function CanvasChild({ widget, gap, editable, containerRef, onResize, children }) {
  const box = widget.box || default_box();
  const wrap_ref = useRef(null);
  const [dragging, setDragging] = useState("");

  // Dragging reads the element's REAL size at the moment the drag starts,
  // so an edge pulled from a widget that had no size of its own still
  // begins exactly where it is being seen.
  const start_drag = (edge) => (event) => {
    if (!editable || !onResize) return;
    event.preventDefault();
    event.stopPropagation();
    const element = wrap_ref.current;
    const container = containerRef && containerRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const room = container ? container.clientWidth : rect.width;
    const tall = container ? container.clientHeight : rect.height;
    const from = { x: event.clientX, y: event.clientY, width: rect.width, height: rect.height };
    setDragging(edge);
    const move = (moved) => {
      const next = { ...(widget.box || default_box()) };
      if (edge === "width") next.width = resized_length(from.width, moved.clientX - from.x, room, (box.width && box.width.unit) || "%");
      else next.height = resized_length(from.height, moved.clientY - from.y, tall, (box.height && box.height.unit) || "px");
      onResize(widget.id, next);
    };
    const done = () => {
      setDragging("");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", done);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", done);
  };

  const handle_style = (edge) => ({
    position: "absolute",
    zIndex: 3,
    background: dragging === edge ? "rgba(5,109,170,0.35)" : "transparent",
    ...(edge === "width"
      ? { top: 0, bottom: 0, right: -HANDLE / 2, width: HANDLE, cursor: "col-resize" }
      : { left: 0, right: 0, bottom: -HANDLE / 2, height: HANDLE, cursor: "row-resize" }),
  });

  return (
    <div ref={wrap_ref} className="dcs-canvas-child relative min-w-0" style={child_style(box, gap)}>
      {children}
      {editable && onResize && (
        <>
          <span role="separator" aria-orientation="vertical" style={handle_style("width")} onPointerDown={start_drag("width")} />
          <span role="separator" aria-orientation="horizontal" style={handle_style("height")} onPointerDown={start_drag("height")} />
        </>
      )}
    </div>
  );
}

export default function CanvasWidget({ widget, children, editable, onResize, onAddWidget, height }) {
  const { translate } = useDcsLanguage();
  const box_ref = useRef(null);
  const list = children || [];
  const settings = widget.canvas || {};
  const gap = Number.isFinite(Number(settings.gap)) ? Number(settings.gap) : 12;

  if (list.length === 0) {
    return (
      <div className="dcs-canvas-empty flex flex-col items-center justify-center gap-2 text-center" style={{ minHeight: Math.max(120, height || 0) }}>
        <p className="text-xs" style={{ color: "var(--board-muted, #9E9E9E)" }}>{translate("DCS_DB_CANVAS_EMPTY")}</p>
        {editable && onAddWidget && (
          <button type="button" className="dcs-no-drill text-xs font-semibold uppercase px-3 py-1.5" style={{ color: "#056daa", border: "1px solid #056daa", background: "none", cursor: "pointer", fontFamily: "'Montserrat', sans-serif" }} onClick={onAddWidget}>
            {translate("DCS_DB_CANVAS_ADD")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={box_ref} style={canvas_style(Object.assign({}, settings, height ? { height: { value: height, unit: "px" } } : {}))}>
      {list.map((entry) => (
        <React.Fragment key={entry.widget.id}>
          {/* A widget told to start a new row gets one: a zero-height break
              across the whole line, which is how flex-wrap is made to break
              where it is told rather than only where it runs out of room. */}
          {breaks_row(entry.widget.box) && <span aria-hidden="true" style={{ flexBasis: "100%", height: 0 }} />}
          <CanvasChild widget={entry.widget} gap={gap} editable={editable} containerRef={box_ref} onResize={onResize}>
            {entry.node}
          </CanvasChild>
        </React.Fragment>
      ))}
    </div>
  );
}
