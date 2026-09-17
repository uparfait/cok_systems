const fs = require("fs");
const path = require("path");
const { normalize, skeleton } = require("./map_names.js");

/**
 * The administrative tree the map widget draws from, held in memory: a
 * province, its districts, their sectors, their cells, their villages, each
 * node knowing its own outline and its own children.
 *
 * It is read from the files scripts/populate_administrative_level.js writes
 * into geojson-maped/ - one file per province, each a nested tree whose keys
 * and text are numbers into a dictionary in its header. That nesting is the
 * point: a village is FOUND BY WALKING DOWN to it, never by looking its name
 * up in a flat list, because the same name comes back over and over across
 * the country and even inside one district.
 *
 * Those files carry survey grade outlines, far heavier than a screen can
 * use, so every ring is simplified once while it is read (Douglas-Peucker,
 * then rounded), level by level, and the raw coordinates are dropped.
 *
 * Where the files are looked for: GEO_MAPED_DIR alone when it is set, else
 * util-dashboard/geojson-maped (where a deployment can ship them) and then
 * geojson-maped beside the backend, where the script writes them. When no
 * province file is found, the older flat files in util-dashboard/geo are
 * turned into the same tree by their parent names, so a deployment without
 * the new files still draws.
 */

const MAP_LEVELS = ["province", "district", "sector", "cell", "village"];

// How hard each level's outlines are simplified (degrees; 0.0001 is about
// 11 metres) and what its children are called in the province files.
const LEVELS = [
  { key: "province", name_key: "province_name", child_key: "districts", tolerance: 0.0004 },
  { key: "district", name_key: "district_name", child_key: "sectors", tolerance: 0.0003 },
  { key: "sector", name_key: "sector_name", child_key: "cells", tolerance: 0.0002 },
  { key: "cell", name_key: "cell_name", child_key: "villages", tolerance: 0.00015 },
  { key: "village", name_key: "village_name", child_key: null, tolerance: 0.00008 },
];

const DECIMALS = 5;
const round = (value) => Number(value.toFixed(DECIMALS));

const SEARCH_DIRS = process.env.GEO_MAPED_DIR ? [process.env.GEO_MAPED_DIR] : [path.join(__dirname, "geojson-maped"), path.resolve(__dirname, "../../geojson-maped")];
const FLAT_DIR = path.join(__dirname, "geo");

let cached = null;

/** Perpendicular distance of a point from the line through two others. */
function distance(point, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (dx === 0 && dy === 0) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  const t = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point[0] - (start[0] + t * dx), point[1] - (start[1] + t * dy));
}

