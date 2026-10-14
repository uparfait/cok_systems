const assert = require("assert");
const path = require("path");
const { pathToFileURL } = require("url");
const { CHART_TYPES } = require("../util-dashboard/constants.js");
const { validate_dashboard } = require("../util-dashboard/widget_validation.js");

/**
 * Drilling down a cascade from EVERY chart type of the catalog.
 *
 * The frontend derives the child widget (frontend/src/systems/dcs/
 * util-dashboard/cascade.js, derive_child_widget) and this server
 * validates it like any other widget of a data request. The regression
 * guarded here is a child that carried a field its own type cannot take -
 * a map split by status turned into bars that "do not take a split field"
 * - so for each type a parent with a split, a pattern, a legend and a time
 * line set is drilled, and the child must validate. A map drills into a
 * map of its child level with the clicked place as its filter, and into
 * bars when the child names no place; words, sections and point charts
 * have nothing to drill.
 *
 * The frontend module is loaded as it is (plain ES modules with no React),
 * so the rule under test is the one the page runs.
 */

const CASCADE = pathToFileURL(path.join(__dirname, "..", "..", "frontend", "src", "systems", "dcs", "util-dashboard", "cascade.js")).href;

const FORM = "form-drill";
const PROJECT = "project-drill";

const SCHEMA_FIELDS = [
  { id: "district", type: "cascading_select", label: { en: "District" }, data_source: { level: "districts" } },
  { id: "sector", type: "cascading_select", label: { en: "Sector" }, parent_field_id: "district", data_source: { level: "sectors" } },
  { id: "cell", type: "cascading_select", label: { en: "Cell" }, parent_field_id: "sector", data_source: { level: "cells" } },
  { id: "zone", type: "cascading_select", label: { en: "Zone" }, parent_field_id: "cell" },
  { id: "status", type: "single_select", label: { en: "Status" } },
  { id: "gender", type: "single_select", label: { en: "Gender" } },
  { id: "amount", type: "number", label: { en: "Amount" } },
  { id: "when", type: "date", label: { en: "When" } },
  { id: "where", type: "geolocation", label: { en: "Where" } },
];
const VERSIONS = new Map([[FORM, { project_id: PROJECT, schema: { fields: SCHEMA_FIELDS } }]]);
// The builder's fields, as the page hands them to the drill.
const FIELDS = SCHEMA_FIELDS.map((field) => ({ id: field.id, type: field.type, label: field.label.en, raw: field }));

const UNDRILLABLE = ["text", "canvas", "scatter", "bubble"];
const PATTERN_TYPES = ["grouped_column", "stacked_column", "stacked_100", "grouped_bar", "stacked_bar", "stacked_bar_100"];

const say = (text) => process.stdout.write(`${text}\n`);

/** A parent of one type, loaded with everything a drill may have to drop. */
function parent_of(type, group) {
  const base = {
    id: `w-${type}`,
    form_group_id: FORM,
    title: "Cattle Status",
    chart_type: type,
    metric: { aggregation: "count", field_id: null },
    group_by: { field_id: group || "district" },
    split_by: { field_id: "status" },
    pattern_by: { field_id: "gender" },
    legend_by: { field_id: "status" },
    over_time: { enabled: true, field_id: "submitted_at", granularity: "month", axis: "x" },
    filters: [],
    pinned_fields: [],
    size: "medium",
    limit: 20,
  };
  if (type === "kpi") return Object.assign(base, { group_by: null, split_by: null, pattern_by: null, over_time: null, filters: [{ field_id: "district", operator: "eq", value: "Gasabo" }], pinned_fields: ["district"] });
  if (type === "map") return Object.assign(base, { map: { mode: "world", level: "district", marker: "lucide:MapPin", show_markers: true } });
  if (type === "table") return Object.assign(base, { table: { mode: "summary", columns: [] } });
  if (type === "text") return Object.assign(base, { group_by: null, split_by: null, pattern_by: null, legend_by: null, over_time: null, text: { heading: "Note" } });
  if (type === "canvas") return Object.assign(base, { group_by: null, split_by: null, pattern_by: null, legend_by: null, over_time: null });
  if (type === "scatter" || type === "bubble") return Object.assign(base, { x_field_id: "amount", y_field_id: "amount", size_field_id: "amount" });
  return base;
}

