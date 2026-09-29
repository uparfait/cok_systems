const assert = require("assert");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { MongoClient, ObjectId } = require("mongodb");
const { set_db_handles } = require("../db_connection/db.js");
const dashboards_model = require("../util-dashboard/dashboards_model.js");
const { sanitize_board_appearance, sanitize_widget } = require("../util-dashboard/sanitize.js");
const { validate_dashboard } = require("../util-dashboard/widget_validation.js");
const { WIDGET_SIZES, KPI_SIZES, KPI_PER_ROW } = require("../util-dashboard/constants.js");

/**
 * A BOARD'S OWN COLORS and the sizes a widget may claim:
 *
 *   - only a real background makes a colored board; a border or a text
 *     color on its own is not one, and anything that is not a hex color
 *     is refused;
 *   - the colors are saved on ONE board without touching its widgets, its
 *     filters or its arrangement, and without touching the form's other
 *     boards;
 *   - or on EVERY board of the form in one write, which is what the
 *     "paint every dashboard of this form" tick does;
 *   - null puts a board back to the system's own look;
 *   - a KPI card may claim the extra size below small ("xs"), and a size
 *     nobody recognizes is still refused.
 */

const FORM = "colors-form";
const PROJECT = new ObjectId();
const say = (text) => process.stdout.write(`${text}\n`);

const SCHEMA = { fields: [{ id: "sel", type: "single_select", label: "Choice", options: [{ value: "a", label: "A" }] }] };
const FORM_VERSION = { form_group_id: FORM, project_id: PROJECT.toString(), version: 1, is_active: true, tracking: null, schema: SCHEMA };

const kpi_widget = (size) =>
  sanitize_widget({
    id: `w_${size}`,
    form_group_id: FORM,
    title: `Card ${size}`,
    chart_type: "kpi",
    metric: { aggregation: "count", field_id: null },
    group_by: null,
    filters: [],
    period: { preset: "all", from: null, to: null },
    size,
    position: 0,
  });

function test_only_a_background_colors_a_board() {
  assert.strictEqual(sanitize_board_appearance(null), null);
  assert.strictEqual(sanitize_board_appearance({}), null);
  assert.strictEqual(sanitize_board_appearance({ border: "#ff0000" }), null, "a border alone is not a colored board");
  assert.strictEqual(sanitize_board_appearance({ text: "#ff0000" }), null, "a text color alone is not either");
  assert.strictEqual(sanitize_board_appearance({ background: "red" }), null, "a color name is not a hex color");
  assert.strictEqual(sanitize_board_appearance({ background: "#12345" }), null, "five digits is not a hex color");
  assert.deepStrictEqual(sanitize_board_appearance({ background: " #0F171F " }), { background: "#0f171f" }, "trimmed and lowercased");
  assert.deepStrictEqual(sanitize_board_appearance({ background: "#0f171f", border: "#2E3B48", text: "#f2f5f8", nonsense: "#000000" }), { background: "#0f171f", border: "#2e3b48", text: "#f2f5f8" }, "and nothing else");
  assert.deepStrictEqual(sanitize_board_appearance({ background: "#0f171f", border: "not a color" }), { background: "#0f171f" }, "a bad border is dropped, the board stays colored");
  say("colors: only a real background makes a colored board; borders and text are optional and hex only");
}

function test_the_sizes_a_widget_may_claim() {
  assert.deepStrictEqual(WIDGET_SIZES, ["xs", "small", "medium", "large", "full"]);
  assert.deepStrictEqual(KPI_SIZES, ["xs", "small", "medium", "large"]);
  assert.deepStrictEqual(KPI_PER_ROW, { xs: 12, small: 6, medium: 4, large: 3 });
  const versions = new Map([[FORM, FORM_VERSION]]);
  KPI_SIZES.forEach((size) => {
    const check = validate_dashboard([kpi_widget(size)], versions, PROJECT);
    assert.ok(check.valid, `a KPI card may be ${size}: ${(check.errors || []).join("; ")}`);
  });
  const refused = validate_dashboard([kpi_widget("enormous")], versions, PROJECT);
  assert.strictEqual(refused.valid, false, "a size nobody recognizes is refused");
  assert.ok(refused.errors.join(" ").toLowerCase().includes("size"), `the refusal names the size: ${refused.errors.join("; ")}`);
  say(`sizes: ${WIDGET_SIZES.join(", ")}; a KPI row holds ${Object.entries(KPI_PER_ROW).map(([size, count]) => `${count} ${size}`).join(", ")}`);
}