/** Douglas-Peucker, iterative so a ring of 100k points cannot blow the stack. */
function simplify(ring, tolerance) {
  if (!Array.isArray(ring) || ring.length < 4) return ring || [];
  const keep = new Array(ring.length).fill(false);
  keep[0] = true;
  keep[ring.length - 1] = true;
  const stack = [[0, ring.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop();
    let worst = 0;
    let index = -1;
    for (let i = first + 1; i < last; i += 1) {
      const gap = distance(ring[i], ring[first], ring[last]);
      if (gap > worst) {
        worst = gap;
        index = i;
      }
    }
    if (index > 0 && worst > tolerance) {
      keep[index] = true;
      stack.push([first, index], [index, last]);
    }
  }
  const out = ring.filter((point, index) => keep[index]).map(([x, y]) => [round(x), round(y)]);
  if (out.length < 4) return ring.map(([x, y]) => [round(x), round(y)]);
  const first = out[0];
  const last = out[out.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) out.push([first[0], first[1]]);
  return out;
}

/** A polygon or multipolygon as a plain list of outer rings. */
function rings_of(type, coordinates) {
  if (!Array.isArray(coordinates)) return [];
  if (type === "Polygon") return [coordinates[0]];
  if (type === "MultiPolygon") return coordinates.map((polygon) => polygon[0]);
  return [];
}

/**
 * One province file turned into light nodes. The file writes every key and
 * every text as its number in meta.dict, so the keys this reads are looked
 * up once and the encoded objects are walked directly - decoding the whole
 * document first would cost several times the memory for nothing.
 */
function read_province(file) {
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  const dict = (doc.meta && doc.meta.dict) || [];
  const id = new Map();
  dict.forEach((text, index) => {
    if (!id.has(text)) id.set(text, index);
  });
  const get = (node, key) => (id.has(key) ? node[id.get(key)] : undefined);

  const node_of = (encoded, depth) => {
    const level = LEVELS[depth];
    const name = String(dict[get(encoded, level.name_key)] || "").trim();
    const geometry = get(encoded, "geometry") || {};
    const type = dict[get(geometry, "type")];
    const anchor = get(encoded, "anchor");
    const children = level.child_key ? get(encoded, level.child_key) || [] : [];
    return {
      level: level.key,
      name,
      key: normalize(name),
      skel: skeleton(name),
      anchor: Array.isArray(anchor) ? [round(anchor[0]), round(anchor[1])] : null,
      rings: rings_of(type, get(geometry, "coordinates")).map((ring) => simplify(ring, level.tolerance)),
      children: children.map((child) => node_of(child, depth + 1)),
    };
  };
  return doc.province ? node_of(doc.province, 0) : null;
}

/** The country outline behind everything, from rwanda.geojson when it is there. */
function read_outline(dir) {
  const file = path.join(dir, "rwanda.geojson");
  if (!fs.existsSync(file)) return null;
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  const dict = (doc.meta && doc.meta.dict) || [];
  const id = new Map(dict.map((text, index) => [text, index]));
  const get = (node, key) => (id.has(key) ? node[id.get(key)] : undefined);
  const country = doc.country;
  if (!country) return null;
  const geometry = get(country, "geometry") || {};
  const rings = rings_of(dict[get(geometry, "type")], get(geometry, "coordinates"))
    .map((ring) => simplify(ring, 0.004))
    // Lake islets and specks add nothing to a backdrop outline.
    .filter((ring) => ring.length > 40);
  return { name: String(dict[get(country, "country_name")] || ""), rings };
}

/** The older flat files, hung into the same tree by their parent names. */
function read_flat() {
  const read = (level) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(FLAT_DIR, `${level}.json`), "utf8")).shapes || [];
    } catch (error) {
      return [];
    }
  };
  const nodes = {};
  MAP_LEVELS.forEach((level) => {
    nodes[level] = read(level).map((shape) => ({ level, name: shape.name, key: normalize(shape.name), skel: skeleton(shape.name), anchor: shape.anchor || null, rings: shape.rings || [], parent: shape.parent || "", children: [] }));
  });
  MAP_LEVELS.forEach((level, index) => {
    if (index === 0) return;
    const above = new Map();
    nodes[MAP_LEVELS[index - 1]].forEach((node) => above.set(node.key, node));
    nodes[level].forEach((node) => {
      const holder = above.get(normalize(node.parent));
      if (holder) holder.children.push(node);
    });
  });
  let outline = null;
  const country = read("country")[0];
  if (country) outline = { name: country.name, rings: country.rings || [] };
  return { provinces: nodes.province, outline };
}

/** Every province tree that can be found, read and simplified once. */
function load_tree() {
  if (cached) return cached;
  const dir = SEARCH_DIRS.filter(Boolean).find((entry) => {
    try {
      return fs.readdirSync(entry).some((name) => name.endsWith(".geojson") && name !== "rwanda.geojson");
    } catch (error) {
      return false;
    }
  });
  if (dir) {
    const provinces = fs
      .readdirSync(dir)
      .filter((name) => name.endsWith(".geojson") && name !== "rwanda.geojson")
      .map((name) => read_province(path.join(dir, name)))
      .filter(Boolean);
    if (provinces.length > 0) {
      cached = { source: dir, provinces, outline: read_outline(dir) };
      return cached;
    }
  }
  const flat = read_flat();
  cached = { source: FLAT_DIR, provinces: flat.provinces, outline: flat.outline };
  return cached;
}

module.exports = {
  MAP_LEVELS,
  load_tree,
};