function validate(child) {
  return validate_dashboard([child], VERSIONS, PROJECT, { nesting: false });
}

function test_every_type_drills_to_a_valid_child(cascade) {
  Object.keys(CHART_TYPES).forEach((type) => {
    const parent = parent_of(type);
    const target = cascade.drill_target(parent, FIELDS);
    if (UNDRILLABLE.includes(type)) {
      assert.strictEqual(target, null, `${type} has nothing to drill`);
      return;
    }
    assert.ok(target, `${type} can be drilled`);
    assert.strictEqual(target.child.id, "sector", `${type} drills from district to sector`);
    const child = cascade.derive_child_widget(parent, target);
    const result = validate(child);
    assert.ok(result.valid, `${type} child validates: ${result.errors.join(" | ")}`);
    assert.strictEqual(child.group_by.field_id, "sector", `${type} child groups by the sector`);
    assert.strictEqual(child.legend_by, null, `${type} child carries no legend`);
    if (CHART_TYPES[type].split === "none") assert.strictEqual(child.split_by, null, `${type} child carries no split`);
    else assert.strictEqual(child.split_by && child.split_by.field_id, "status", `${type} child keeps its split`);
    if (PATTERN_TYPES.includes(type)) assert.strictEqual(child.pattern_by && child.pattern_by.field_id, "gender", `${type} child keeps its pattern`);
    else assert.strictEqual(child.pattern_by, null, `${type} child carries no pattern`);
    if (type === "kpi") assert.strictEqual(child.chart_type, "bar", "a card drills into bars");
    else if (type === "map") assert.strictEqual(child.chart_type, "map", "a map drills into a map");
    else assert.strictEqual(child.chart_type, type, `${type} keeps its look`);
    say(`drill ${type.padEnd(16)} -> ${child.chart_type.padEnd(10)} split=${child.split_by ? child.split_by.field_id : "-"} pattern=${child.pattern_by ? child.pattern_by.field_id : "-"} over_time=${child.over_time ? "on" : "-"}`);
  });
}

function test_map_drills_into_a_map_of_the_clicked_place(cascade) {
  const parent = parent_of("map");
  const target = cascade.drill_target(parent, FIELDS);
  const child = cascade.derive_child_widget(parent, target, "Gasabo");
  const result = validate(child);
  assert.ok(result.valid, `map child validates: ${result.errors.join(" | ")}`);
  assert.strictEqual(child.chart_type, "map");
  assert.strictEqual(child.map.level, "sector", "the child map draws the child level");
  assert.strictEqual(child.map.mode, "world");
  assert.strictEqual(child.map.marker, "lucide:MapPin", "the chosen marker is kept");
  assert.deepStrictEqual(child.filters, [{ field_id: "district", operator: "eq", value: "Gasabo" }], "the clicked place is the child's filter");
  assert.deepStrictEqual(child.pinned_fields, ["district"], "the child is pinned on the clicked place");
  assert.ok(child.id.endsWith("__Gasabo"), "the child's id carries the place");
  assert.strictEqual(child.over_time, null, "a map has no time line");
  assert.deepStrictEqual(cascade.stacked_values(child), [{ field_id: "district", value: "Gasabo" }], "the place is what the map scope is narrowed to");
  // Down again: the sectors of Gasabo to the cells of one sector.
  const deeper_target = cascade.drill_target(child, FIELDS);
  assert.strictEqual(deeper_target.child.id, "cell");
  const deeper = cascade.derive_child_widget(child, deeper_target, "Remera");
  assert.ok(validate(deeper).valid, `cell map validates: ${validate(deeper).errors.join(" | ")}`);
  assert.strictEqual(deeper.map.level, "cell");
  assert.deepStrictEqual(deeper.filters, [
    { field_id: "district", operator: "eq", value: "Gasabo" },
    { field_id: "sector", operator: "eq", value: "Remera" },
  ]);
  assert.deepStrictEqual(deeper.pinned_fields, ["district", "sector"]);
}

