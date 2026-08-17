export const PIXEL_SIZED_TYPES = ["shape", "image_block"];

/**
 * Turns a field's own size/position into the outer (alignment) and inner
 * (the component's own box) styles for the div that wraps it.
 *
 * Two different sizing models, on purpose:
 * - Shape and Image are objects with their own real size (width_px /
 *   height_px, already read directly by ShapeBlock/ImageBlock) - resizing
 *   them means changing THAT size, in pixels, exactly like resizing an
 *   image or a shape in any design tool. Position is a pixel offset
 *   (offset_px) from the left edge of the row.
 * - Header, paragraph, file and horizontal line are text/line blocks with
 *   no independent size of their own - their "size" IS how wide their
 *   column is, so width_percent/offset_percent (relative to the row)
 *   already describes their own box correctly.
 *
 * Data fields never set any of this, so they default to flush-left, full
 * width - unchanged from before. Shared by the live renderer and the
 * builder canvas so a component sits exactly where it will end up once
 * published.
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
  const inner_style = {};

  if (PIXEL_SIZED_TYPES.includes(field && field.type)) {
    inner_style.marginLeft = `${field.offset_px || 0}px`;
  } else {
    const width_percent = design.width_percent ? design.width_percent : 100;
    const offset_percent = design.offset_percent ? design.offset_percent : 0;
    inner_style.width = `${width_percent}%`;
    inner_style.marginLeft = `${(offset_percent * (100 - width_percent)) / 100}%`;
  }

  if (design.background_color) inner_style.backgroundColor = design.background_color;
  if (design.border_enabled) inner_style.border = `${design.border_width || 1}px solid ${design.border_color || "#E0E0E0"}`;
  if (inner_style.backgroundColor || inner_style.border) inner_style.padding = "0.75rem";
  return { outer_style, inner_style };
}
