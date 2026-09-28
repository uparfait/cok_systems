const assert = require("assert");
const { load_tree } = require("../util-dashboard/map_tree.js");
const { map_shapes } = require("../util-dashboard/map_shapes.js");
const { normalize, skeleton } = require("../util-dashboard/map_names.js");
const { read_map_request } = require("../util-dashboard/controllers/map_shapes.js");

/**
 * The boundaries a map widget draws, answered from the real City of Kigali
 * tree (geojson-maped/city-of-kigali.geojson) with no database at all:
 *
 *   - the tree holds every level whole and no place lacks an outline;
 *   - every district, sector, cell and village is found by its own name
 *     under its own parents, with the chain above it and nothing from
 *     another branch;
 *   - the REST of a level travels as context, so the level is drawn whole
 *     with the places nobody answered left pale - never for a level too
 *     large to draw whole;
 *   - what a widget already holds does not travel twice, but the rest of
 *     the level does;
 *   - a misspelt name is found on its consonants, an unknown one reported;
 *   - a district request answers in a few milliseconds.
 */

const chain = (shape) => shape.path.concat(shape.name).join("/");
const names_of = (shapes) => shapes.map((shape) => shape.name).sort();
const say = (text) => process.stdout.write(`${text}\n`);

let tree;

function test_tree_is_whole() {
  const started = Date.now();
  tree = load_tree();
  const took = Date.now() - started;
  const count = {};
  const bare = [];
  const walk = (node, path) => {
    count[node.level] = (count[node.level] || 0) + 1;
    if (!Array.isArray(node.rings) || node.rings.length === 0) bare.push(path.concat(node.name).join("/"));
    (node.children || []).forEach((child) => walk(child, path.concat(node.name)));
  };
  tree.provinces.forEach((province) => walk(province, []));
  assert.deepStrictEqual(count, { province: 1, district: 3, sector: 35, cell: 161, village: 1162 }, "the City of Kigali tree is whole");
  assert.deepStrictEqual(bare, [], "every place has an outline");
  assert.ok(tree.outline && tree.outline.rings.length > 0, "the country outline is there");
  assert.ok(took < 15000, `the tree loads in reasonable time (${took} ms)`);
  say(`tree: ${JSON.stringify(count)} loaded in ${took} ms from ${tree.source}`);
}

function test_every_place_is_found_under_its_parents() {
  let checked = 0;
  let requests = 0;
  const visit = (node, path) => {
    const children = node.children || [];
    if (children.length === 0) return;
    const here = path.concat(node.name);
    const answer = map_shapes({ names: children.map((child) => child.name), parents: here });
    requests += 1;
    assert.strictEqual(answer.level, children[0].level, `${here.join("/")}: the level of its children`);
    assert.deepStrictEqual(answer.unknown, [], `${here.join("/")}: every child is found`);
    const found = new Set(answer.shapes.map(chain));
    children.forEach((child) => assert.ok(found.has(here.concat(child.name).join("/")), `${child.level} ${child.name} is found under ${node.name}`));
    answer.shapes.forEach((shape) => assert.deepStrictEqual(shape.path, here, `${shape.name}: nothing from outside ${node.name}`));
    assert.deepStrictEqual(answer.context, [], `${here.join("/")}: the whole level was named, nothing is left over`);
    checked += children.length;
    children.forEach((child) => visit(child, here));
  };
  tree.provinces.forEach((province) => visit(province, []));
  assert.strictEqual(checked, 3 + 35 + 161 + 1162);
  say(`found: ${checked} places by name under their own parents, in ${requests} requests`);
}