function test_map_falls_back_to_bars_below_the_last_place_level(cascade) {
  const parent = parent_of("map", "cell");
  parent.map.level = "cell";
  const target = cascade.drill_target(parent, FIELDS);
  assert.strictEqual(target.child.id, "zone");
  const child = cascade.derive_child_widget(parent, target, "Nyarutarama");
  const result = validate(child);
  assert.ok(result.valid, `zone child validates: ${result.errors.join(" | ")}`);
  assert.strictEqual(child.chart_type, "bar", "a child that names no place is drawn as bars");
  assert.strictEqual(child.split_by, null);
}

function test_a_split_that_lands_on_the_child_falls_away(cascade) {
  const parent = parent_of("stacked_column");
  parent.split_by = { field_id: "sector" };
  const target = cascade.drill_target(parent, FIELDS);
  const child = cascade.derive_child_widget(parent, target);
  const result = validate(child);
  assert.ok(result.valid, `stacked child validates: ${result.errors.join(" | ")}`);
  assert.strictEqual(child.chart_type, "column", "a stacked chart with no split left is drawn as columns");
  assert.strictEqual(child.split_by, null);
  assert.strictEqual(child.pattern_by, null, "a pattern needs a split chart");

  const table = parent_of("table");
  table.split_by = { field_id: "sector" };
  const table_child = cascade.derive_child_widget(table, cascade.drill_target(table, FIELDS));
  assert.ok(validate(table_child).valid, `table child validates: ${validate(table_child).errors.join(" | ")}`);
  assert.strictEqual(table_child.chart_type, "bar", "a summary table with neither split nor columns is drawn as bars");
}

function test_card_formulas_become_groupable(cascade) {
  const parent = parent_of("kpi");
  parent.metric = { aggregation: "median", field_id: "amount" };
  const target = cascade.drill_target(parent, FIELDS);
  assert.strictEqual(target.value, "Gasabo", "a card drills from the value it is fixed on");
  const child = cascade.derive_child_widget(parent, target);
  const result = validate(child);
  assert.ok(result.valid, `median card child validates: ${result.errors.join(" | ")}`);
  assert.deepStrictEqual(child.metric, { aggregation: "avg", field_id: "amount" });
  assert.deepStrictEqual(child.filters, [{ field_id: "district", operator: "eq", value: "Gasabo" }]);
}

function test_records_tables_and_time_groups_do_not_drill(cascade) {
  const records = parent_of("table");
  records.table = { mode: "records", fields: ["status"], page_size: 20 };
  assert.strictEqual(cascade.drill_target(records, FIELDS), null, "a records table has nothing to drill");
  const timed = parent_of("line");
  timed.group_by = { field_id: "submitted_at", granularity: "month" };
  assert.strictEqual(cascade.drill_target(timed, FIELDS), null, "a time line has nothing to drill");
  const last = parent_of("bar", "zone");
  assert.strictEqual(cascade.drill_target(last, FIELDS), null, "the end of the chain has nothing below it");
}

async function run_all_tests() {
  const cascade = await import(CASCADE);
  test_every_type_drills_to_a_valid_child(cascade);
  test_map_drills_into_a_map_of_the_clicked_place(cascade);
  test_map_falls_back_to_bars_below_the_last_place_level(cascade);
  test_a_split_that_lands_on_the_child_falls_away(cascade);
  test_card_formulas_become_groupable(cascade);
  test_records_tables_and_time_groups_do_not_drill(cascade);
}

run_all_tests()
  .then(() => {
    process.stdout.write("ALL_TESTS_PASSED\n");
    process.exit(0);
  })
  .catch((error) => {
    process.stdout.write(`${error && error.stack ? error.stack : error}\n`);
    process.exit(1);
  });
