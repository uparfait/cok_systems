/**
 * Writes the whole administrative tree of ONE province as a single file:
 * the province with its districts, each district with its sectors, each
 * sector with its cells and each cell with its villages, every level
 * carrying all of its own attributes and its own geometry.
 *
 * The raw geoBoundaries files (geojson-files/geoBoundaries-RWA-ADM*.geojson)
 * hold one flat list per level and no link at all between a shape and the
 * shape above it, so the tree is built by where the shapes lie: a child
 * belongs to the parent whose outline contains the child's anchor, a point
 * that is really inside the child (the centroid of its largest ring, or a
 * point walked towards it when the shape is crescent shaped). The files are
 * far too large to parse whole, so each is streamed one feature per line and
 * only the features of this province are ever kept.
 *
 * Repeated text would dominate the result - every node repeats the same
 * attribute names, and "RWA", "Polygon" or "ADM5" come back thousands of
 * times - so the document is written with a dictionary in its header: every
 * object key and every text value is stored once in meta.dict and written in
 * the tree as its NUMBER in that list. The keys listed in meta.raw_keys
 * ("coordinates", "anchor") hold real numbers and are left alone. To read
 * the file back, replace every key, and every number that is not under one
 * of those keys, by meta.dict[number].
 *
 * Run with: node dc_backend/scripts/populate_administrative_level.js "City of Kigali"
 * Options:  --decimals=6  how far coordinates are rounded (6 is about 0.1 m)
 * Writes:   geojson-maped/<province>.geojson, and geojson-maped/rwanda.geojson
 *           (the country, ADM0, plus an index of the provinces) when that one
 *           does not exist yet.
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { normalize } = require("../util-dashboard/map_names.js");

const SOURCE_DIR = path.resolve(__dirname, "../../geojson-files");
const OUT_DIR = path.resolve(__dirname, "../../geojson-maped");

// One entry per administrative level: the file it comes from, what its own
// name is called in the result and what its children are called.
const LEVELS = [
  { key: "province", file: "ADM1", name_key: "province_name", child_key: "districts" },
  { key: "district", file: "ADM2", name_key: "district_name", child_key: "sectors" },
  { key: "sector", file: "ADM3", name_key: "sector_name", child_key: "cells" },
  { key: "cell", file: "ADM4", name_key: "cell_name", child_key: "villages" },
  { key: "village", file: "ADM5", name_key: "village_name", child_key: null },
];

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const hit = args.find((entry) => entry.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const asked_province = args.filter((entry) => !entry.startsWith("--")).join(" ").trim();
const DECIMALS = Math.min(15, Math.max(0, Number(option("decimals", 6)) || 6));
const round = (value) => Number(value.toFixed(DECIMALS));
const slug = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Every feature of one geoBoundaries file, read one line at a time. */
async function each_feature(file, visit) {
  const stream = fs.createReadStream(path.join(SOURCE_DIR, `geoBoundaries-RWA-${file}.geojson`));
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of lines) {
    const text = line.trim().replace(/,$/, "");
    if (text.slice(0, 19) !== '{ "type": "Feature"') continue;
    visit(JSON.parse(text));
  }
}

/** A polygon or multipolygon as a plain list of outer rings. */
function rings_of(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates[0]];
  if (geometry.type === "MultiPolygon") return geometry.coordinates.map((polygon) => polygon[0]);
  return [];
}

function bbox_of(rings) {
  let min_x = Infinity;
  let min_y = Infinity;
  let max_x = -Infinity;
  let max_y = -Infinity;
  rings.forEach((ring) =>
    ring.forEach(([x, y]) => {
      if (x < min_x) min_x = x;
      if (y < min_y) min_y = y;
      if (x > max_x) max_x = x;
      if (y > max_y) max_y = y;
    }),
  );
  return [min_x, min_y, max_x, max_y];
}

const in_bbox = ([x, y], box) => x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3];

/** Ray casting against every ring of a shape. */
function inside(point, rings) {
  return rings.some((ring) => {
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  });
}

