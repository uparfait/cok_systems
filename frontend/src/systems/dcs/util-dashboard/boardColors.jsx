import React, { createContext, useContext, useMemo } from "react";
import { opaque_color, luminance, readable_on } from "./appearance.js";

/**
 * THE COLORS ONE DASHBOARD IS PAINTED IN - the board's own look, saved
 * with the board and shared with it.
 *
 * Two colors are set: the BACKGROUND, which the page and every widget on
 * it are painted in so the board reads as one surface, and the BORDER,
 * the outline each widget draws around itself - which is what still tells
 * one card from the next once they share a background. A third, the color
 * of the words, is worked out from the background and may be overridden.
 *
 * Everything else follows from those: muted labels, chart grids, empty
 * areas and hover tints are all the background moved a measured distance
 * towards the text color, so a board colored dark gets pale grids and one
 * colored pale gets dark ones - nothing is ever written in a color nobody
 * can see (see readable_on in appearance.js).
 *
 * A widget that sets its OWN background or border keeps it: the board's
 * colors are what every widget follows unless it was told otherwise.
 */

export const BOARD_COLOR_KEYS = ["background", "border", "text"];

/** Two colors blended, `weight` (0 to 1) of the second. */
function mix(one, other, weight) {
  const a = opaque_color(one) || "#ffffff";
  const b = opaque_color(other) || "#000000";
  const part = (at) => {
    const from = parseInt(a.slice(at, at + 2), 16);
    const to = parseInt(b.slice(at, at + 2), 16);
    return Math.round(from + (to - from) * Math.max(0, Math.min(1, weight)))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${part(1)}${part(3)}${part(5)}`;
}

/** The words this background carries, when the author named no color. */
export const auto_text = (background) => readable_on(background, null);

/**
 * The outline that separates cards on this background, when the author
 * named no color: the background a quarter of the way towards its own
 * text, which is visible on any background without shouting on any.
 */
export const auto_border = (background) => mix(background, auto_text(background), 0.28);

/**
 * The board's saved colors turned into everything the page and its
 * widgets paint with - or null when the board was never colored, which
 * leaves the system's own light and dark looks in charge.
 */
export function resolve_board_colors(raw) {
  const background = raw && typeof raw === "object" ? opaque_color(raw.background) : null;
  if (!background) return null;
  const text = (raw.text && opaque_color(raw.text)) || auto_text(background);
  const border = (raw.border && opaque_color(raw.border)) || auto_border(background);
  return {
    background,
    // A widget is painted in the board's own color: the board is one
    // surface, and the outline is what draws the cards on it.
    surface: background,
    surface_hover: mix(background, text, 0.08),
    border,
    text,
    muted: mix(background, text, 0.6),
    grid: mix(background, text, 0.16),
    soft: mix(background, text, 0.06),
    empty: mix(background, text, 0.09),
    // Which color SET the widgets draw with: a dark board wants the dark
    // one, whatever mode the viewer's own switch is on.
    is_dark: luminance(background) < 0.45,
  };
}

/** The variables the whole page reads its colors from, for the board's root element. */
export function board_css_vars(colors) {
  if (!colors) return undefined;
  return {
    "--board-bg": colors.background,
    "--board-surface": colors.surface,
    "--board-surface-hover": colors.surface_hover,
    "--board-border": colors.border,
    "--board-text": colors.text,
    "--board-muted": colors.muted,
  };
}

/** True when this board carries colors of its own. */
export const has_board_colors = (raw) => !!resolve_board_colors(raw);

/**
 * A panel PORTALLED out of the board (a menu, a dialog, a drill overlay)
 * sits beside the board in the page, so it cannot inherit the variables
 * written onto the board's own element - it has to carry them itself. This
 * is the class and the style such a panel spreads onto its own element.
 */
export function portal_tint(colors) {
  if (!colors) return { className: "", style: undefined };
  return { className: colors.is_dark ? "dcs-board-dark dcs-board-dark-portal" : "dcs-board-tinted-portal", style: board_css_vars(colors) };
}

const BoardColorsContext = createContext(null);

/**
 * The open board's colors, for everything drawn inside it - the cards, the
 * charts, the header, the menus and the overlays alike. Given nothing, the
 * board keeps the system's own look and every widget its own.
 */
export function BoardColorsProvider({ colors, children }) {
  const value = useMemo(() => resolve_board_colors(colors), [colors]);
  return <BoardColorsContext.Provider value={value}>{children}</BoardColorsContext.Provider>;
}

export const useBoardColors = () => useContext(BoardColorsContext);
