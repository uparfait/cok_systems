import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBoardTheme } from "./boardTheme.jsx";
import { portal_root } from "./portalRoot.js";
import { useBoardColors, portal_tint } from "./boardColors.jsx";

const MARGIN = 8;

/**
 * A dropdown panel that opens OUTSIDE the component that owns it: it is
 * portalled to the page and positioned against its trigger, so a menu is
 * never clipped by a small card (every widget card hides its own overflow
 * so charts cannot spill out of it) and never trapped under a neighbouring
 * card. It hangs under the trigger, right-aligned with it (left-aligned
 * with align="start"), flipping above
 * when there is more room there, and is clamped inside the viewport. It
 * follows the trigger while the page scrolls or resizes, and closes on an
 * outside click, on Escape, and whenever the trigger itself scrolls out of
 * sight. Every popover is drawn in the BOARD's colors - a widget's own
 * color settings paint the widget, not the menus hanging off it.
 *
 * AN ANCHOR NEED NOT BE AN ELEMENT. A menu opened where the pointer was
 * (a widget's own menu) anchors to a POINT instead: an object carrying
 * nothing but getBoundingClientRect. Such an anchor has no element to ask
 * whether a click landed inside it, and it cannot follow the page, so a
 * real scroll closes the menu rather than leaving it hanging over content
 * that has moved out from under it.
 */
export default function MenuPopover({ open, anchorRef, onClose, minWidth, maxHeight, children, role, align }) {
  const panel_ref = useRef(null);
  const [placement, setPlacement] = useState(null);
  const board = useBoardTheme();
  const is_dark = board.is_dark;
  const tint = portal_tint(useBoardColors());

  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const box = anchor.getBoundingClientRect();
      const panel = panel_ref.current;
      const width = Math.max(minWidth || 190, panel ? panel.offsetWidth : 0);
      const height = panel ? panel.offsetHeight : 0;
      const below = window.innerHeight - box.bottom - MARGIN;
      const above = box.top - MARGIN;
      const flip = height > below && above > below;
      setPlacement({
        left: Math.max(MARGIN, Math.min(align === "start" ? box.left : box.right - width, window.innerWidth - width - MARGIN)),
        top: flip ? Math.max(MARGIN, box.top - height - 4) : box.bottom + 4,
        room: Math.max(120, (flip ? above : below) - 4),
        width,
      });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, minWidth, align]);

  useEffect(() => {
    if (!open) return undefined;
    const on_outside = (event) => {
      const anchor = anchorRef.current;
      // A point anchor has no contains: asking it threw on every click
      // while the menu was open, which stopped the check that follows and
      // left the menu standing.
      if (anchor && typeof anchor.contains === "function" && anchor.contains(event.target)) return;
      if (panel_ref.current && panel_ref.current.contains(event.target)) return;
      onClose();
    };
    const on_key = (event) => {
      if (event.key === "Escape") onClose();
    };
    // A menu anchored to a point cannot follow the page: once the page
    // really moves, what it was opened over is no longer under it.
    const from = { x: window.scrollX, y: window.scrollY };
    const on_scroll = () => {
      const anchor = anchorRef.current;
      if (anchor && typeof anchor.contains === "function") return;
      if (window.scrollX === from.x && window.scrollY === from.y) return;
      onClose();
    };
    document.addEventListener("mousedown", on_outside);
    document.addEventListener("keydown", on_key);
    window.addEventListener("scroll", on_scroll, true);
    return () => {
      document.removeEventListener("mousedown", on_outside);
      document.removeEventListener("keydown", on_key);
      window.removeEventListener("scroll", on_scroll, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      ref={panel_ref}
      role={role || "menu"}
      className={`dcs-menu-popover fixed border-2 shadow-lg ${tint.className || (is_dark ? "dcs-board-dark dcs-board-dark-portal" : "")}`}
      style={{
        ...tint.style,
        top: placement ? placement.top : -9999,
        left: placement ? placement.left : -9999,
        minWidth: minWidth || 190,
        maxHeight: Math.min(maxHeight || 420, placement ? placement.room : 420),
        overflowY: "auto",
        zIndex: 10060,
        backgroundColor: "var(--board-surface, #FFFFFF)",
        borderColor: "var(--board-border, #E0E0E0)",
        visibility: placement ? "visible" : "hidden",
      }}
    >
      {children}
    </div>,
    portal_root(),
  );
}
