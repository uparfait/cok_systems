const { normalize, skeleton } = require("./map_names.js");
const { MAP_LEVELS, load_tree } = require("./map_tree.js");

/**
 * The outlines a map widget draws. A widget sends the place names it has
 * data for and the places its board is filtered to, and this answers with
 * those shapes, the parents that hold them and, when asked, the country
 * outline behind them.
 *
 * IT IS NEVER TOLD WHICH LEVEL TO DRAW. A widget's answers move as the
 * board is filtered - the districts of a city, then the sectors of one
 * district, then the cells of one sector - so the level is worked out here,
 * by trying each one below the filtered places and keeping the one the
 * names really belong to.
 *
 * Every name is then resolved BY WALKING DOWN THE TREE - province,
 * district, sector, cell, village - and never by looking it up in a flat
 * list of one level. Names repeat: a district holds several cells and
 * villages carrying the same name, so a name alone says nothing about where
 * a place is. Walking down means every shape found comes back knowing the
 * whole chain above it (its "path"), every parent returned is a real
 * ancestor of a shape that was found, and the places the board is filtered
 * to keep the walk inside their own branch.
 *
 * A name that nothing answers to is tried once more on consonants alone
 * ("Mageragere" finds "Mageregere"), which is only accepted when it lands
 * on a single spelling. What is still unmatched is reported back, so the
 * widget can say which answers have no shape on the map.
 */

const MAX_NAMES = 2000;
// A level small enough to draw whole when a widget names nothing.
const WHOLE_LEVEL_MAX = 200;

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
 * Of everything the board is filtered by, only what really names a place
 * can narrow a map. A status, a date or a person's answer is not a place
 * and is dropped rather than emptying the map.
 */
function real_parents(tree, parents) {
  const asked = new Set((Array.isArray(parents) ? parents : []).map((name) => normalize(name)).filter(Boolean));
  if (asked.size === 0) return [];
  const found = new Set();
  const walk = (node) => {
    if (asked.has(node.key)) found.add(node.key);
    (node.children || []).forEach(walk);
  };
  (tree.provinces || []).forEach(walk);
  return Array.from(found);
}

/**
 * Walks every province down to one level, handing each node of that level
 * to a matcher. A branch only counts once it has passed through every
 * parent the board is filtered to, and nothing below the drawn level is
 * ever visited.
 */
function drill(tree, level, parents, matcher, take) {
  const walk = (node, path, chain, left) => {
    const remaining = left.has(node.key) ? new Set(Array.from(left).filter((name) => name !== node.key)) : left;
    if (node.level === level) {
      if (remaining.size > 0) return;
      const asked = matcher(node);
      if (asked !== null) take(node, path, chain, asked);
      return;
    }
    const next_path = path.concat(node.name);
    const next_chain = chain.concat(node);
    (node.children || []).forEach((child) => walk(child, next_path, next_chain, remaining));
  };
  (tree.provinces || []).forEach((province) => walk(province, [], [], new Set(parents)));
}

const shape_of = (node, path, asked) => ({
  name: node.name,
  asked: asked || node.name,
  parent: path.length > 0 ? path[path.length - 1] : "",
  path,
  anchor: node.anchor || null,
  rings: node.rings || [],
});

/** Every parent of a shape that was found, kept by identity. */
function keeper() {
  const ancestors = new Map();
  return {
    ancestors,
    of: (path, chain) =>
      chain.forEach((node, depth) => {
        if (!ancestors.has(node.level)) ancestors.set(node.level, new Map());
        if (!ancestors.get(node.level).has(node)) ancestors.get(node.level).set(node, path.slice(0, depth));
      }),
  };
}

/**
 * What one level answers: its shapes, their parents, how many of the asked
 * names it accounted for and which it could not. A name nothing answers to
 * is tried again on consonants alone, and that guess is only taken when
 * every place it reaches carries one and the same name.
 */
