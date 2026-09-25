const assert = require("assert");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { MongoClient, ObjectId } = require("mongodb");
const { set_db_handles } = require("../db_connection/db.js");
const { compute_widget_data } = require("../util-dashboard/widget_data.js");
const { compute_dashboard_results } = require("../util-dashboard/compute_results.js");
const { sanitize_widget } = require("../util-dashboard/sanitize.js");
const { validate_dashboard } = require("../util-dashboard/widget_validation.js");
const { build_field_catalog } = require("../util-dashboard/field_catalog.js");
const { apply_board_filters } = require("../util-dashboard/board_filters.js");

/**
 * The widget features added for report-style boards, computed through the
 * real dashboard code against a small DMIS-shaped form:
 *
 *   - a widget LOCKED to its own period ignores the board's date filter,
 *     an unlocked one follows it;
 *   - a widget PINNED on the district field keeps its district breakdown
 *     while the board is filtered to one district (and to a sector under
 *     it), an unpinned one drills down;
 *   - a RECORDS table pages the submissions, clamps its page size to
 *     10..100 and shows only the chosen fields;
 *   - a SUMMARY table puts measure columns side by side per district with
 *     a total row, or spreads a split field into columns with a total
 *     column;
 *   - a TEXT block computes to nothing, and the validator refuses the
 *     malformed forms of all of these.
 */

const FORM = "features-form";
const PROJECT = "project-1";
const DISTRICT = "district_f";
const SECTOR = "sector_f";
const PURPOSE = "purpose_f";
const DRIVER = "driver_f";
const DEATHS = "deaths_f";
const INJURED = "injured_f";
const STRUCTURES = "structures_f";
const FACILITY = "facility_f";
const NAME = "name_f";

const FORM_VERSION = {
  form_group_id: FORM,
  project_id: PROJECT,
  version: 1,
  is_active: true,
  tracking: null,
  schema: {
    fields: [
      { id: DISTRICT, type: "cascading_select", label: { en: "District" }, data_source: { type: "api", level: "districts" } },
      { id: SECTOR, type: "cascading_select", label: { en: "Sector" }, parent_field_id: DISTRICT, data_source: { type: "api", level: "sectors" } },
      { id: PURPOSE, type: "single_select", label: { en: "Purpose" }, options: [{ id: "p1", value: "household_loss" }, { id: "p2", value: "infrastructure" }] },
      { id: DRIVER, type: "single_select", label: { en: "Driver" }, options: [{ id: "d1", value: "fire" }, { id: "d2", value: "heavy_rain" }] },
      { id: DEATHS, type: "number", label: { en: "Deaths" } },
      { id: INJURED, type: "number", label: { en: "Injured" } },
      { id: STRUCTURES, type: "multi_select", label: { en: "Other structures" }, options: [{ id: "s1", value: "annex" }, { id: "s2", value: "kitchen" }] },
      { id: FACILITY, type: "single_select", label: { en: "Facility type" }, options: [{ id: "f1", value: "school" }, { id: "f2", value: "road" }] },
      { id: NAME, type: "text", label: { en: "Head of household" } },
    ],
  },
};

const JAN = new Date("2026-01-15T10:00:00Z");
const AUG = new Date("2026-08-15T10:00:00Z");
// Twelve household records and four facility records across three districts.
const RECORDS = [];
let sequence = 0;
function record(district, sector, purpose, extra, when) {
  sequence += 1;
  RECORDS.push({
    _id: new ObjectId(`0000000000000000000000${String(sequence).padStart(2, "0")}`),
    form_group_id: FORM,
    version: 1,
    submitted_at: when || AUG,
    data: Object.assign({ [DISTRICT]: district, [SECTOR]: sector, [PURPOSE]: purpose }, extra),
  });
}
["Gasabo", "Gasabo", "Gasabo", "Gasabo", "Gasabo", "Kicukiro", "Kicukiro", "Kicukiro", "Nyarugenge", "Nyarugenge"].forEach((district, index) => {
  record(district, `${district}-S${index % 2}`, "household_loss", {
    [DRIVER]: index % 3 === 0 ? "fire" : "heavy_rain",
    [DEATHS]: index % 5 === 0 ? 2 : 0,
    [INJURED]: 1,
    [STRUCTURES]: index % 2 === 0 ? ["annex", "kitchen"] : ["kitchen"],
    [NAME]: `Head ${index + 1}`,
  });
});
// Two January households, so the period matters.
record("Gasabo", "Gasabo-S0", "household_loss", { [DRIVER]: "fire", [DEATHS]: 1, [INJURED]: 0, [STRUCTURES]: ["annex"], [NAME]: "Head Jan A" }, JAN);
record("Kicukiro", "Kicukiro-S1", "household_loss", { [DRIVER]: "heavy_rain", [DEATHS]: 0, [INJURED]: 3, [STRUCTURES]: [], [NAME]: "Head Jan B" }, JAN);
// Facilities: three schools and a road.
record("Gasabo", "Gasabo-S0", "infrastructure", { [FACILITY]: "school" });
record("Gasabo", "Gasabo-S1", "infrastructure", { [FACILITY]: "road" });
record("Kicukiro", "Kicukiro-S0", "infrastructure", { [FACILITY]: "school" });
record("Nyarugenge", "Nyarugenge-S0", "infrastructure", { [FACILITY]: "school" });

