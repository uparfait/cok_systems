export const DEFAULT_SPACING_BELOW_PX = 16;

/**
 * The gap left below one component before the next, in pixels. Authored
 * per field (Designs tab) rather than a single hardcoded value shared by
 * every component, so a component the author gave 500px of breathing room
 * keeps exactly that - in the builder canvas and in the live render alike -
 * while every other component keeps whatever it was individually given.
 */
export function get_spacing_below_px(field) {
  const design = (field && field.design) || {};
  const value = Number(design.spacing_below_px);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_SPACING_BELOW_PX;
}

/**
 * Turns a field's own design settings into the outer (alignment) and inner
 * (the component's own box) styles for the div that wraps it. Only ever
 * used for the top-level field list - a component living directly in the
 * form, outside any Section canvas - which always auto-fills the full row
 * width; there is no per-field resize or reposition out here at all, on
 * purpose (that is what a Section's own free-position canvas is for).
 * width_percent/offset_percent/width_px/offset_px are intentionally never
 * read here for that reason, even if an old schema still carries them from
 * before this was locked down. Shared by the live renderer and the builder
 * canvas so a component sits exactly where it will end up once published.
 */
export function build_design_styles(field) {
  const design = (field && field.design) || {};

  if (design.full_device_width) {
    return {
      outer_style: undefined,
      inner_style: {
        width: "100vw",
        position: "relative",
        left: "50%",
        right: "50%",
        marginLeft: "-50vw",
        marginRight: "-50vw",
      },
    };
  }

  const outer_style = { position: "relative", width: "100%" };
  const inner_style = { width: "100%", marginLeft: 0 };

  if (design.background_color) inner_style.backgroundColor = design.background_color;
  if (design.border_enabled) inner_style.border = `${design.border_width || 1}px solid ${design.border_color || "#E0E0E0"}`;
  else if (design.background_color) inner_style.border = `1px solid ${frame_tone(design.background_color)}`;
  if (inner_style.backgroundColor || inner_style.border) inner_style.padding = "0.75rem";
  return { outer_style, inner_style };
}

const FRAME_SHADE = 0.18;

/**
 * A text block given a background is framed in a slightly deeper tone of
 * that same color, so the tinted box reads as a card with an edge instead
 * of a smear of color. Only hex backgrounds can be shaded; anything else
 * falls back to the neutral border every other box uses.
 */
export function frame_tone(color) {
  const hex = String(color || "").trim();
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!match) return "#E0E0E0";
  const raw = match[1].length === 3 ? match[1].split("").map((c) => c + c).join("") : match[1];
  const channels = [0, 2, 4].map((at) => parseInt(raw.slice(at, at + 2), 16));
  const shaded = channels.map((value) => Math.round(value * (1 - FRAME_SHADE)));
  return "#" + shaded.map((value) => value.toString(16).padStart(2, "0")).join("");
}
