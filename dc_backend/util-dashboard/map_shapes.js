const { normalize, skeleton } = require("./map_names.js");
const { MAP_LEVELS, load_tree } = require("./map_tree.js");

/**
 * The outlines a map widget draws. A widget sends the level it maps and the
 * place names it has data for, and this answers with ONLY those shapes, the
 * parents that hold them and, when asked, the country outline behind them.
 *
 * Every name is resolved BY WALKING DOWN THE TREE - province, district,
 * sector, cell, village - and never by looking it up in a flat list of that
 * level. Names repeat: a district holds several cells and villages carrying
 * the same name, and so does the country, so a name alone says nothing about
 * where a place is. Walking down means every shape found comes back knowing
 * the whole chain above it (its "path"), every parent returned is a real
 * ancestor of a shape that was found, and a caller can start the walk part
 * way down by naming a province, district, sector or cell to stay inside.
 *
 * A name that nothing answers to is tried once more on consonants alone
 * ("Mageragere" finds "Mageregere"), which is only accepted when it lands on
 * a single spelling. What is still unmatched is reported back, so the widget
 * can say which answers have no shape on the map.
 */

const MAX_NAMES = 2000;
// A level small enough to draw whole when a widget names nothing.
const WHOLE_LEVEL_MAX = 200;

/** Only the levels above the one being drawn can narrow the walk. */
function clean_scope(within, level) {
  const out = {};
  if (!within || typeof within !== "object") return out;
  MAP_LEVELS.slice(0, MAP_LEVELS.indexOf(level)).forEach((key) => {
    if (typeof within[key] === "string" && within[key].trim()) out[key] = within[key].trim();
  });
  return out;
}

/**
 * Walks every province down to one level, handing each node of that level to
 * a matcher. A node is entered only when it is inside the scope asked for,
 * and nothing below the drawn level is ever visited.
 */
function drill(tree, level, scope, matcher, take) {
  const walk = (node, path, chain) => {
    const limit = scope[node.level];
    if (limit && normalize(node.name) !== normalize(limit)) return;
    if (node.level === level) {
      const asked = matcher(node.name);
      if (asked !== null) take(node, path, chain, asked);
      return;
    }
    const next_path = path.concat(node.name);
    const next_chain = chain.concat(node);
    (node.children || []).forEach((child) => walk(child, next_path, next_chain));
  };
  (tree.provinces || []).forEach((province) => walk(province, [], []));
}

const shape_of = (node, path, asked) => ({
  name: node.name,
  asked: asked || node.name,
  parent: path.length > 0 ? path[path.length - 1] : "",
  path,
  anchor: node.anchor || null,
  rings: node.rings || [],
});

/**
 * The names a widget asked for, kept in the spelling it used: that spelling
 * is what its own rows are labelled with, and what its numbers are found
 * under once the shapes come back.
 */
function wanted_names(names) {
  const wanted = new Map();
  (Array.isArray(names) ? names : []).forEach((name) => {
    const key = normalize(name);
    if (key && !wanted.has(key) && wanted.size < MAX_NAMES) wanted.set(key, String(name));
  });
  return wanted;
}

/**
 * A second walk for the names nothing answered to, on consonants alone. A
 * spelling is only accepted when every place it reaches carries one and the
 * same name - a guess must never hand a widget the wrong village.
 */
function loose_pass(tree, level, scope, missing, found, ancestors_of) {
  const by_skeleton = new Map();
  const blocked = new Set();
  missing.forEach((asked) => {
    const key = skeleton(asked);
    if (!key || blocked.has(key)) return;
    if (by_skeleton.has(key)) {
      by_skeleton.delete(key);
      blocked.add(key);
      return;
    }
    by_skeleton.set(key, asked);
  });
  if (by_skeleton.size === 0) return missing;

  const hits = new Map();
  drill(
    tree,
    level,
    scope,
    (name) => by_skeleton.get(skeleton(name)) || null,
    (node, path, chain, asked) => {
      if (!hits.has(asked)) hits.set(asked, []);
      hits.get(asked).push({ node, path, chain });
    },
  );

  return missing.filter((asked) => {
    const list = hits.get(asked) || [];
    const spellings = new Set(list.map((entry) => normalize(entry.node.name)));
    if (list.length === 0 || spellings.size !== 1) return true;
    list.forEach((entry) => {
      found.push(shape_of(entry.node, entry.path, asked));
      ancestors_of(entry.path, entry.chain);
    });
    return false;
  });
}

/**
 * { level, shapes, parents, outline, unknown }: the named shapes of one
 * level, each with the chain above it, the parents that hold them (immediate
 * parent first, up to the province) and the names nothing answered to.
 */
function map_shapes(level, names, with_outline, within) {
  if (!MAP_LEVELS.includes(level)) return null;
  const tree = load_tree();
  const scope = clean_scope(within, level);
  const wanted = wanted_names(names);

  // Every parent of a shape that was found, kept by identity so the same
  // sector is not sent twice for its many villages.
  const ancestors = new Map();
  const ancestors_of = (path, chain) =>
    chain.forEach((node, depth) => {
      if (!ancestors.has(node.level)) ancestors.set(node.level, new Map());
      if (!ancestors.get(node.level).has(node)) ancestors.get(node.level).set(node, path.slice(0, depth));
    });

  let shapes = [];
  let unknown = [];
  if (wanted.size === 0) {
    // Nothing named: draw the level whole when it is small enough to read.
    drill(tree, level, scope, (name) => name, (node, path, chain) => {
      shapes.push(shape_of(node, path, node.name));
      ancestors_of(path, chain);
    });
    if (shapes.length > WHOLE_LEVEL_MAX) {
      shapes = [];
      ancestors.clear();
    }
  } else {
    const seen = new Set();
    drill(
      tree,
      level,
      scope,
      (name) => wanted.get(normalize(name)) || null,
      (node, path, chain, asked) => {
        seen.add(normalize(asked));
        shapes.push(shape_of(node, path, asked));
        ancestors_of(path, chain);
      },
    );
    const missing = Array.from(wanted.entries())
      .filter(([key]) => !seen.has(key))
      .map(([, asked]) => asked);
    unknown = loose_pass(tree, level, scope, missing, shapes, ancestors_of);
  }

  // Immediate parents first, then upwards to the province.
  const parents = [];
  MAP_LEVELS.slice(0, MAP_LEVELS.indexOf(level))
    .reverse()
    .forEach((parent_level) => {
      const held = ancestors.get(parent_level);
      if (!held || held.size === 0) return;
      parents.push({
        level: parent_level,
        shapes: Array.from(held.entries()).map(([node, path]) => shape_of(node, path)),
      });
    });

  const outline = with_outline && tree.outline ? { name: tree.outline.name, rings: tree.outline.rings } : null;
  return { level, shapes, parents, outline, unknown };
}

module.exports = {
  MAP_LEVELS,
  map_shapes,
  normalize_shape_name: normalize,
};