const HOUSEHOLDS = 12;
const AUG_HOUSEHOLDS = 10;
const AUGUST = { preset: "custom", from: "2026-08-01", to: "2026-08-31" };

const base = (extra) =>
  Object.assign(
    {
      id: `w_${Math.random().toString(36).slice(2, 8)}`,
      form_group_id: FORM,
      title: "Widget",
      chart_type: "kpi",
      metric: { aggregation: "count", field_id: null },
      filters: [{ field_id: PURPOSE, operator: "eq", value: "household_loss" }],
      period: { preset: "all", from: null, to: null },
    },
    extra,
  );

const versions = new Map([[FORM, FORM_VERSION]]);
const catalog = build_field_catalog(FORM_VERSION.schema);

/** Sanitized, validated, then computed - the path a real request takes. */
async function compute(raw, period_override) {
  const widget = sanitize_widget(raw);
  widget.form_group_id = FORM;
  const check = validate_dashboard([widget], versions, PROJECT);
  assert.deepStrictEqual(check.errors, [], `widget must validate: ${check.errors.join("; ")}`);
  return compute_widget_data(widget, FORM_VERSION, period_override || null);
}

/** The validator's verdict on one raw widget, after sanitizing. */
function errors_of(raw) {
  const widget = sanitize_widget(raw);
  widget.form_group_id = FORM;
  return validate_dashboard([widget], versions, PROJECT).errors;
}

async function test_locked_period_ignores_the_board_date() {
  const all_time = await compute(base({}), AUGUST);
  assert.strictEqual(all_time.value, AUG_HOUSEHOLDS, "an unlocked widget follows the board's August window");
  const locked = await compute(base({ period: { preset: "all", from: null, to: null, locked: true } }), AUGUST);
  assert.strictEqual(locked.value, HOUSEHOLDS, "a widget locked to 'all' counts every household whatever the board says");
  const locked_january = await compute(base({ period: { preset: "custom", from: "2026-01-01", to: "2026-01-31", locked: true } }), AUGUST);
  assert.strictEqual(locked_january.value, 2, "a widget locked to January reads January under an August board");
  const stored = sanitize_widget(base({ period: { preset: "this_year", locked: "yes" } })).period;
  assert.strictEqual(stored.locked, undefined, "only a real true locks a period");
}