function collect(tree, level, wanted, parents) {
  const held = keeper();
  const shapes = [];
  const seen = new Set();
  drill(
    tree,
    level,
    parents,
    (node) => wanted.get(node.key) || null,
    (node, path, chain, asked) => {
      seen.add(normalize(asked));
      shapes.push(shape_of(node, path, asked));
      held.of(path, chain);
    },
  );

  const missing = Array.from(wanted.entries())
    .filter(([key]) => !seen.has(key))
    .map(([, asked]) => asked);
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

  const hits = new Map();
  if (by_skeleton.size > 0) {
    drill(
      tree,
      level,
      parents,
      (node) => by_skeleton.get(node.skel) || null,
      (node, path, chain, asked) => {
        if (!hits.has(asked)) hits.set(asked, []);
        hits.get(asked).push({ node, path, chain });
      },
    );
  }
  const unknown = missing.filter((asked) => {
    const list = hits.get(asked) || [];
    const spellings = new Set(list.map((entry) => entry.node.key));
    if (list.length === 0 || spellings.size !== 1) return true;
    list.forEach((entry) => {
      shapes.push(shape_of(entry.node, entry.path, asked));
      held.of(entry.path, entry.chain);
    });
    return false;
  });

  return { level, shapes, ancestors: held.ancestors, matched: wanted.size - unknown.length, unknown };
}

/**
 * Which level these names belong to: the one that accounts for most of
 * them, and of two that account for as many, the higher one - which is the
 * level the board's own filters stop at.
 */
function pick_level(tree, wanted, parents) {
  let best = null;
  MAP_LEVELS.forEach((level) => {
    const answer = collect(tree, level, wanted, parents);
    if (!best || answer.matched > best.matched) best = answer;
  });
  return best;
}

/**
 * Nothing named: draw the children of the places the board is filtered to,
 * or the provinces when it is filtered to none.
 */
function whole_level(tree, parents) {
  const drawn = MAP_LEVELS.map((level) => {
    const held = keeper();
    const shapes = [];
    drill(tree, level, parents, (node) => node.name, (node, path, chain) => {
      shapes.push(shape_of(node, path, node.name));
      held.of(path, chain);
    });
    return { level, shapes, ancestors: held.ancestors, matched: shapes.length, unknown: [] };
  });
  // The level under the filtered place: the first one holding more than the
  // filtered place itself, and few enough to read.
  const children = drawn.find((entry) => entry.shapes.length > 1 && entry.shapes.length <= WHOLE_LEVEL_MAX);
  return children || drawn.find((entry) => entry.shapes.length > 0) || drawn[0];
}

/**
 * { level, shapes, parents, outline, unknown }: the shapes these names name
 * and the level they turned out to be, each shape with the chain above it,
 * the parents that hold them (immediate parent first, up to the province)
 * and the names nothing answered to.
 */
function map_shapes(request) {
  const asked = request && typeof request === "object" ? request : {};
  const tree = load_tree();
  const parents = real_parents(tree, asked.parents);
  const wanted = wanted_names(asked.names);

  let answer = wanted.size === 0 ? whole_level(tree, parents) : pick_level(tree, wanted, parents);
  // A filter that names a place the map cannot hold must not empty it.
  if (answer.shapes.length === 0 && parents.length > 0) answer = wanted.size === 0 ? whole_level(tree, []) : pick_level(tree, wanted, []);

  const held = [];
  MAP_LEVELS.slice(0, MAP_LEVELS.indexOf(answer.level))
    .reverse()
    .forEach((parent_level) => {
      const found = answer.ancestors.get(parent_level);
      if (!found || found.size === 0) return;
      held.push({ level: parent_level, shapes: Array.from(found.entries()).map(([node, path]) => shape_of(node, path)) });
    });

  return {
    level: answer.level,
    shapes: answer.shapes,
    parents: held,
    outline: asked.outline === true && tree.outline ? { name: tree.outline.name, rings: tree.outline.rings } : null,
    unknown: answer.unknown,
  };
}

module.exports = {
  MAP_LEVELS,
  map_shapes,
  normalize_shape_name: normalize,
};
