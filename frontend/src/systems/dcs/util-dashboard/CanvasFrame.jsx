import React, { useRef, useState } from "react";
import { resized_length } from "./boxLayout.js";

/**
 * The resize frame around a SECTION on the board.
 *
 * A canvas is a piece of the page's layout, so it is sized the way a
 * design tool sizes a frame: take hold of an edge or a corner and pull.
 * The eight grips are the screenshot studio's, so the gesture is the one
 * already learned there - the four corners change the width and the height
 * at once, the four edges change one of them, and the opposite side stays
 * where it is.
 *
 * Pulling a grip WRITES the width and the height, so it also switches the
 * section to a fixed size: direct handling beats a remembered least-and-
 * most, and the pair can be put back in the settings dialog.
 *
 * It keeps the unit it was given - a width in percent stays in percent, so
 * a section dragged to half the board is still half of a smaller screen -
 * and a section with no unit yet is measured in percent across and in
 * pixels down, which is how boards are usually thought about.
 */

const EDGES = ["n", "s", "e", "w"];
const GRIPS = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

export default function CanvasFrame({ widget, className, style, dragProps, onResize, children }) {
  const frame = useRef(null);
  const [sizing, setSizing] = useState("");

  const start = (direction) => (event) => {
    if (!onResize || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const element = frame.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const parent = element.parentElement;
    const room = parent ? parent.clientWidth : rect.width;
    const tall = parent ? parent.clientHeight : rect.height;
    const settings = widget.canvas || {};
    const across = (settings.width && settings.width.unit) || "%";
    const down = (settings.height && settings.height.unit) || "px";
    const from = { x: event.clientX, y: event.clientY, width: rect.width, height: rect.height };
    setSizing(direction);
    const move = (moved) => {
      const dx = moved.clientX - from.x;
      const dy = moved.clientY - from.y;
      const next = { size_mode: "fixed" };
      // A west or north grip grows the box as it travels BACKWARDS, which
      // is why its delta is turned around.
      // Across, a section is held within the board; down, it may grow.
      if (direction.includes("e")) next.width = resized_length(from.width, dx, room, across, true);
      if (direction.includes("w")) next.width = resized_length(from.width, -dx, room, across, true);
      if (direction.includes("s")) next.height = resized_length(from.height, dy, tall, down);
      if (direction.includes("n")) next.height = resized_length(from.height, -dy, tall, down);
      onResize(next);
    };
    const done = () => {
      setSizing("");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", done);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", done);
  };

  return (
    <div ref={frame} className={`dcs-canvas-frame ${onResize ? "is-sizable" : ""} ${sizing ? "is-sizing" : ""} ${className || ""}`} style={style} {...(dragProps || {})}>
      {children}
      {onResize && (
        <>
          {EDGES.map((edge) => (
            <div key={edge} className={`dcs-studio-edge is-${edge}`} onPointerDown={start(edge)} />
          ))}
          {GRIPS.map((grip) => (
            <div key={grip} className={`dcs-studio-handle is-${grip}`} onPointerDown={start(grip)} />
          ))}
        </>
      )}
    </div>
  );
}