async function test_pinned_widget_keeps_its_breakdown() {
  const by_district = base({ chart_type: "bar", group_by: { field_id: DISTRICT }, limit: 12 });
  const applied = [{ field_id: DISTRICT, value: "Gasabo" }];
  const drilled = apply_board_filters(sanitize_widget(by_district), applied, catalog);
  assert.strictEqual(drilled.widget.group_by.field_id, SECTOR, "an unpinned district chart drills to sectors");
  assert.strictEqual(drilled.context.length, 1, "and reports the drill-down as its context");
  const pinned = apply_board_filters(sanitize_widget(Object.assign({}, by_district, { pinned_fields: [DISTRICT] })), applied, catalog);
  assert.strictEqual(pinned.widget.group_by.field_id, DISTRICT, "a pinned district chart keeps its districts");
  assert.strictEqual(pinned.context.length, 0, "and runs under no board context for that field");
  assert.deepStrictEqual(pinned.widget.filters, by_district.filters, "the district pick never reaches its filters");
  // A sector pick implies a district, so it is ignored too.
  const with_sector = apply_board_filters(sanitize_widget(Object.assign({}, by_district, { pinned_fields: [DISTRICT] })), applied.concat([{ field_id: SECTOR, value: "Gasabo-S0" }]), catalog);
  assert.strictEqual(with_sector.widget.filters.length, by_district.filters.length, "a pin on the district also ignores the sector under it");
  // Other filters still apply.
  const with_driver = apply_board_filters(sanitize_widget(Object.assign({}, by_district, { pinned_fields: [DISTRICT] })), applied.concat([{ field_id: DRIVER, value: "fire" }]), catalog);
  assert.strictEqual(with_driver.widget.filters.length, by_district.filters.length + 1, "a pin on the district leaves the driver filter in force");
  // A share link's LOCKED district is not a pick: the pin does not lift it.
  const locked = apply_board_filters(sanitize_widget(Object.assign({}, by_district, { pinned_fields: [DISTRICT] })), applied, catalog, [DISTRICT]);
  assert.strictEqual(locked.widget.group_by.field_id, SECTOR, "a locked link's district still drills a pinned chart");
  // End to end through compute_dashboard_results: the three districts stay.
  const results = await compute_dashboard_results({ widgets: [Object.assign({}, by_district, { id: "pinned", pinned_fields: [DISTRICT] }), Object.assign({}, by_district, { id: "free" })], filters: applied }, FORM, FORM_VERSION, PROJECT);
  const pinned_rows = results.find((entry) => entry.widget_id === "pinned").rows.map((row) => row.label).sort();
  assert.deepStrictEqual(pinned_rows, ["Gasabo", "Kicukiro", "Nyarugenge"], "the pinned chart still lists every district");
  const free_rows = results.find((entry) => entry.widget_id === "free").rows.map((row) => row.label);
  assert.ok(free_rows.every((label) => label.startsWith("Gasabo-")), `the free chart lists Gasabo's sectors, got ${free_rows.join(", ")}`);
}

async function test_records_table_pages_and_clamps() {
  const table = base({ chart_type: "table", table: { mode: "records", fields: [NAME, DISTRICT, DEATHS], page_size: 5 } });
  const first = await compute(table);
  assert.strictEqual(first.kind, "table");
  assert.strictEqual(first.mode, "records");
  assert.strictEqual(first.page_size, 10, "a page size under ten is raised to ten");
  assert.strictEqual(first.total, HOUSEHOLDS, "the table counts every household record");
  assert.strictEqual(first.items.length, 10, "the first page holds ten rows");
  assert.strictEqual(first.pages, 2, "twelve records make two pages of ten");
  assert.deepStrictEqual(first.columns.map((column) => column.id), [NAME, DISTRICT, DEATHS], "the columns are the chosen fields, in order");
  assert.deepStrictEqual(Object.keys(first.items[0].data).sort(), [DEATHS, DISTRICT, NAME].sort(), "a row carries only the chosen fields");
  assert.ok(first.items[0].submitted_at >= first.items[1].submitted_at, "rows come newest first by default");
  const second = await compute(Object.assign({}, table, { table: { mode: "records", fields: [NAME], page_size: 10, page: 2 } }));
  assert.strictEqual(second.items.length, 2, "the second page holds the remaining two rows");
  assert.strictEqual(second.page, 2);
  const beyond = await compute(Object.assign({}, table, { table: { mode: "records", fields: [NAME], page_size: 10, page: 9 } }));
  assert.strictEqual(beyond.page, 2, "a page past the end comes back as the last page");
  assert.strictEqual(beyond.items.length, 2);
  const huge = sanitize_widget(base({ chart_type: "table", table: { mode: "records", fields: [NAME], page_size: 500 } })).table.page_size;
  assert.strictEqual(huge, 100, "a page size over a hundred is lowered to a hundred");
  const sorted = await compute(Object.assign({}, table, { table: { mode: "records", fields: [NAME], page_size: 10, sort: { field_id: NAME, direction: "asc" } } }));
  assert.strictEqual(sorted.items[0].data[NAME], "Head 1", "sorting by a field is honoured");
  const windowed = await compute(table, AUGUST);
  assert.strictEqual(windowed.total, AUG_HOUSEHOLDS, "the board's window narrows the table like any widget");
}

