import React, { useRef, useState, useLayoutEffect } from "react";

/**
 * Shrinks its children down (via CSS transform, never clipping and never
 * scrolling) so they always fully fit the available box - used inside a
 * Section, where a child's box has a fixed height/width and its content
 * must never be cut off or need a scrollbar when the box is resized
 * smaller than the content's natural size. Content that already fits is
 * left at its normal, unscaled size (this only ever shrinks, never grows).
 */
export default function AutoFitContent({ children }) {
  const outer_ref = useRef(null);
  const inner_ref = useRef(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const outer = outer_ref.current;
    const inner = inner_ref.current;
    if (!outer || !inner) return undefined;

    const recompute = () => {
      const outer_rect = outer.getBoundingClientRect();
      const natural_width = inner.scrollWidth;
      const natural_height = inner.scrollHeight;
      if (!natural_width || !natural_height || !outer_rect.width || !outer_rect.height) return;
      const next_scale = Math.min(1, outer_rect.width / natural_width, outer_rect.height / natural_height);
      setScale(next_scale);
    };

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  });

  return (
    <div ref={outer_ref} style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}>
      <div ref={inner_ref} style={{ display: "inline-block", transform: `scale(${scale})`, transformOrigin: "top left" }}>
        {children}
      </div>
    </div>
  );
}