/**
 * A point that is really inside the shape: the centroid of its largest ring
 * when that lands inside, else a point walked from a vertex towards it - a
 * crescent shaped sector must not be handed to its neighbour.
 */
function anchor_of(rings) {
  const ring = rings.reduce((best, entry) => (entry.length > best.length ? entry : best), rings[0] || []);
  if (ring.length === 0) return [0, 0];
  let x = 0;
  let y = 0;
  ring.forEach(([px, py]) => {
    x += px;
    y += py;
  });
  const centroid = [x / ring.length, y / ring.length];
  if (inside(centroid, rings)) return centroid;
  for (let step = 1; step <= 8; step += 1) {
    const share = step / 9;
    const candidate = [ring[0][0] + (centroid[0] - ring[0][0]) * share, ring[0][1] + (centroid[1] - ring[0][1]) * share];
    if (inside(candidate, rings)) return candidate;
  }
  return centroid;
}

/** Coordinates, at whatever precision was asked for, at any nesting depth. */
function round_coords(value) {
  return typeof value === "number" ? round(value) : value.map(round_coords);
}

const geometry_of = (feature) => ({
  type: feature.geometry.type,
  coordinates: round_coords(feature.geometry.coordinates),
});

/** One place: its name, all of its own attributes, its geometry, its children. */
function node_of(feature, level, anchor) {
  const properties = feature.properties || {};
  const node = {
    [level.name_key]: String(properties.shapeName || "").trim(),
    level: level.key,
    shape_id: String(properties.shapeID || ""),
    shape_iso: String(properties.shapeISO || ""),
    shape_group: String(properties.shapeGroup || ""),
    shape_type: String(properties.shapeType || ""),
    anchor: [round(anchor[0]), round(anchor[1])],
    geometry: geometry_of(feature),
  };
  if (level.child_key) node[level.child_key] = [];
  return node;
}

/**
 * Every shape of one level that falls inside one of the parents given, hung
 * under the parent that holds it. Returns the kept shapes, which are the
 * parents of the level below.
 */
async function collect(level, parent_level, parents) {
  const kept = [];
  let scanned = 0;
  await each_feature(level.file, (feature) => {
    scanned += 1;
    const rings = rings_of(feature.geometry);
    if (rings.length === 0) return;
    const anchor = anchor_of(rings);
    const holder = parents.find((entry) => in_bbox(anchor, entry.box) && inside(anchor, entry.rings));
    if (!holder) return;
    const node = node_of(feature, level, anchor);
    holder.node[parent_level.child_key].push(node);
    kept.push({ node, rings, box: bbox_of(rings) });
  });
  console.log(`${level.key}: ${kept.length} kept of ${scanned} in ${level.file}`);
  return kept;
}

/** Children in name order, so two runs write the same file. */
function sort_tree(node) {
  const level = LEVELS.find((entry) => entry.key === node.level);
  if (!level || !level.child_key) return;
  const child_level = LEVELS[LEVELS.indexOf(level) + 1];
  node[level.child_key].sort((left, right) => String(left[child_level.name_key]).localeCompare(String(right[child_level.name_key])));
  node[level.child_key].forEach(sort_tree);
}

// What these keys hold is measurements, not text: they are written as they
// are, and a reader must not look them up in the dictionary.
const RAW_KEYS = ["coordinates", "anchor"];

/**
 * The tree with every key and every text value replaced by its number in a
 * dictionary, which is returned with it. Coordinates and anchors stay
 * numbers: they hold no text and nothing would be saved by listing them.
 */
function encode(tree) {
  const dict = [];
  const seen = new Map();
  const id_of = (text) => {
    if (!seen.has(text)) {
      seen.set(text, dict.length);
      dict.push(text);
    }
    return seen.get(text);
  };
  const walk = (value) => {
    if (typeof value === "string") return id_of(value);
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object") {
      const out = {};
      Object.keys(value).forEach((key) => {
        out[id_of(key)] = RAW_KEYS.includes(key) ? value[key] : walk(value[key]);
      });
      return out;
    }
    return value;
  };
  return { data: walk(tree), dict };
}