function test_rest_of_level_is_context() {
  const one = map_shapes({ names: ["Gasabo"], parents: [] });
  assert.strictEqual(one.level, "district");
  assert.deepStrictEqual(names_of(one.shapes), ["Gasabo"]);
  assert.deepStrictEqual(names_of(one.context), ["Kicukiro", "Nyarugenge"], "the other districts travel as context");
  one.context.forEach((shape) => assert.deepStrictEqual(shape.path, ["City of Kigali"]));
  assert.ok(one.parents.some((entry) => entry.level === "province" && entry.shapes.length === 1), "the province is outlined behind them");

  const none = map_shapes({ names: [], parents: [] });
  assert.strictEqual(none.level, "district");
  assert.deepStrictEqual(none.shapes, [], "a widget that names nothing colors nothing");
  assert.deepStrictEqual(names_of(none.context), ["Gasabo", "Kicukiro", "Nyarugenge"], "and is given the whole level to draw pale");

  const gasabo = tree.provinces[0].children.find((district) => district.name === "Gasabo");
  const sectors = map_shapes({ names: [], parents: ["Gasabo"] });
  assert.strictEqual(sectors.level, "sector");
  assert.strictEqual(sectors.context.length, gasabo.children.length, "every sector of Gasabo, none named");

  const first = gasabo.children[0];
  const some = map_shapes({ names: [first.name], parents: ["Gasabo"] });
  assert.strictEqual(some.level, "sector");
  assert.deepStrictEqual(names_of(some.shapes), [first.name]);
  assert.strictEqual(some.context.length, gasabo.children.length - 1, "the other sectors of Gasabo are context");
  assert.ok(some.context.every((shape) => shape.path.join("/") === "City of Kigali/Gasabo"), "nothing from another district");

  // Too many villages in a district to draw them all: the named ones alone.
  const villages_in_gasabo = gasabo.children.reduce((sum, sector) => sum + sector.children.reduce((inner, cell) => inner + cell.children.length, 0), 0);
  assert.ok(villages_in_gasabo > 200, `Gasabo holds ${villages_in_gasabo} villages`);
  const cell = first.children[0];
  const many = map_shapes({ names: cell.children.map((village) => village.name), parents: ["Gasabo"] });
  assert.strictEqual(many.level, "village");
  assert.deepStrictEqual(many.context, [], "a level too large to draw whole sends no context");
  // Inside one cell they are few, so the cell is drawn whole.
  const in_cell = map_shapes({ names: [cell.children[0].name], parents: ["Gasabo", first.name, cell.name] });
  assert.strictEqual(in_cell.level, "village");
  assert.strictEqual(in_cell.context.length, cell.children.length - in_cell.shapes.length, `the other villages of ${cell.name} are context`);
  in_cell.context.forEach((shape) => assert.deepStrictEqual(shape.path, ["City of Kigali", "Gasabo", first.name, cell.name]));
  say(`context: ${one.context.length} districts beside Gasabo, ${sectors.context.length} sectors under Gasabo, ${in_cell.context.length} villages beside ${cell.children[0].name} in ${cell.name}, none for ${villages_in_gasabo} villages`);
}

function test_held_shapes_do_not_travel_twice() {
  const again = map_shapes({ names: ["Gasabo", "Kicukiro"], parents: [], have: ["Gasabo"], have_level: "district" });
  assert.strictEqual(again.kept, true);
  assert.deepStrictEqual(names_of(again.shapes), ["Kicukiro"], "only what the widget lacks");
  assert.deepStrictEqual(names_of(again.context), ["Nyarugenge"], "the rest of the level still travels");
  assert.ok(again.parents.some((entry) => entry.level === "province"), "the parents those shapes need travel with them");
  const gasabo = tree.provinces[0].children.find((district) => district.name === "Gasabo");
  const moved = map_shapes({ names: [gasabo.children[0].name], parents: ["Gasabo"], have: ["Gasabo"], have_level: "district" });
  assert.strictEqual(moved.kept, false, "a level that moved is a new map");
  assert.strictEqual(moved.level, "sector");
  assert.strictEqual(moved.shapes.length + moved.context.length, gasabo.children.length, "the whole sector level of Gasabo");
}

function test_misspelling_and_unknown() {
  // A spelling no place carries, on the consonants of one district alone.
  const misspelt = "Gasaboo";
  const known = new Set();
  const walk = (node) => {
    known.add(normalize(node.name));
    (node.children || []).forEach(walk);
  };
  tree.provinces.forEach(walk);
  assert.ok(!known.has(normalize(misspelt)), `${misspelt} names no real place`);
  assert.strictEqual(skeleton(misspelt), skeleton("Gasabo"), "same consonants as Gasabo");
  const answer = map_shapes({ names: [misspelt, "Nowhere Land"], parents: [] });
  assert.deepStrictEqual(answer.unknown, ["Nowhere Land"], "a name nothing answers to is reported");
  assert.strictEqual(answer.level, "district");
  assert.ok(answer.shapes.some((shape) => shape.asked === misspelt && shape.name === "Gasabo"), "found on its consonants, under the name it was asked by");
  say(`spelling: ${misspelt} found as Gasabo, Nowhere Land reported unknown`);
}

