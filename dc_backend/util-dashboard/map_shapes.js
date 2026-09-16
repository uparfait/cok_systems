const fs = require("fs");
const path = require("path");

/**
 * The outlines a map widget draws. The raw geoBoundaries files are far too
 * large to ship or to read per request, so scripts/build_kigali_geo.js
 * reduced them once to the City of Kigali alone - every district, sector,
 * cell and village inside it, each linked to the shape above it and
 * simplified to what a screen can draw. This module holds those files in
 * memory and answers with ONLY the shapes a widget asked for by name, plus
 * the chain of parents above them (each drawn in its own color) and the
 * country outline behind everything.
 *
 * Names come from the answers people gave, so they are matched loosely:
 * case, spaces and punctuation are ignored, and "Kigali City" finds "City
 * of Kigali".
 */

const GEO_DIR = path.join(__dirname, "geo");
const MAP_LEVELS = ["province", "district", "sector", "cell", "village"];
const PARENT_OF = { village: "cell", cell: "sector", sector: "district", district: "province", province: null };
const MAX_NAMES = 2000;
// A level small enough to draw whole when a widget names nothing.
const WHOLE_LEVEL_MAX = 200;

const cache = new Map();

function load(level) {
  if (cache.has(level)) return cache.get(level);
  const file = path.join(GEO_DIR, `${level}.json`);
  let parsed = { level, shapes: [] };
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    parsed = { level, shapes: [] };
  }
  const by_key = new Map();
  parsed.shapes.forEach((shape) => by_key.set(normalize(shape.name), shape));
  const entry = { shapes: parsed.shapes, by_key };
  cache.set(level, entry);
  return entry;
}

function normalize(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/^city of /, "")
    .replace(/ city$/, "")
    .replace(/[^a-z0-9]/g, "");
}

const strip = (shape) => ({ name: shape.name, parent: shape.parent || "", anchor: shape.anchor || null, rings: shape.rings });

/**
 * { level, shapes, parents, outline }: the named shapes of one level, the
 * parents that hold them (immediate parent first, up to the province) and,
 * when asked for, the country outline behind them. Unknown names are
 * reported back so the widget can say which answers have no shape on the
 * map.
 */
function map_shapes(level, names, with_outline) {
  if (!MAP_LEVELS.includes(level)) return null;
  const entry = load(level);
  const wanted = Array.isArray(names) ? Array.from(new Set(names.map((name) => normalize(name)).filter(Boolean))).slice(0, MAX_NAMES) : [];
  const unknown = [];
  let shapes = [];
  if (wanted.length === 0) {
    shapes = entry.shapes.length <= WHOLE_LEVEL_MAX ? entry.shapes : [];
  } else {
    wanted.forEach((key) => {
      const shape = entry.by_key.get(key);
      if (shape) shapes.push(shape);
      else unknown.push(key);
    });
  }

  // Every parent that holds one of these shapes, level by level upwards.
  const parents = [];
  let child_level = level;
  let child_names = new Set(shapes.map((shape) => normalize(shape.parent)));
  while (PARENT_OF[child_level]) {
    const parent_level = PARENT_OF[child_level];
    const parent_entry = load(parent_level);
    const picked = parent_entry.shapes.filter((shape) => child_names.size === 0 || child_names.has(normalize(shape.name)));
    parents.push({ level: parent_level, shapes: picked.map(strip) });
    child_names = new Set(picked.map((shape) => normalize(shape.parent)));
    child_level = parent_level;
  }

  const country = with_outline ? load("country") : { shapes: [] };
  return {
    level,
    shapes: shapes.map(strip),
    parents,
    outline: country.shapes[0] ? { name: country.shapes[0].name, rings: country.shapes[0].rings } : null,
    unknown,
  };
}

module.exports = {
  MAP_LEVELS,
  map_shapes,
  normalize_shape_name: normalize,
};