/** A public link that forbids records gets a locked, empty records table; one that allows some fields gets only those. */
async function test_records_table_follows_the_share_link_policy() {
  const table = base({ id: "public_table", chart_type: "table", table: { mode: "records", fields: [NAME, DISTRICT, DEATHS], page_size: 10 } });
  const forbidden = await compute_dashboard_results({ widgets: [table] }, FORM, FORM_VERSION, PROJECT, [], { allowed: false, fields: [] });
  assert.strictEqual(forbidden[0].locked, true, "a link without records shows a locked table");
  assert.deepStrictEqual(forbidden[0].items, [], "and ships no rows");
  assert.strictEqual(forbidden[0].total, 0);
  const narrowed = await compute_dashboard_results({ widgets: [table] }, FORM, FORM_VERSION, PROJECT, [], { allowed: true, fields: [DISTRICT] });
  assert.deepStrictEqual(narrowed[0].columns.map((column) => column.id), [DISTRICT], "only the fields the link allows are shown");
  assert.ok(narrowed[0].items.length > 0 && Object.keys(narrowed[0].items[0].data).every((key) => key === DISTRICT), "and no other field leaves the server");
  const open = await compute_dashboard_results({ widgets: [table] }, FORM, FORM_VERSION, PROJECT);
  assert.strictEqual(open[0].columns.length, 3, "a signed-in viewer sees every chosen field");
}

async function test_summary_table_with_measure_columns() {
  const table = base({
    chart_type: "table",
    group_by: { field_id: DISTRICT },
    sort: "label_asc",
    table: {
      mode: "summary",
      columns: [
        { key: "deaths", label: "Deaths", aggregation: "sum", field_id: DEATHS },
        { key: "injured", label: "Injured", aggregation: "sum", field_id: INJURED },
        { key: "hh", label: "HH", aggregation: "count", field_id: null },
        { key: "annex", label: "Annex", aggregation: "count", field_id: null, filters: [{ field_id: STRUCTURES, operator: "eq", value: "annex" }] },
      ],
      totals: { row: true, column: false },
    },
  });
  const data = await compute(table);
  assert.strictEqual(data.mode, "summary");
  assert.deepStrictEqual(data.rows.map((row) => row.label), ["Gasabo", "Kicukiro", "Nyarugenge"], "one row per district, alphabetical");
  const gasabo = data.rows[0].cells;
  // Gasabo: five August households (indexes 0-4: deaths at 0, structures annex at 0, 2, 4) plus the January one (deaths 1, annex).
  assert.strictEqual(gasabo.hh, 6, "Gasabo holds six households");
  assert.strictEqual(gasabo.deaths, 3, "Gasabo's deaths add up across its households");
  assert.strictEqual(gasabo.annex, 4, "Gasabo's annex column counts the households whose structures include an annex");
  const totals = data.table_totals.row.cells;
  assert.strictEqual(totals.hh, HOUSEHOLDS, "the total row counts every household");
  assert.strictEqual(totals.deaths, data.rows.reduce((sum, row) => sum + row.cells.deaths, 0), "the total row adds the deaths column up");
  assert.strictEqual(data.rows[0].total, null, "no total column unless asked for");
  const windowed = await compute(table, AUGUST);
  assert.strictEqual(windowed.table_totals.row.cells.hh, AUG_HOUSEHOLDS, "the summary follows the board's window");
}

async function test_summary_table_with_split_columns() {
  const table = base({
    chart_type: "table",
    group_by: { field_id: DISTRICT },
    split_by: { field_id: FACILITY },
    sort: "label_asc",
    filters: [{ field_id: PURPOSE, operator: "eq", value: "infrastructure" }],
    table: { mode: "summary", totals: { row: true, column: true } },
  });
  const data = await compute(table);
  assert.deepStrictEqual(data.columns.map((column) => column.key), ["school", "road"], "the columns are the facility types, most frequent first");
  const gasabo = data.rows.find((row) => row.label === "Gasabo");
  assert.strictEqual(gasabo.cells.school, 1);
  assert.strictEqual(gasabo.cells.road, 1);
  assert.strictEqual(gasabo.total, 2, "the total column adds the row up");
  assert.strictEqual(data.table_totals.row.cells.school, 3, "three schools in all");
  assert.strictEqual(data.table_totals.row.total, 4, "four facilities in all");
  assert.ok(Array.isArray(data.totals), "the dimension totals line still rides along under the table");
  // A split that fell away (a board drill landed the group on it, AFTER
  // validation) leaves the formula as the one column - the save-time rule
  // still wants a split or a measure, so this goes straight to the data.
  const bare = sanitize_widget(Object.assign({}, table, { split_by: null, table: { mode: "summary", columns: [], totals: { row: true, column: false } } }));
  bare.form_group_id = FORM;
  assert.ok(errors_of(Object.assign({}, table, { split_by: null, table: { mode: "summary", columns: [] } })).some((error) => error.includes("needs a split field")), "saving it without either is still refused");
  const unsplit = await compute_widget_data(bare, FORM_VERSION, null);
  assert.deepStrictEqual(unsplit.columns.map((column) => column.key), ["value"], "a split table without its split degrades to one column of its formula");
  assert.strictEqual(unsplit.table_totals.row.cells.value, 4, "and that column still counts every facility");
  const average = await compute(Object.assign({}, table, { metric: { aggregation: "avg", field_id: DEATHS }, filters: [{ field_id: PURPOSE, operator: "eq", value: "household_loss" }], split_by: { field_id: DRIVER } }));
  assert.strictEqual(average.table_totals.column, false, "an average has no total column");
  assert.ok(average.table_totals.row && typeof average.table_totals.row.cells.fire === "number", "but its total row is computed again over the shown rows");
}

