import React, { useEffect, useRef, useState } from "react";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";

/**
 * The Review action, always reachable. It keeps its real place at the
 * bottom of the builder, and while that place is scrolled out of sight a
 * copy of it is pinned to the bottom of the window instead - so a long
 * form never leaves the author scrolling to the end just to open the
 * rehearsal. The in-place button stays mounted (and simply turns
 * invisible) rather than being swapped out, because it is what the
 * observer is watching: unmounting it would leave nothing to tell us the
 * author had scrolled back to it.
 */
export default function StickyReviewButton({ label, disabled, onClick }) {
  const anchor_ref = useRef(null);
  const [is_in_place_visible, setIsInPlaceVisible] = useState(true);

  useEffect(() => {
    const anchor = anchor_ref.current;
    if (!anchor || typeof window.IntersectionObserver !== "function") return undefined;
    const observer = new window.IntersectionObserver(
      (entries) => setIsInPlaceVisible(entries[0].isIntersecting),
      { threshold: 0.6 },
    );
    observer.observe(anchor);
    return () => observer.disconnect();
  }, []);

  const button = (
    <DcsButtonOutline className="w-full" disabled={disabled} onClick={onClick}>
      {label}
    </DcsButtonOutline>
  );

  return (
    <>
      <div ref={anchor_ref} style={{ visibility: is_in_place_visible ? "visible" : "hidden" }}>
        {button}
      </div>

      {!is_in_place_visible && <div className="dcs-sticky-review">{button}</div>}
    </>
  );
}
