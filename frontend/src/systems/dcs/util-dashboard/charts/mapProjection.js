/**
 * A plain Web Mercator projection for the SVG map that stands in when the
 * map engine or its basemap cannot be had: the same picture MapLibre
 * draws, fitted into a box of pixels with its aspect kept.
 *
 * Coordinates come in the way GeoJSON writes them, [longitude, latitude].
 */

const RAD = Math.PI / 180;
const MAX_LAT = 85.0511;
// A box narrower than this (one point, one tiny place) is given room to be seen in.
const MIN_SPAN = 0.004;

/** One [longitude, latitude] on the Mercator plane: x and y both run 0..1, y downward. */
export function mercator(point) {
  const lng = Number(point[0]) || 0;
  const lat = Math.max(-MAX_LAT, Math.min(MAX_LAT, Number(point[1]) || 0));
  const sin = Math.sin(lat * RAD);
  return [(lng + 180) / 360, 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)];
}

/** The box, never thinner than MIN_SPAN either way. */
export function roomy_box(box) {
  const out = { min_x: box.min_x, min_y: box.min_y, max_x: box.max_x, max_y: box.max_y };
  if (out.max_x - out.min_x < MIN_SPAN) {
    out.min_x -= MIN_SPAN / 2;
    out.max_x += MIN_SPAN / 2;
  }
  if (out.max_y - out.min_y < MIN_SPAN) {
    out.min_y -= MIN_SPAN / 2;
    out.max_y += MIN_SPAN / 2;
  }
  return out;
}

/**
 * A projector that fits a geographic box { min_x, min_y, max_x, max_y }
 * into width x height pixels with padding on every side: ONE scale for
 * both axes, so nothing is stretched, and the picture centred in whatever
 * room is left over. The result projects a point to [px, py].
 */
export function fit_projection(box, width, height, padding) {
  const pad = Math.max(0, Number(padding) || 0);
  const safe = roomy_box(box);
  const [left, bottom] = mercator([safe.min_x, safe.min_y]);
  const [right, top] = mercator([safe.max_x, safe.max_y]);
  const span_x = Math.max(right - left, 1e-12);
  const span_y = Math.max(bottom - top, 1e-12);
  const room_w = Math.max(1, width - pad * 2);
  const room_h = Math.max(1, height - pad * 2);
  const scale = Math.min(room_w / span_x, room_h / span_y);
  const offset_x = pad + (room_w - span_x * scale) / 2 - left * scale;
  const offset_y = pad + (room_h - span_y * scale) / 2 - top * scale;
  const project = (point) => {
    const [mx, my] = mercator(point);
    return [mx * scale + offset_x, my * scale + offset_y];
  };
  return { project, scale, offset_x, offset_y, width, height };
}

/**
 * The same projector seen through a view: zoomed k times and moved by
 * [x, y] pixels, the way the viewer left it.
 */
export const viewed = (fit, view) => (point) => {
  const [px, py] = fit.project(point);
  return [px * view.k + view.x, py * view.k + view.y];
};

/** One ring as an SVG path: M, L..., Z. */
export function ring_path(ring, project) {
  if (!Array.isArray(ring) || ring.length < 2) return "";
  let path = "";
  ring.forEach((point, index) => {
    const [x, y] = project(point);
    path += `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  return path + "Z";
}

/** Every ring of a shape as one path, so holes and islands draw together. */
export const shape_path = (shape, project) => (shape.rings || []).map((ring) => ring_path(ring, project)).join("");

/** Where a geographic box lands on screen: { x, y, w, h } in pixels. */
export function screen_box(box, project) {
  const [x1, y1] = project([box.min_x, box.max_y]);
  const [x2, y2] = project([box.max_x, box.min_y]);
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
}

/**
 * The view that frames one screen box (as the base projection draws it)
 * with padding, zoomed no further than max_k - what a click on a marker
 * goes to.
 */
export function view_on(target, width, height, padding, max_k) {
  const room_w = Math.max(1, width - padding * 2);
  const room_h = Math.max(1, height - padding * 2);
  const k = Math.min(max_k, Math.max(1, Math.min(room_w / Math.max(target.w, 1), room_h / Math.max(target.h, 1))));
  const cx = target.x + target.w / 2;
  const cy = target.y + target.h / 2;
  return { k, x: width / 2 - cx * k, y: height / 2 - cy * k };
}

/** The view zoomed by 2^step around the middle of the frame. */
export function zoomed(view, step, width, height, max_k) {
  const k = Math.min(max_k, Math.max(1, view.k * Math.pow(2, step)));
  if (k === view.k) return view;
  const cx = width / 2;
  const cy = height / 2;
  return { k, x: cx - ((cx - view.x) * k) / view.k, y: cy - ((cy - view.y) * k) / view.k };
}

export const HOME_VIEW = { k: 1, x: 0, y: 0 };