/**
 * A widget INSIDE A CANVAS is fetched on its own, like every widget; the
 * canvas it names is not in that request. Judged alone it used to be
 * refused ("the canvas it sits in is not on this dashboard"), which left
 * every card inside a section without data. Nesting is the board's
 * business at save time, not the card's at data time.
 */
async function test_a_widget_inside_a_canvas_computes_alone() {
  const child = base({ id: "in_section", parent_id: "some_section", box: { flow: "row" } });
  const results = await compute_dashboard_results({ widgets: [child] }, FORM, FORM_VERSION, PROJECT);
  assert.strictEqual(results[0].error, undefined, `a widget in a canvas computes on its own: ${JSON.stringify(results[0].messages || null)}`);
  assert.strictEqual(results[0].value, HOUSEHOLDS);
  // Saving the whole board still refuses a child whose canvas is missing.
  const saved = validate_dashboard([Object.assign(sanitize_widget(child), { form_group_id: FORM })], versions, PROJECT);
  assert.ok(saved.errors.some((error) => error.includes("canvas it sits in")), "the save-time check still guards nesting");
}

async function test_text_block_computes_to_nothing() {
  const data = await compute(base({ chart_type: "text", filters: [], text: { heading: "Observations", body: "High-risk hotspots (==65%==) need **urgent** action." } }));
  assert.deepStrictEqual(data, { kind: "text", values: {} }, "a text block without figures carries no data at all");
  // LIVE FIGURES: computed under the block's own filters (household loss here).
  const body = `{{count}} households; {{count(${DRIVER} = fire)}} by fire; {{sum(${INJURED} | ${DRIVER} = heavy_rain)}} injured in rain; {{share(${DRIVER} = fire)}} of them fire; {{avg(${DEATHS})}} deaths on average; {{count_distinct(${DISTRICT})}} districts; twice {{count}}`;
  const live = await compute(base({ chart_type: "text", text: { heading: "", body } }));
  assert.strictEqual(live.kind, "text");
  assert.strictEqual(live.values["{{count}}"], HOUSEHOLDS, "count is every record in scope");
  assert.strictEqual(live.values[`{{count(${DRIVER} = fire)}}`], 5, "count(field = value) narrows to that value");
  assert.strictEqual(live.values[`{{sum(${INJURED} | ${DRIVER} = heavy_rain)}}`], 9, "a sum under a condition adds only those records");
  assert.strictEqual(live.values[`{{share(${DRIVER} = fire)}}`], 41.7, "share is a percent of the records in scope, one decimal");
  assert.strictEqual(live.values[`{{avg(${DEATHS})}}`], 0.42, "an average reads the answered numbers");
  assert.strictEqual(live.values[`{{count_distinct(${DISTRICT})}}`], 3);
  assert.strictEqual(Object.keys(live.values).length, 6, "a figure written twice is computed once");
  const windowed = await compute(base({ chart_type: "text", text: { heading: "", body: "{{count}}" } }), AUGUST);
  assert.strictEqual(windowed.values["{{count}}"], AUG_HOUSEHOLDS, "the figures follow the board's window");
  // A title band is a text block with a heading and no title of its own.
  assert.deepStrictEqual(errors_of(base({ chart_type: "text", title: "", text: { heading: "DISASTER IMPACT" } })), [], "a text block needs no title");
  const stored = sanitize_widget(base({ chart_type: "text", text: { heading: "  Title  ", body: "Body\n\n", align: "center", size: "lg", accent: "#39D7FF" } })).text;
  assert.deepStrictEqual(stored, { heading: "Title", body: "Body", align: "center", size: "lg", accent: "#39d7ff" });
}

