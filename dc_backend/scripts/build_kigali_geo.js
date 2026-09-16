/**
 * Builds the map data the dashboard's map widget draws from, ONCE, out of
 * the raw geoBoundaries files (geojson-files/geoBoundaries-RWA-ADM*.geojson,
 * far too large to ship or to read per request).
 *
 * Only the City of Kigali is kept: every district, sector, cell and village
 * whose own shape sits inside it, each linked to the shape one level above
 * by where it lies, and every outline simplified (Douglas-Peucker, then
 * rounded) to what a screen can actually draw. Rwanda's own outline is kept
 * too, heavily simplified, as the faint backdrop behind the city.
 *
 * Run with: node dc_backend/scripts/build_kigali_geo.js
 * Writes:   dc_backend/util-dashboard/geo/<level>.json
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const SOURCE_DIR = path.resolve(__dirname, "../../geojson-files");
const OUT_DIR = path.resolve(__dirname, "../util-dashboard/geo");
const KIGALI = "City of Kigali";

// Level by level: the file it comes from, how hard its outlines are
// simplified (degrees; 0.0001 is about 11 metres) and its parent level.
const LEVELS = [
  { level: "province", file: "ADM1", tolerance: 0.0004, parent: null },
  { level: "district", file: "ADM2", tolerance: 0.0003, parent: "province" },
  { level: "sector", file: "ADM3", tolerance: 0.0002, parent: "district" },
  { level: "cell", file: "ADM4", tolerance: 0.00015, parent: "sector" },
  { level: "village", file: "ADM5", tolerance: 0.00008, parent: "cell" },
];

const DECIMALS = 5;
const round = (value) => Number(value.toFixed(DECIMALS));

/** Every feature of one geoBoundaries file, read one line at a time. */
async function each_feature(file, visit) {
  const stream = fs.createReadStream(path.join(SOURCE_DIR, `geoBoundaries-RWA-${file}.geojson`));
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of lines) {
    const text = line.trim().replace(/,$/, "");
    if (!text.startsWith('{ "type": "Feature"')) continue;
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
 * A point that is really inside the shape: the centroid of its largest
 * ring when that lands inside, else the first vertex nudged inwards - a
 * crescent-shaped sector must not be assigned to its neighbour.
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
  // Walk towards the centroid from a vertex until a point lands inside.
  for (let step = 1; step <= 8; step += 1) {
    const share = step / 9;
    const candidate = [ring[0][0] + (centroid[0] - ring[0][0]) * share, ring[0][1] + (centroid[1] - ring[0][1]) * share];
    if (inside(candidate, rings)) return candidate;
  }
  return centroid;
}

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
  if (ring.length < 4) return ring;
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
  // A ring must close and hold a real area.
  if (out.length < 4) return ring.map(([x, y]) => [round(x), round(y)]);
  const first = out[0];
  const last = out[out.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) out.push([first[0], first[1]]);
  return out;
}

const shape_of = (feature, tolerance) => {
  const rings = rings_of(feature.geometry);
  return { name: String(feature.properties.shapeName || "").trim(), rings: rings.map((ring) => simplify(ring, tolerance)) };
};

async function build() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // The city itself, in full detail first - everything else is tested
  // against it before being simplified.
  let kigali_raw = null;
  await each_feature("ADM1", (feature) => {
    if (String(feature.properties.shapeName).trim() === KIGALI) kigali_raw = rings_of(feature.geometry);
  });
  if (!kigali_raw) throw new Error("City of Kigali not found in ADM1");
  const kigali_box = bbox_of(kigali_raw);

  const by_level = {};
  for (const entry of LEVELS) {
    const parents = entry.parent ? by_level[entry.parent] : null;
    const kept = [];
    await each_feature(entry.file, (feature) => {
      const rings = rings_of(feature.geometry);
      if (rings.length === 0) return;
      const anchor = anchor_of(rings);
      if (entry.level === "province") {
        if (String(feature.properties.shapeName).trim() !== KIGALI) return;
      } else if (!in_bbox(anchor, kigali_box) || !inside(anchor, kigali_raw)) {
        return;
      }
      const shape = shape_of(feature, entry.tolerance);
      shape.anchor = [round(anchor[0]), round(anchor[1])];
      if (parents) {
        const parent = parents.find((candidate) => in_bbox(anchor, candidate.box) && inside(anchor, candidate.raw));
        shape.parent = parent ? parent.name : "";
      }
      shape.raw = rings;
      shape.box = bbox_of(rings);
      kept.push(shape);
    });
    by_level[entry.level] = kept;
    const out = {
      level: entry.level,
      parent_level: entry.parent,
      shapes: kept.map((shape) => ({ name: shape.name, parent: shape.parent || "", anchor: shape.anchor, rings: shape.rings })),
    };
    const file = path.join(OUT_DIR, `${entry.level}.json`);
    fs.writeFileSync(file, JSON.stringify(out));
    const points = out.shapes.reduce((sum, shape) => sum + shape.rings.reduce((inner, ring) => inner + ring.length, 0), 0);
    console.log(`${entry.level}: ${out.shapes.length} shapes, ${points} points, ${Math.round(fs.statSync(file).size / 1024)} KB`);
  }

  // Rwanda's outline, as the faint backdrop behind the city.
  let country = null;
  await each_feature("ADM0", (feature) => {
    country = shape_of(feature, 0.004);
    // Lake islets and specks add nothing to a backdrop outline.
    country.rings = country.rings.filter((ring) => ring.length > 40);
  });
  fs.writeFileSync(path.join(OUT_DIR, "country.json"), JSON.stringify({ level: "country", parent_level: null, shapes: [{ name: country.name, parent: "", rings: country.rings }] }));
  console.log("country:", country.rings.reduce((sum, ring) => sum + ring.length, 0), "points");
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