const ENCODING =
  "every object key and every text value is the index of that text in meta.dict; " +
  "numbers under the keys named in meta.raw_keys are themselves";

function write_document(file, root, tree, extra) {
  const { data, dict } = encode(tree);
  const meta = {
    format: "geojson-maped/1",
    generated_at: new Date().toISOString(),
    source: "geoBoundaries RWA ADM0 to ADM5",
    crs: "urn:ogc:def:crs:OGC:1.3:CRS84",
    decimals: DECIMALS,
    root,
    encoding: ENCODING,
    raw_keys: RAW_KEYS,
    ...extra,
    dict,
  };
  fs.writeFileSync(file, JSON.stringify({ meta, [root]: data }));
  console.log(`wrote ${path.basename(file)}: ${Math.round(fs.statSync(file).size / 1024)} KB, ${dict.length} texts in the dictionary`);
}

/** How many places the tree holds, level by level. */
function counts_of(province) {
  const counts = {};
  const walk = (node) => {
    const level = LEVELS.find((entry) => entry.key === node.level);
    counts[level.key] = (counts[level.key] || 0) + 1;
    if (level.child_key) node[level.child_key].forEach(walk);
  };
  walk(province);
  return counts;
}

/** The country itself, plus where each province was written, written once. */
async function write_country(provinces) {
  const file = path.join(OUT_DIR, "rwanda.geojson");
  if (fs.existsSync(file)) {
    console.log("rwanda.geojson is already there, left as it is");
    return;
  }
  let country = null;
  await each_feature("ADM0", (feature) => {
    if (country) return;
    const properties = feature.properties || {};
    country = {
      country_name: String(properties.shapeName || "").trim(),
      level: "country",
      shape_id: String(properties.shapeID || ""),
      shape_iso: String(properties.shapeISO || ""),
      shape_group: String(properties.shapeGroup || ""),
      shape_type: String(properties.shapeType || ""),
      anchor: anchor_of(rings_of(feature.geometry)).map(round),
      geometry: geometry_of(feature),
      provinces: provinces.map((entry) => ({
        province_name: entry.name,
        shape_id: entry.shape_id,
        shape_iso: entry.shape_iso,
        file: `${slug(entry.name)}.geojson`,
      })),
    };
  });
  if (!country) throw new Error("no country feature in ADM0");
  write_document(file, "country", country, { provinces: country.provinces.length });
}

async function build() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // The province asked for, matched the way the map widget matches names, so
  // "Umujyi wa Kigali" and "City of Kigali" are the same province.
  const province_level = LEVELS[0];
  const all_provinces = [];
  let province = null;
  let province_rings = null;
  const wanted = normalize(asked_province);
  await each_feature(province_level.file, (feature) => {
    const properties = feature.properties || {};
    const name = String(properties.shapeName || "").trim();
    all_provinces.push({ name, shape_id: String(properties.shapeID || ""), shape_iso: String(properties.shapeISO || "") });
    if (province || !wanted || normalize(name) !== wanted) return;
    province_rings = rings_of(feature.geometry);
    province = node_of(feature, province_level, anchor_of(province_rings));
  });

  if (!province) {
    console.error(asked_province ? `No province called "${asked_province}".` : "Name the province to write.");
    console.error('Usage: node dc_backend/scripts/populate_administrative_level.js "<province>" [--decimals=6]');
    console.error(`Provinces: ${all_provinces.map((entry) => entry.name).join(", ")}`);
    process.exit(1);
  }
  console.log(`province: ${province[province_level.name_key]}`);

  // Level by level downwards, each level hung under the one above it.
  let parents = [{ node: province, rings: province_rings, box: bbox_of(province_rings) }];
  for (let index = 1; index < LEVELS.length; index += 1) {
    parents = await collect(LEVELS[index], LEVELS[index - 1], parents);
    if (parents.length === 0) break;
  }

  sort_tree(province);
  write_document(path.join(OUT_DIR, `${slug(province[province_level.name_key])}.geojson`), "province", province, { counts: counts_of(province) });
  await write_country(all_provinces);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