async function test_one_board_is_colored_alone() {
  const first = await dashboards_model.create_dashboard(FORM, PROJECT, "Board one");
  const second = await dashboards_model.create_dashboard(FORM, PROJECT, "Board two");
  const third = await dashboards_model.create_dashboard(FORM, PROJECT, "Board three");
  assert.strictEqual(first.appearance, null, "a new board wears the system's own colors");
  // Something to be left alone by a recoloring.
  await dashboards_model.save_widgets(FORM, first._id, [kpi_widget("xs")], [{ field_id: "sel" }], { mode: "grid", width: 1280 });

  const colors = { background: "#0f171f", border: "#2e3b48" };
  const painted = await dashboards_model.save_appearance(FORM, first._id, colors);
  assert.deepStrictEqual(painted.appearance, colors);
  assert.strictEqual(painted.widgets.length, 1, "its widgets are untouched");
  assert.deepStrictEqual(painted.filters, [{ field_id: "sel" }], "its filters are untouched");
  assert.deepStrictEqual(painted.layout, { mode: "grid", width: 1280 }, "its arrangement is untouched");
  assert.strictEqual((await dashboards_model.get_dashboard_by_id(FORM, second._id)).appearance, null, "the form's other boards are untouched");
  assert.deepStrictEqual(dashboards_model.strip_dashboard(painted).appearance, colors, "every route hands the colors back");

  // And back to the system's own look.
  const bare = await dashboards_model.save_appearance(FORM, first._id, null);
  assert.strictEqual(bare.appearance, null);
  assert.strictEqual(bare.widgets.length, 1, "resetting the colors keeps the widgets");
  say(`one board: painted ${colors.background} / ${colors.border}, then reset, with its widgets, filters and arrangement intact`);
  return [first, second, third];
}

async function test_every_board_of_the_form_at_once(boards) {
  const colors = { background: "#fdf6e3", border: "#d8cfb4", text: "#3b3a32" };
  const painted = await dashboards_model.save_appearance_for_form(FORM, colors);
  assert.strictEqual(painted, boards.length, `all ${boards.length} boards of the form were painted, not ${painted}`);
  const all = await dashboards_model.list_dashboards_by_form(FORM);
  assert.strictEqual(all.length, boards.length);
  all.forEach((board) => assert.deepStrictEqual(board.appearance, colors, `${board.name} carries the colors`));
  // Another form's boards are not this form's business.
  const other = await dashboards_model.create_dashboard("another-form", PROJECT, "Elsewhere");
  assert.strictEqual((await dashboards_model.get_dashboard_by_id("another-form", other._id)).appearance, null, "another form's board is left alone");
  const cleared = await dashboards_model.save_appearance_for_form(FORM, null);
  assert.strictEqual(cleared, boards.length);
  (await dashboards_model.list_dashboards_by_form(FORM)).forEach((board) => assert.strictEqual(board.appearance, null));
  say(`every board: ${boards.length} painted in one write and ${cleared} put back, another form untouched`);
}

async function run_all_tests() {
  test_only_a_background_colors_a_board();
  test_the_sizes_a_widget_may_claim();
  // A loaded machine can take longer than the library's ten seconds to
  // bring mongod up; a minute is patience, not a hang.
  const server = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  const client = await MongoClient.connect(server.getUri());
  try {
    set_db_handles(client.db("data_collection_system"), client.db("cok"));
    const boards = await test_one_board_is_colored_alone();
    await test_every_board_of_the_form_at_once(boards);
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
