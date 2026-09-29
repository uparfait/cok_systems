import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { portal_root } from "./portalRoot.js";
import { useBoardColors, portal_tint } from "./boardColors.jsx";

/**
 * The right-click menu of a board.
 *
 * On empty board space it offers a new CANVAS - free space a widget can be
 * put in and sized by hand. On a widget it offers that widget's settings
 * (its colors, its border and, inside a canvas, its size and place), a way
 * to put another widget beside it, and - on a canvas - a way to put one
 * inside it.
 *
 * It is a plain portalled list rather than the board's MenuPopover because
 * it opens where the pointer is, not under a button, and must not be
 * clipped by whatever card was clicked.
 *
 * An item names itself with a translation key, or with `label` when the
 * words are built at the time (the name of the next level down a cascade).
 * A long label wraps rather than widening the menu off the screen.
 */

const ITEM = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "0.45rem 0.85rem",
  fontSize: 12,
  fontFamily: "'Montserrat', sans-serif",
  background: "none",
  border: "none",
  cursor: "pointer",
  whiteSpace: "normal",
  overflowWrap: "anywhere",
  lineHeight: 1.3,
  color: "var(--board-text, #333333)",
};

export default function BoardContextMenu({ at, items, onClose }) {
  const { translate } = useDcsLanguage();

  const tint = portal_tint(useBoardColors());

  useEffect(() => {
    if (!at) return undefined;
    const close = () => onClose();
    const key = (event) => event.key === "Escape" && onClose();
    // Any click anywhere, any Escape, and any scroll THAT REALLY MOVED THE
    // PAGE: the menu is done.
    //
    // The last of those is not the obvious test. Putting this menu into a
    // long page makes the browser fire a scroll event of its own - scroll
    // anchoring, keeping what you were looking at still while the document
    // grows - without the page having moved a pixel. A menu that closed on
    // any scroll at all therefore opened and shut itself in the same frame,
    // and on a board long enough to be scrolled near its end it never
    // appeared at all. So where the page WAS when the menu opened is
    // remembered, and only a real move closes it.
    const from = { x: window.scrollX, y: window.scrollY };
    const on_scroll = () => {
      if (window.scrollX === from.x && window.scrollY === from.y) return;
      onClose();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("scroll", on_scroll, true);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", on_scroll, true);
      window.removeEventListener("keydown", key);
    };
  }, [at, onClose]);

  if (!at) return null;
  const shown = (items || []).filter(Boolean);
  if (shown.length === 0) return null;
  // Kept inside the window, whichever corner it was opened in.
  const left = Math.min(at.x, Math.max(8, window.innerWidth - 240));
  const top = Math.min(at.y, Math.max(8, window.innerHeight - (shown.length * 34 + 16)));

  return createPortal(
    <div
      role="menu"
      className={`dcs-menu-popover fixed border-2 shadow-lg ${tint.className || (at.dark ? "dcs-board-dark dcs-board-dark-portal" : "")}`}
      data-tinted={tint.className ? "1" : undefined}
      style={{ top, left, minWidth: 210, zIndex: 10070, backgroundColor: "var(--board-surface, #FFFFFF)", borderColor: "var(--board-border, #E0E0E0)", paddingTop: 4, paddingBottom: 4 }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {shown.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          className="dcs-db-menu-item"
          style={{ ...ITEM, ...(item.strong ? { color: "#056daa", fontWeight: 600 } : {}) }}
          onClick={() => {
            onClose();
            item.onPick();
          }}
        >
          {item.label || translate(item.labelKey)}
        </button>
      ))}
      <style>{`.dcs-db-menu-item:hover { background-color: var(--board-surface-hover, #F0F7FB) !important; }`}</style>
    </div>,
    portal_root(),
  );
}
