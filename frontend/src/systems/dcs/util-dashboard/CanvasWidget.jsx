import React, { useRef } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { child_style, breaks_row, canvas_style, default_box, is_free } from "./boxLayout.js";
import CanvasFreeLayer from "./CanvasFreeLayer.jsx";

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
 * While the board is editable the whole canvas is a drop of empty space
 * that invites the first widget in. Sizing what is in it is studio mode's
 * business, on the working copy, saved once - never a save on every move
 * of the pointer. A viewer sees the same layout, drawn still.
 *
 * In the SELECTION mode each child can also be dragged onto another to
 * change the order they sit in, which is how a widget is moved around
 * inside a section and how a section inside a section is moved around
 * inside its own. A drag there belongs to the child that was grabbed: it
 * never travels up and takes the whole section with it.
 */

/** One child, in its place. Sizing happens in studio mode, not here. */
function CanvasChild({ widget, gap, dragProps, dropClass, children }) {
  const box = widget.box || default_box();

  return (
    <div className={`dcs-canvas-child relative min-w-0 ${dropClass || ""}`} style={child_style(box, gap)} {...(dragProps || {})}>
      {/* While the board is being arranged the card is a picture of the
          widget, so the whole child is one handle to drag by - as on a free
          surface, and as in the screenshot studio. */}
      <div className={dragProps ? "dcs-canvas-child-body" : undefined}>{children}</div>
    </div>
  );
}

export default function CanvasWidget({ widget, children, editable, placeable, onPlace, onRemove, onAddWidget, dragPropsFor, dropClass, height }) {
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

  // Placed rather than queued: every widget where it was dragged to.
  if (is_free(settings)) {
    return <CanvasFreeLayer list={list} height={height} placeable={placeable} onPlace={onPlace} onRemove={onRemove} />;
  }

  return (
    <div ref={box_ref} style={canvas_style(Object.assign({}, settings, height ? { height: { value: height, unit: "px" } } : {}))}>
      {list.map((entry) => (
        <React.Fragment key={entry.widget.id}>
          {/* A widget told to start a new row gets one: a zero-height break
              across the whole line, which is how flex-wrap is made to break
              where it is told rather than only where it runs out of room. */}
          {breaks_row(entry.widget.box) && <span aria-hidden="true" style={{ flexBasis: "100%", height: 0 }} />}
          <CanvasChild widget={entry.widget} gap={gap} dragProps={dragPropsFor ? dragPropsFor(entry.widget) : null} dropClass={dropClass ? dropClass(entry.widget) : ""}>
            {entry.node}
          </CanvasChild>
        </React.Fragment>
      ))}
    </div>
  );
}
