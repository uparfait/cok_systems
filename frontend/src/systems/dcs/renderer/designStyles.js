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
  if (inner_style.backgroundColor || inner_style.border) inner_style.padding = "0.75rem";
  return { outer_style, inner_style };
}
