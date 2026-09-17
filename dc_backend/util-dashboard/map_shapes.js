const fs = require("fs");
const path = require("path");

/**
 * The outlines a map widget draws. The raw geoBoundaries files are far too
 * large to ship or to read per request, so scripts/build_kigali_geo.js
 * reduced them once to the City of Kigali alone - every district, sector,
 * cell and village inside it, each linked to the shape above it and
 * simplified to what a screen can draw. This module holds those files in
 * memory and answers with ONLY the shapes a widget asked for by name, plus
 * the chain of parents above them and the country outline behind
 * everything.
 *
 * The names come from the answers people gave, and the two lists were
 * written by different hands, so a name is matched in three widening
 * steps: as it is (case, spaces and punctuation ignored, and the
 * administrative words dropped, so "Umujyi wa Kigali" finds "City of
 * Kigali"), then with l and r treated as one letter ("Ruliba" finds
 * "Ruriba"), and finally on consonants alone ("Mageragere" finds
 * "Mageregere"), which is only accepted when it lands on one name and not
 * on several.
 *
 * One name can belong to SEVERAL places - Kigali holds many villages
 * called Kabeza - so every shape carrying the asked name is returned, each
 * remembering the spelling it was asked by so the widget can put its
 * number on all of them.
 */

const GEO_DIR = path.join(__dirname, "geo");
const MAP_LEVELS = ["province", "district", "sector", "cell", "village"];
const PARENT_OF = { village: "cell", cell: "sector", sector: "district", district: "province", province: null };
const MAX_NAMES = 2000;
// A level small enough to draw whole when a widget names nothing.
const WHOLE_LEVEL_MAX = 200;

// What people put in front of (or after) a place's real name, in the three
// languages of the system.
const PREFIXES = [/^umujyi wa /, /^intara ya /, /^intara y'/, /^akarere ka /, /^umurenge wa /, /^akagari ka /, /^umudugudu wa /, /^city of /, /^province of /, /^district of /];
const SUFFIXES = [/ city$/, / province$/, / district$/, / sector$/, / cell$/, / village$/, / intara$/, / akarere$/, / umurenge$/, / akagari$/, / umudugudu$/];

const cache = new Map();

/**
 * A place name reduced to what it really is: lower case, no administrative
 * word, no punctuation, and l written as r - the two letters stand for one
 * sound in Kinyarwanda and the lists disagree on which to use.
 */
function normalize(name) {
  let text = String(name || "").toLowerCase().trim();
  PREFIXES.forEach((pattern) => {
    text = text.replace(pattern, "");
  });
  SUFFIXES.forEach((pattern) => {
    text = text.replace(pattern, "");
  });
  return text.replace(/[^a-z0-9]/g, "").replace(/l/g, "r");
}

/** The same name with its vowels dropped, where spelling variants meet. */
const skeleton = (name) => normalize(name).replace(/[aeiou]/g, "");

function load(level) {
  if (cache.has(level)) return cache.get(level);
  const file = path.join(GEO_DIR, `${level}.json`);
  let parsed = { level, shapes: [] };
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    parsed = { level, shapes: [] };
  }
  // Both indexes hold LISTS: a name can belong to several places at once.
  const by_key = new Map();
  const by_skeleton = new Map();
  const push = (index, key, shape) => {
    if (!key) return;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(shape);
  };
  parsed.shapes.forEach((shape) => {
    push(by_key, normalize(shape.name), shape);
    push(by_skeleton, skeleton(shape.name), shape);
  });
  const entry = { shapes: parsed.shapes, by_key, by_skeleton };
  cache.set(level, entry);
  return entry;
}

/**
 * Every shape of this level that answers to one name: its own spelling
 * first, then the same name on consonants alone - and that last step only
 * when the consonants lead to a single place name, never to a choice
 * between two different ones.
 */
function shapes_named(entry, name) {
  const exact = entry.by_key.get(normalize(name));
  if (exact) return exact;
  const loose = entry.by_skeleton.get(skeleton(name));
  if (!loose || loose.length === 0) return null;
  const distinct = new Set(loose.map((shape) => normalize(shape.name)));
  return distinct.size === 1 ? loose : null;
}

const strip = (shape, asked) => ({ name: shape.name, asked: asked || shape.name, parent: shape.parent || "", anchor: shape.anchor || null, rings: shape.rings });

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
  // The spelling each name was asked by is kept: it is what the widget's
  // own rows are labelled with, and what its numbers are found under.
  const wanted = new Map();
  (Array.isArray(names) ? names : []).forEach((name) => {
    const key = normalize(name);
    if (key && !wanted.has(key) && wanted.size < MAX_NAMES) wanted.set(key, String(name));
  });

  const unknown = [];
  let shapes = [];
  if (wanted.size === 0) {
    shapes = entry.shapes.length <= WHOLE_LEVEL_MAX ? entry.shapes.map((shape) => strip(shape)) : [];
  } else {
    wanted.forEach((asked) => {
      const found = shapes_named(entry, asked);
      if (found) found.forEach((shape) => shapes.push(strip(shape, asked)));
      else unknown.push(asked);
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
    parents.push({ level: parent_level, shapes: picked.map((shape) => strip(shape)) });
    child_names = new Set(picked.map((shape) => normalize(shape.parent)));
    child_level = parent_level;
  }

  const country = with_outline ? load("country") : { shapes: [] };
  return {
    level,
    shapes,
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
