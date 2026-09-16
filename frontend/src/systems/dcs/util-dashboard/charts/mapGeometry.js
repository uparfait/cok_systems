/**
 * Turning boundary outlines into something an SVG can draw. The City of
 * Kigali spans about half a degree, so a plain equirectangular projection
 * is exact enough - longitudes only need the cosine of the latitude to keep
 * the city from looking stretched sideways.
 *
 * Everything here is pure: the same shapes always project to the same box,
 * which is what lets the labels and the markers sit exactly on top of the
 * paths they belong to.
 */

const RADIANS = Math.PI / 180;

export function bounds_of(groups) {
  let min_x = Infinity;
  let min_y = Infinity;
  let max_x = -Infinity;
  let max_y = -Infinity;
  (groups || []).forEach((shape) =>
    (shape.rings || []).forEach((ring) =>
      ring.forEach(([x, y]) => {
        if (x < min_x) min_x = x;
        if (y < min_y) min_y = y;
        if (x > max_x) max_x = x;
        if (y > max_y) max_y = y;
      }),
    ),
  );
  if (min_x === Infinity) return null;
  return { min_x, min_y, max_x, max_y };
}

/**
 * A projection fitting `bounds` into a width x height box, keeping the
 * aspect right and centring what is left over. Returns point(), path() and
 * the box it filled.
 */
export function make_projection(bounds, width, height, padding) {
  const pad = padding === undefined ? 8 : padding;
  const box_w = Math.max(1, width - pad * 2);
  const box_h = Math.max(1, height - pad * 2);
  if (!bounds) return { point: () => [0, 0], path: () => "", scale: 1 };
  const mid_lat = (bounds.min_y + bounds.max_y) / 2;
  const stretch = Math.cos(mid_lat * RADIANS) || 1;
  const span_x = Math.max(1e-9, (bounds.max_x - bounds.min_x) * stretch);
  const span_y = Math.max(1e-9, bounds.max_y - bounds.min_y);
  const scale = Math.min(box_w / span_x, box_h / span_y);
  const offset_x = pad + (box_w - span_x * scale) / 2;
  const offset_y = pad + (box_h - span_y * scale) / 2;
  const point = ([x, y]) => [offset_x + (x - bounds.min_x) * stretch * scale, offset_y + (bounds.max_y - y) * scale];
  const path = (rings) =>
    (rings || [])
      .map((ring) => {
        if (!ring || ring.length < 3) return "";
        return (
          ring
            .map((coordinate, index) => {
              const [px, py] = point(coordinate);
              return `${index === 0 ? "M" : "L"}${px.toFixed(1)} ${py.toFixed(1)}`;
            })
            .join(" ") + " Z"
        );
      })
      .filter(Boolean)
      .join(" ");
  return { point, path, scale };
}

/** Where a shape's name should sit: its stored anchor, else the middle of its outline. */
export function anchor_of(shape) {
  if (shape && Array.isArray(shape.anchor) && shape.anchor.length === 2) return shape.anchor;
  const box = bounds_of([shape]);
  return box ? [(box.min_x + box.max_x) / 2, (box.min_y + box.max_y) / 2] : null;
}

/** How wide a shape draws, in pixels - a name is only written when it fits. */
export function shape_width(shape, projection) {
  const box = bounds_of([shape]);
  if (!box) return 0;
  const [left] = projection.point([box.min_x, box.max_y]);
  const [right] = projection.point([box.max_x, box.min_y]);
  return Math.abs(right - left);
}

/** How tall a shape draws, in pixels. */
export function shape_height(shape, projection) {
  const box = bounds_of([shape]);
  if (!box) return 0;
  const [, top] = projection.point([box.min_x, box.max_y]);
  const [, bottom] = projection.point([box.max_x, box.min_y]);
  return Math.abs(bottom - top);
}

/** Names are matched the way the server matches them, so a label always finds its value. */
export const map_key = (name) =>
  String(name || "")
    .toLowerCase()
    .replace(/^city of /, "")
    .replace(/ city$/, "")
    .replace(/[^a-z0-9]/g, "");