function test_validator_refusals() {
  const said = (raw, fragment) => {
    const errors = errors_of(raw);
    assert.ok(errors.some((error) => error.includes(fragment)), `expected an error mentioning "${fragment}", got: ${errors.join(" | ") || "(none)"}`);
  };
  said(base({ chart_type: "text", text: { heading: "", body: "" } }), "needs a heading or a body");
  said(base({ chart_type: "text", text: { heading: "x" }, group_by: { field_id: DISTRICT } }), "reads no fields");
  said(base({ chart_type: "text", text: { heading: "x", body: "{{count(nope_f = 1)}}" } }), "unknown field nope_f");
  said(base({ chart_type: "text", text: { heading: "x", body: `{{share(${DRIVER})}}` } }), "share needs a field = value");
  said(base({ chart_type: "text", text: { heading: "x", body: "{{median(x)}}" } }), "unknown formula");
  said(base({ chart_type: "text", text: { heading: "x", body: Array.from({ length: 21 }, (_, index) => `{{count(${DEATHS} = ${index})}}`).join(" ") } }), "at most 20 figures");
  said(base({ chart_type: "table", table: { mode: "records", fields: [] } }), "at least one field");
  said(base({ chart_type: "table", table: { mode: "records", fields: ["nope_f"], page_size: 10 } }), "is unknown");
  said(base({ chart_type: "table", table: { mode: "summary", columns: [] } }), "groups by a choice field");
  said(base({ chart_type: "table", group_by: { field_id: DISTRICT }, table: { mode: "summary", columns: [] } }), "at least one measure column");
  said(base({ chart_type: "table", group_by: { field_id: DISTRICT }, table: { mode: "summary", columns: [{ aggregation: "median", field_id: DEATHS }] } }), "cannot be a table column");
  said(base({ chart_type: "table", group_by: { field_id: DISTRICT }, table: { mode: "summary", columns: [{ aggregation: "sum" }] } }), "needs a field of the form");
  said(base({ chart_type: "table", group_by: { field_id: DISTRICT }, split_by: { field_id: FACILITY }, table: { mode: "summary", columns: [{ aggregation: "count" }] } }), "not both");
  said(base({ chart_type: "table", group_by: { field_id: DISTRICT }, split_by: { field_id: FACILITY }, metric: { aggregation: "occurrences", field_id: DRIVER }, table: { mode: "summary" } }), "cannot fill the cells");
  said(base({ pinned_fields: ["nope_f"] }), "pinned field 1 is unknown");
  said(base({ pinned_fields: [DEATHS] }), "not a field that can filter");
  assert.deepStrictEqual(errors_of(base({ pinned_fields: [DISTRICT, DRIVER] })), [], "pinning two filter fields is fine");
  // Validation of the direct page-size rule (the sanitizer clamps, so feed the validator a widget it did not clean).
  const raw = sanitize_widget(base({ chart_type: "table", table: { mode: "records", fields: [NAME], page_size: 10 } }));
  raw.form_group_id = FORM;
  raw.table.page_size = 7;
  assert.ok(validate_dashboard([raw], versions, PROJECT).errors.some((error) => error.includes("between 10 and 100")), "a page size outside 10..100 is refused");
}

let client = null;
let server = null;

async function run_all_tests() {
  // A loaded machine can take longer than the library's ten seconds.
  server = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  client = await MongoClient.connect(server.getUri());
  const db = client.db("data_collection_system");
  await db.collection("dcs_submissions").insertMany(RECORDS);
  await db.collection("dcs_submissions").createIndex({ form_group_id: 1, submitted_at: -1 });
  set_db_handles(db, client.db("cok"));
  try {
    await test_locked_period_ignores_the_board_date();
    await test_pinned_widget_keeps_its_breakdown();
    await test_records_table_pages_and_clamps();
    await test_records_table_follows_the_share_link_policy();
    await test_summary_table_with_measure_columns();
    await test_summary_table_with_split_columns();
    await test_a_widget_inside_a_canvas_computes_alone();
    await test_text_block_computes_to_nothing();
    test_validator_refusals();
  } finally {
    await client.close();
    await server.stop();
  }
}

run_all_tests().then(
  () => {
    process.stdout.write("ALL_TESTS_PASSED\n");
    process.exit(0);
  },
  (error) => {
    process.stdout.write(`${error && error.stack ? error.stack : error}\n`);
    process.exit(1);
  },
);