function test_a_drawn_place_never_satisfies_a_filter_itself() {
  // The sector Kigarama (Kicukiro) and, elsewhere in the city, a cell of the
  // same name: filtering to "Kigarama" must open the sector's cells only.
  const kicukiro = tree.provinces[0].children.find((district) => district.name === "Kicukiro");
  const sector = kicukiro.children.find((entry) => entry.name === "Kigarama");
  assert.ok(sector, "Kicukiro has a sector named Kigarama");
  const same_named_cells = [];
  tree.provinces[0].children.forEach((district) => district.children.forEach((entry) => entry.children.forEach((cell) => cell.name === "Kigarama" && same_named_cells.push(`${district.name}/${entry.name}`))));
  assert.ok(same_named_cells.length > 0, `a cell named Kigarama exists elsewhere (${same_named_cells.join(", ")})`);
  const whole = map_shapes({ names: [], parents: ["Kigarama"] });
  assert.strictEqual(whole.level, "cell");
  assert.strictEqual(whole.context.length, sector.children.length, "every cell of the sector Kigarama");
  whole.context.forEach((shape) => assert.deepStrictEqual(shape.path, ["City of Kigali", "Kicukiro", "Kigarama"], `${shape.name} is a cell of the sector Kigarama`));
  const named = map_shapes({ names: sector.children.map((cell) => cell.name), parents: ["Kigarama"] });
  assert.strictEqual(named.shapes.length, sector.children.length, "no stray cell from another district");
  named.shapes.forEach((shape) => assert.deepStrictEqual(shape.path, ["City of Kigali", "Kicukiro", "Kigarama"]));
  // A widget pinned on the district while the board is filtered to one
  // district still draws all three: the open walk answers more of its
  // names than the filtered one, so it wins (the filtered walk alone would
  // have found a stray cell called Kicukiro or Nyarugenge inside Gasabo).
  const pinned = map_shapes({ names: ["Gasabo", "Kicukiro", "Nyarugenge"], parents: ["Gasabo"] });
  assert.strictEqual(pinned.level, "district");
  assert.deepStrictEqual(names_of(pinned.shapes), ["Gasabo", "Kicukiro", "Nyarugenge"]);
  assert.deepStrictEqual(pinned.context, []);
  const elsewhere = same_named_cells.filter((where) => where !== "Kicukiro/Kigarama");
  say(`strict walk: filtering to Kigarama opens ${whole.context.length} cells of Kicukiro/Kigarama and none of ${elsewhere.join(", ")}`);
}

function test_controller_forwards_what_the_widget_holds() {
  const request = read_map_request({ body: { names: ["Gasabo", "Kicukiro"], parents: [], have: ["Gasabo", 7, ""], have_level: " district ", have_context: true, outline: true } });
  assert.deepStrictEqual(request, { names: ["Gasabo", "Kicukiro"], parents: [], have: ["Gasabo"], have_level: "district", have_context: true, outline: true });
  const answer = map_shapes(request);
  assert.strictEqual(answer.kept, true, "over the API the held shapes are recognised");
  assert.deepStrictEqual(names_of(answer.shapes), ["Kicukiro"]);
  assert.strictEqual(answer.context, null, "the rest of the level is kept by the widget");
  const fresh = map_shapes(read_map_request({ body: { names: ["Gasabo", "Kicukiro"], have: ["Gasabo"], have_level: "district" } }));
  assert.strictEqual(fresh.kept, true);
  assert.deepStrictEqual(names_of(fresh.context), ["Nyarugenge"], "without have_context the rest of the level travels");
  const blank = read_map_request({ body: {} });
  assert.deepStrictEqual(blank, { names: [], parents: [], have: [], have_level: "", have_context: false, outline: false });
  say("controller: have, have_level and have_context reach the server");
}

function test_answers_fast() {
  const request = { names: ["Gasabo", "Kicukiro", "Nyarugenge"], parents: [], outline: true };
  const started = Date.now();
  for (let index = 0; index < 100; index += 1) map_shapes(request);
  const took = Date.now() - started;
  assert.ok(took < 5000, `100 district requests took ${took} ms`);
  const one = map_shapes(request);
  assert.ok(one.outline && one.outline.rings.length > 0, "the country outline comes when asked");
  assert.strictEqual(one.shapes.length, 3);
  say(`speed: 100 district requests in ${took} ms; one answer with the outline is ${JSON.stringify(one).length} bytes`);
}

function run_all_tests() {
  test_tree_is_whole();
  test_every_place_is_found_under_its_parents();
  test_rest_of_level_is_context();
  test_held_shapes_do_not_travel_twice();
  test_misspelling_and_unknown();
  test_a_drawn_place_never_satisfies_a_filter_itself();
  test_controller_forwards_what_the_widget_holds();
  test_answers_fast();
}

try {
  run_all_tests();
  process.stdout.write("ALL_TESTS_PASSED\n");
  process.exit(0);
} catch (error) {
  process.stdout.write(`${error && error.stack ? error.stack : error}\n`);
  process.exit(1);
}
