import React, { useLayoutEffect, useRef, useState } from "react";
import CanvasFreeLayer from "./CanvasFreeLayer.jsx";
import { BOARD_WIDTH, board_width } from "./boxLayout.js";

/**
 * STUDIO MODE for a whole board: every widget placed and sized by hand,
 * stacked in whatever order the author wants, exactly as the screenshot
 * studio works.
 *
 * The catch with placing things in pixels is that pixels are not the same
 * on every screen. So a studio board REMEMBERS THE WIDTH IT WAS ARRANGED
 * AT and treats that as its design size. A screen at least that wide draws
 * it at its real size; a narrower one draws the whole board SCALED DOWN by
 * the ratio between the two - phone included - so the arrangement arrives
 * as it was designed instead of reflowing into something else. Nothing is
 * reordered, nothing is dropped, and nothing overlaps that did not overlap
 * before, because the whole surface shrinks together.
 *
 * The fit goes both ways: a narrower room draws the board smaller, a wider
 * one draws it larger, so it is always as wide as what holds it - the full
 * screen in the studio, the page column on the board. Either way the
 * pointer's travel is undone by the same scale, exactly as the screenshot
 * studio does it, so a box lands under the pointer whatever size the board
 * is drawn at.
 */

// zoom re-lays-out at the new size (crisp text, real box sizes); the
// transform fallback only paints smaller, so it needs the width correcting.
const SUPPORTS_ZOOM = typeof CSS !== "undefined" && CSS.supports && CSS.supports("zoom", "1");

export default function BoardFreeSurface({ list, layout, placeable, onPlace, onRemove }) {
  const frame = useRef(null);
  const inner = useRef(null);
  const [room, setRoom] = useState(0);
  const [tall, setTall] = useState(0);

  useLayoutEffect(() => {
    const measure = () => {
      if (frame.current) setRoom(frame.current.clientWidth);
      if (inner.current) setTall(inner.current.scrollHeight);
    };
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (observer) {
      if (frame.current) observer.observe(frame.current);
      if (inner.current) observer.observe(inner.current);
    }
    window.addEventListener("resize", measure);
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const design = board_width(layout);
  const scale = room > 0 ? Math.min(3, room / design) : 1;

  return (
    <div
      ref={frame}
      className="dcs-board-free w-full mx-auto"
      // A transform only PAINTS smaller - the page still reserves the full
      // height - so the frame is told what the scaled board really comes
      // to. zoom re-lays-out, so there it is nothing to correct.
      style={SUPPORTS_ZOOM || !tall ? { overflow: "hidden" } : { overflow: "hidden", height: Math.ceil(tall * scale) }}
    >
      <div
        ref={inner}
        // The board on the studio ground: its own border and shadow, as the
        // screenshot studio draws it, so where it ends is plain to see.
        className="dcs-studio-canvas"
        style={Object.assign({ backgroundColor: "var(--board-bg, #F4F7F9)" }, SUPPORTS_ZOOM ? { width: design, zoom: scale } : { width: design, transform: `scale(${scale})`, transformOrigin: "top left" })}
      >
        <CanvasFreeLayer list={list} width={design} height={BOARD_WIDTH.min_height} scale={scale} placeable={placeable} onPlace={onPlace} onRemove={onRemove} />
      </div>
    </div>
  );
}
