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
 * A widget keeps every boundary it has been given, so a request also says
 * which names it already holds ("have") and at which level ("have_level").
 * When the level it holds is still the right one, only the boundaries it is
 * missing are sent back and the answer says so with kept: true; when the
 * names have moved to another level, everything is sent and kept is false,
 * which tells the widget to let go of what it held.
 *
 * A name that nothing answers to is tried once more on consonants alone
 * ("Mageragere" finds "Mageregere"), which is only accepted when it lands
 * on a single spelling. What is still unmatched is reported back, so the
 * widget can say which answers have no shape on the map.
 *
 * Beside the shapes it named, the widget is given the REST of the drawn
 * level under the same filters - every place it did not name - so it can
 * draw the level whole with the places nobody answered left pale. A level
 * too large to draw whole (every village of a city) sends none of that,
 * and a widget that says it already holds the rest for these same filters
 * is not sent it again.
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
 * and is dropped rather than emptying the map. A name kept twice stays
 * twice: a sector and a cell called alike are two steps of one chain, and
 * folding them into one would open the whole sector.
 */
function real_parents(tree, parents) {
  const asked = (Array.isArray(parents) ? parents : []).map((name) => normalize(name)).filter(Boolean);
  if (asked.length === 0) return [];
  const known = new Set();
  const walk = (node) => {
    known.add(node.key);
    (node.children || []).forEach(walk);
  };
  (tree.provinces || []).forEach(walk);
  return asked.filter((key) => known.has(key));
}

/**
 * Walks every province down to one level, handing each node of that level
 * to a matcher. A branch only counts once it has passed through every
 * parent the board is filtered to ABOVE the drawn level - a name given
 * twice through two nodes of that name - and nothing below the drawn level
 * is ever visited.
 */
function drill(tree, level, parents, matcher, take) {
  const walk = (node, path, chain, left) => {
    if (node.level === level) {
      // A drawn place never satisfies a filter by carrying the name itself:
      // the cells of the sector Kigarama must not bring along a cell called
      // Kigarama from another district.
      if (left.size > 0) return;
      const asked = matcher(node);
      if (asked !== null) take(node, path, chain, asked);
      return;
    }
    let remaining = left;
    if (left.has(node.key)) {
      remaining = new Map(left);
      if (remaining.get(node.key) > 1) remaining.set(node.key, remaining.get(node.key) - 1);
      else remaining.delete(node.key);
    }
    const next_path = path.concat(node.name);
    const next_chain = chain.concat(node);
    (node.children || []).forEach((child) => walk(child, next_path, next_chain, remaining));
  };
  const counts = new Map();
  (parents || []).forEach((key) => counts.set(key, (counts.get(key) || 0) + 1));
  (tree.provinces || []).forEach((province) => walk(province, [], [], counts));
}

const shape_of = (node, path, asked) => ({
  name: node.name,
  asked: asked || node.name,
  parent: path.length > 0 ? path[path.length - 1] : "",
  path,
  anchor: node.anchor || null,
  rings: node.rings || [],
});

/** One shape's whole chain of parents, kept by identity. */
function remember(ancestors, path, chain) {
  chain.forEach((node, depth) => {
    if (!ancestors.has(node.level)) ancestors.set(node.level, new Map());
    if (!ancestors.get(node.level).has(node)) ancestors.get(node.level).set(node, path.slice(0, depth));
  });
}

/** Every parent of a shape that was found, kept by identity. */
function keeper() {
  const ancestors = new Map();
  return { ancestors, of: (path, chain) => remember(ancestors, path, chain) };
}

/**
 * The REST of the drawn level under the same filters: every place of that
 * level the widget did not name, so it can draw the level whole with the
 * places nobody answered left pale. Their parents join the answer's. A
 * level too large to draw whole (every village of a city) sends none, and
 * the named places are drawn alone.
 */
function level_context(tree, answer, parents) {
  const drawn = new Set(answer.shapes.map((shape) => shape.path.concat(shape.name).join("/")));
  const rest = [];
  let total = 0;
  drill(tree, answer.level, parents, (node) => node.name, (node, path, chain) => {
    total += 1;
    if (!drawn.has(path.concat(node.name).join("/"))) rest.push({ node, path, chain });
  });
  if (total > WHOLE_LEVEL_MAX) return [];
  rest.forEach((entry) => remember(answer.ancestors, entry.path, entry.chain));
  return rest.map((entry) => shape_of(entry.node, entry.path));
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

  return { level, shapes, ancestors: held.ancestors, exact: seen.size, matched: wanted.size - unknown.length, unknown };
}

/**
 * Which level these names belong to: the one that answers most of them by
 * their own spelling, then the one that answers most of them at all, and of
 * two that do as well, the higher one - which is where the board's own
 * filters stop.
 */
function pick_level(tree, wanted, parents) {
  let best = null;
  MAP_LEVELS.forEach((level) => {
    const answer = collect(tree, level, wanted, parents);
    if (!best || answer.exact > best.exact || (answer.exact === best.exact && answer.matched > best.matched)) best = answer;
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
    return { level, shapes, ancestors: held.ancestors, exact: shapes.length, matched: shapes.length, unknown: [] };
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
  const have = new Set((Array.isArray(asked.have) ? asked.have : []).map((name) => normalize(name)).filter(Boolean));

  let scope = parents;
  let answer = wanted.size === 0 ? whole_level(tree, scope) : pick_level(tree, wanted, scope);
  if (wanted.size > 0 && parents.length > 0) {
    // The filters keep the walk in their branch, but a widget that ignores
    // them (a row of district cards under a district filter) names places
    // outside it: when the open walk answers more of its names, it wins.
    const open = pick_level(tree, wanted, []);
    if (open.exact > answer.exact || (open.exact === answer.exact && open.matched > answer.matched)) {
      answer = open;
      scope = [];
    }
  }
  // A filter that names a place the map cannot hold must not empty it.
  if (answer.shapes.length === 0 && parents.length > 0) {
    scope = [];
    answer = wanted.size === 0 ? whole_level(tree, scope) : pick_level(tree, wanted, scope);
  }
  // A widget that names nothing has nothing to color: the whole level it
  // is looking at is context, drawn pale, and none of it counts as answered.
  if (wanted.size === 0) answer = Object.assign({}, answer, { shapes: [] });

  // What the widget already holds does not travel a second time - neither
  // the boundaries themselves nor the parents it was given with them, nor
  // the rest of the level when the widget says it holds it for these same
  // filters (context null then means: keep what you have).
  const kept = have.size > 0 && asked.have_level === answer.level;
  const context = kept && asked.have_context === true ? null : level_context(tree, answer, scope);
  const sent = kept ? answer.shapes.filter((shape) => !have.has(normalize(shape.asked))) : answer.shapes;
  const needed = new Set();
  sent.concat(context || []).forEach((shape) => (shape.path || []).forEach((step, depth) => needed.add(shape.path.slice(0, depth + 1).join("/"))));

  const held = [];
  MAP_LEVELS.slice(0, MAP_LEVELS.indexOf(answer.level))
    .reverse()
    .forEach((parent_level) => {
      const found = answer.ancestors.get(parent_level);
      if (!found || found.size === 0) return;
      const shapes = Array.from(found.entries())
        .map(([node, path]) => shape_of(node, path))
        .filter((shape) => !kept || needed.has(shape.path.concat(shape.name).join("/")));
      if (shapes.length > 0) held.push({ level: parent_level, shapes });
    });
  return {
    level: answer.level,
    kept,
    shapes: sent,
    context,
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
