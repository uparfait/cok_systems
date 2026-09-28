/**
 * The small measurements a map widget needs on top of the map engine:
 * where a shape's name belongs, how far it reaches, and the one key that
 * ties a boundary to the row it carries a number for.
 *
 * MapLibre projects and draws everything else. Coordinates are kept the way
 * GeoJSON writes them, [longitude, latitude], from the server all the way
 * into the map.
 */

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

/** One box holding both: how far everything a map has been given reaches. */
export const grow_box = (box, other) => {
  if (!other) return box;
  if (!box) return { ...other };
  return {
    min_x: Math.min(box.min_x, other.min_x),
    min_y: Math.min(box.min_y, other.min_y),
    max_x: Math.max(box.max_x, other.max_x),
    max_y: Math.max(box.max_y, other.max_y),
  };
};

/** The box a scatter of points covers; a single point is given room to be seen in. */
export function points_box(points) {
  let box = null;
  (points || []).forEach((point) => {
    const x = Number(point.lng);
    const y = Number(point.lat);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    box = grow_box(box, { min_x: x, min_y: y, max_x: x, max_y: y });
  });
  if (!box) return null;
  if (box.max_x - box.min_x < 0.004) {
    box.min_x -= 0.002;
    box.max_x += 0.002;
  }
  if (box.max_y - box.min_y < 0.004) {
    box.min_y -= 0.002;
    box.max_y += 0.002;
  }
  return box;
}

/** How light a color is, 0 to 1 - what tells a dark board from a light one. */
export function lightness(color) {
  const hex = String(color || "").replace("#", "");
  if (hex.length < 6) return 1;
  const part = (at) => parseInt(hex.slice(at, at + 2), 16) / 255;
  return 0.2126 * part(0) + 0.7152 * part(2) + 0.0722 * part(4);
}

/** A box MapLibre understands: [[west, south], [east, north]]. */
export const map_bounds = (box) => (box ? [[box.min_x, box.min_y], [box.max_x, box.max_y]] : null);

/** Where a shape's name should sit: its stored anchor, else the middle of its outline. */
export function anchor_of(shape) {
  if (shape && Array.isArray(shape.anchor) && shape.anchor.length === 2) return shape.anchor;
  const box = bounds_of([shape]);
  return box ? [(box.min_x + box.max_x) / 2, (box.min_y + box.max_y) / 2] : null;
}

// The administrative words people put around a place's real name.
const NAME_PREFIXES = [/^umujyi wa /, /^intara ya /, /^intara y'/, /^akarere ka /, /^umurenge wa /, /^akagari ka /, /^umudugudu wa /, /^city of /, /^province of /, /^district of /];
const NAME_SUFFIXES = [/ city$/, / province$/, / district$/, / sector$/, / cell$/, / village$/];

/**
 * Names are matched the way the server matches them (see
 * dc_backend/util-dashboard/map_names.js), so a place always finds its
 * number: no case, no punctuation, no administrative word, and l written
 * as r - the two stand for one sound and the lists disagree on which to
 * use.
 */
export const map_key = (name) => {
  let text = String(name || "").toLowerCase().trim();
  NAME_PREFIXES.forEach((pattern) => {
    text = text.replace(pattern, "");
  });
  NAME_SUFFIXES.forEach((pattern) => {
    text = text.replace(pattern, "");
  });
  return text.replace(/[^a-z0-9]/g, "").replace(/l/g, "r");
};
