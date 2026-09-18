const { load_tree } = require("../util-dashboard/map_tree.js");
const { normalize } = require("../util-dashboard/map_names.js");

/**
 * Where a generated GPS point may fall. The dashboard already holds the
 * simplified outline of every administrative place of the City of Kigali
 * (see util-dashboard/map_tree.js, read from geojson-maped/, the same
 * geoBoundaries source as geojson-files/); this walks that tree by the
 * record's own location answers (province, district, sector, cell,
 * village) and draws a point INSIDE the deepest place found. A record that
 * names no place, or a place with no shape, gets a point inside the City of
 * Kigali itself - never a random point somewhere in the country.
 */

const KIGALI_KEY = normalize("City of Kigali");
const MAX_TRIES = 60;
const RESOLVED_CACHE = new Map();

function bounds_of(rings) {
  let min_x = Infinity;
  let min_y = Infinity;
  let max_x = -Infinity;
  let max_y = -Infinity;
  rings.forEach((ring) =>
    ring.forEach(([x, y]) => {
      if (x < min_x) min_x = x;
      if (x > max_x) max_x = x;
      if (y < min_y) min_y = y;
      if (y > max_y) max_y = y;
    }),
  );
  return Number.isFinite(min_x) ? { min_x, min_y, max_x, max_y } : null;
}

/** Ray casting: is the point inside this ring. */
function inside_ring(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

const inside_shape = (rings, x, y) => rings.some((ring) => inside_ring(ring, x, y));

/** The Kigali province node of the outline tree, or null when no outlines are shipped. */
function kigali_node() {
  const tree = load_tree();
  const provinces = (tree && tree.provinces) || [];
  return provinces.find((node) => node.key === KIGALI_KEY || /kigari|kigali/.test(node.key)) || provinces[0] || null;
}

/**
 * The deepest node the path names, walking down from the province: a path
 * ["Umujyi wa Kigali", "Gasabo", "Remera", "Nyabisindu"] resolves to the
 * Nyabisindu cell when it has a shape, else stops at Remera. Names are
 * compared through the map's own normalizer, so the Kinyarwanda spelling of
 * the location list meets the English spelling of the boundary files.
 */
function resolve_node(path) {
  const key = (path || []).map((name) => normalize(name)).join("/");
  if (RESOLVED_CACHE.has(key)) return RESOLVED_CACHE.get(key);
  let node = kigali_node();
  const names = (path || []).slice(1);
  for (const name of names) {
    if (!node) break;
    const wanted = normalize(name);
    const child = (node.children || []).find((entry) => entry.key === wanted);
    if (!child) break;
    node = child;
  }
  RESOLVED_CACHE.set(key, node);
  return node;
}

/**
 * A random point inside the node's outline: rejection sampling inside its
 * bounding box, falling back to its anchor (which the map places inside
 * the shape) when the outline is too thin to hit.
 */
function point_inside(node) {
  if (!node) return null;
  const rings = (node.rings || []).filter((ring) => Array.isArray(ring) && ring.length >= 4);
  const box = bounds_of(rings);
  if (box) {
    for (let attempt = 0; attempt < MAX_TRIES; attempt += 1) {
      const x = box.min_x + Math.random() * (box.max_x - box.min_x);
      const y = box.min_y + Math.random() * (box.max_y - box.min_y);
      if (inside_shape(rings, x, y)) return { longitude: x, latitude: y };
    }
  }
  if (Array.isArray(node.anchor) && node.anchor.length === 2) return { longitude: node.anchor[0], latitude: node.anchor[1] };
  return null;
}

/**
 * The full geolocation answer for one record: a point inside the deepest
 * place its path names (or inside Kigali), the place names themselves as
 * the address fields, and a plausible accuracy. path is
 * [province, district, sector, cell, village], any tail may be missing.
 */
function sample_geolocation(path) {
  const trail = Array.isArray(path) ? path.filter((name) => name !== undefined && name !== null && String(name).trim() !== "") : [];
  const node = resolve_node(trail);
  const city = kigali_node();
  // A simplified sector outline can poke a little past the simplified city
  // outline: a point that lands there is redrawn, so every point is inside
  // the City of Kigali as the map draws it.
  let point = null;
  for (let attempt = 0; attempt < 5 && !point; attempt += 1) {
    const candidate = point_inside(node);
    if (candidate && (!city || inside_shape(city.rings || [], candidate.longitude, candidate.latitude))) point = candidate;
  }
  if (!point) point = point_inside(city) || { longitude: 30.0619, latitude: -1.9441 };
  const [province, district, sector, cell, village] = trail;
  const parts = [village, cell, sector, district].filter(Boolean);
  return {
    latitude: Number(point.latitude.toFixed(6)),
    longitude: Number(point.longitude.toFixed(6)),
    accuracy: 3 + Math.floor(Math.random() * 25),
    province: province || "Umujyi wa Kigali",
    district: district || "",
    sector: sector || "",
    cell: cell || "",
    village: village || "",
    street: `KN ${1 + Math.floor(Math.random() * 250)} St`,
    full_address: `${parts.join(", ")}${parts.length > 0 ? ", " : ""}${province || "Umujyi wa Kigali"}, Rwanda`,
  };
}

/** Whether a point lies inside the City of Kigali outline - used by the proofs. */
function inside_kigali(longitude, latitude) {
  const node = kigali_node();
  return !!node && inside_shape(node.rings || [], longitude, latitude);
}

module.exports = {
  sample_geolocation,
  resolve_node,
  inside_shape,
  inside_kigali,
};
