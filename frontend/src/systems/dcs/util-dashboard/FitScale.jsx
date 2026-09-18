import React, { useLayoutEffect, useRef, useState } from "react";

/**
 * Content that SCALES to the box it is given instead of being cut off by
 * it.
 *
 * A widget resized smaller than its content needs used to lose the part
 * that no longer fit behind a hidden edge - a chart with its bottom rows
 * gone, a number with its last digits gone. That is not a smaller widget,
 * it is a broken one. Here the content is measured against the box and,
 * when it is bigger, the whole of it is drawn smaller by exactly the
 * ratio that makes it fit - as a photograph is fitted to a frame - so a
 * widget pulled down to a quarter of its size is the same widget at a
 * quarter of its size.
 *
 * It only ever shrinks. Content with room to spare is left at its true
 * size, because blowing a small chart up to fill a big box makes it soft
 * and its type wrong. zoom is used where the browser has it, since it
 * re-lays the content out at the new size and keeps text crisp; where it
 * does not, a transform paints it smaller and the inner box is widened to
 * match, so the content still fills the frame.
 *
 * Re-measured whenever either the box or the content changes size, with a
 * little tolerance so that a scale that only just fits does not chase
 * itself back and forth by a pixel.
 */

const SUPPORTS_ZOOM = typeof CSS !== "undefined" && CSS.supports && CSS.supports("zoom", "1");
const TOLERANCE = 0.02;

export default function FitScale({ children, className, style }) {
  const outer = useRef(null);
  const inner = useRef(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const box = outer.current;
    const content = inner.current;
    if (!box || !content) return undefined;
    let frame = null;
    const measure = () => {
      const room_w = box.clientWidth;
      const room_h = box.clientHeight;
      if (room_w <= 0 || room_h <= 0) return;
      // What the content wants, in its own (unscaled) pixels.
      const want_w = content.scrollWidth;
      const want_h = content.scrollHeight;
      if (want_w <= 0 || want_h <= 0) return;
      setScale((current) => {
        // Under a transform the box the content is measured in was widened
        // by the current scale, so its wants are read back in box pixels.
        const across = SUPPORTS_ZOOM ? want_w : want_w * current;
        const down = SUPPORTS_ZOOM ? want_h : want_h * current;
        const next = Math.min(1, room_w / across, room_h / down);
        const rounded = Math.floor(next * 100) / 100;
        return Math.abs(rounded - current) > TOLERANCE ? rounded : current;
      });
    };
    const schedule = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    if (observer) {
      observer.observe(box);
      observer.observe(content);
    }
    return () => {
      if (observer) observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const inner_style =
    scale >= 0.999
      ? { width: "100%", height: "100%" }
      : SUPPORTS_ZOOM
        ? { width: "100%", height: "100%", zoom: scale }
        : { width: `${100 / scale}%`, height: `${100 / scale}%`, transform: `scale(${scale})`, transformOrigin: "top left" };

  return (
    <div ref={outer} className={className} style={Object.assign({ width: "100%", height: "100%", overflow: "hidden" }, style || {})}>
      <div ref={inner} style={inner_style}>
        {children}
      </div>
    </div>
  );
}
