import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { portal_root } from "./portalRoot.js";

const MARGIN = 12;
const DURATION = 320;

const EXPAND_SVG = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
  </svg>
);

const COLLAPSE_SVG = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
  </svg>
);

/**
 * The place a widget card occupies on the board, with a corner button that
 * appears on hover: clicking it lifts the card out of the grid and grows
 * it, in one smooth motion, until it fills the screen above every other
 * widget; clicking again (or Escape, or the shaded backdrop) shrinks it
 * back into its own place. While the card is out, its slot keeps its
 * height so the rest of the board does not move.
 *
 * The motion measures the slot's box on screen and transitions from that
 * box to the screen's edges (and back), so it works wherever the board is:
 * the page, browser full screen, or the fitted full-screen view.
 */
export default function ExpandableSlot({ expanded, onToggle, hideButton, children }) {
  const { translate } = useDcsLanguage();
  const slot_ref = useRef(null);
  const phase_ref = useRef("idle");
  // "idle" | "expanding" | "expanded" | "collapsing"
  const [phase, setPhase] = useState("idle");
  const [frame, setFrame] = useState(null);
  const [held_height, setHeldHeight] = useState(0);

  const set_phase = (next) => {
    phase_ref.current = next;
    setPhase(next);
  };

  // The slot's own box, as fixed-position edges.
  const slot_frame = () => {
    const box = slot_ref.current.getBoundingClientRect();
    return { top: box.top, left: box.left, right: Math.max(0, window.innerWidth - box.right), bottom: Math.max(0, window.innerHeight - box.bottom) };
  };

  useEffect(() => {
    if (expanded) {
      if (!slot_ref.current) return undefined;
      setHeldHeight(slot_ref.current.offsetHeight);
      setFrame(slot_frame());
      set_phase("expanding");
      // Two frames: the first paints the card at its own place, the second
      // moves it - otherwise there would be nothing to transition from.
      let second = 0;
      const first = window.requestAnimationFrame(() => {
        second = window.requestAnimationFrame(() => {
          setFrame({ top: MARGIN, left: MARGIN, right: MARGIN, bottom: MARGIN });
          set_phase("expanded");
        });
      });
      return () => {
        window.cancelAnimationFrame(first);
        window.cancelAnimationFrame(second);
      };
    }
    if (phase_ref.current === "idle" || !slot_ref.current) return undefined;
    setFrame(slot_frame());
    set_phase("collapsing");
    const timer = window.setTimeout(() => {
      set_phase("idle");
      setFrame(null);
    }, DURATION);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return undefined;
    const on_key = (event) => {
      if (event.key === "Escape") onToggle();
    };
    document.addEventListener("keydown", on_key);
    return () => document.removeEventListener("keydown", on_key);
  }, [expanded, onToggle]);

  const active = phase !== "idle";
  return (
    <div ref={slot_ref} className={`dcs-expand-slot relative h-full ${active ? "is-held" : ""}`} style={active ? { height: held_height } : undefined}>
      {!active && children}
      {!active && !hideButton && (
        <button type="button" className="dcs-expand-btn" title={translate("DCS_DB_EXPAND_WIDGET")} aria-label={translate("DCS_DB_EXPAND_WIDGET")} onClick={onToggle}>
          {EXPAND_SVG}
        </button>
      )}
      {active &&
        createPortal(
          <>
            <div className={`dcs-expand-backdrop ${phase === "collapsing" ? "is-leaving" : ""}`} onClick={onToggle} />
            <div className={`dcs-expand-frame ${phase === "expanded" ? "is-open" : ""}`} style={frame || undefined}>
              {children}
              <button type="button" className="dcs-expand-btn is-visible" title={translate("DCS_DB_COLLAPSE_WIDGET")} aria-label={translate("DCS_DB_COLLAPSE_WIDGET")} onClick={onToggle}>
                {COLLAPSE_SVG}
              </button>
            </div>
          </>,
          portal_root(),
        )}
    </div>
  );
}
