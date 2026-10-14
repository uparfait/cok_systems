const assert = require("assert");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { MongoClient, ObjectId } = require("mongodb");
const { set_db_handles } = require("../db_connection/db.js");
const { sanitize_board_layout } = require("../util-dashboard/sanitize.js");
const dashboards_model = require("../util-dashboard/dashboards_model.js");
const dashboards = require("../util-dashboard/controllers/dashboards.js");

/**
 * THE ORDER OF A BOARD.
 *
 * A board shows its KPI cards first and its charts after them until
 * somebody changes a widget's position; from then on the saved widget
 * array IS the order, marked by layout.ordered = true. This test checks
 * that the flag survives the sanitizer (and nothing else does), that a
 * save through the dashboard route stores it, that a read gives it back,
 * and that a save which sends no layout leaves it as it was.
 */

const FORM = "order-form";
const FIELD = "purpose_f";
const USER_ID = new ObjectId().toString();
const PROJECT_ID = new ObjectId();

const FORM_VERSION = {
  form_group_id: FORM,
  project_id: PROJECT_ID.toString(),
  version: 1,
  is_active: true,
  created_by: USER_ID,
  schema: {
    fields: [{ id: FIELD, type: "single_select", label: { en: "Purpose" }, options: [{ id: "p1", value: "household_loss" }, { id: "p2", value: "infrastructure" }] }],
  },
};

const PROJECT = { _id: PROJECT_ID, name: "Order project", created_by: USER_ID, access_control_enabled: false };

const kpi = (id, position) => ({ id, form_group_id: FORM, title: `KPI ${id}`, chart_type: "kpi", metric: { aggregation: "count", field_id: null }, filters: [], period: { preset: "all", from: null, to: null }, position });
const chart = (id, position) => ({ id, form_group_id: FORM, title: `Chart ${id}`, chart_type: "bar", metric: { aggregation: "count", field_id: null }, group_by: { field_id: FIELD }, filters: [], period: { preset: "all", from: null, to: null }, sort: "value_desc", limit: 12, position });

/** A response object that remembers what the controller answered. */
function fake_response() {
  const res = { status_code: 0, body: null };
  res.status = (code) => {
    res.status_code = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

const request = (dashboard_id, body) => ({ params: { form_group_id: FORM, dashboard_id }, body, user: { user_id: USER_ID }, language: "en" });

function test_sanitize_board_layout_keeps_ordered() {
  assert.deepStrictEqual(sanitize_board_layout({ mode: "grid", width: 1280, ordered: true }), { mode: "grid", width: 1280, ordered: true }, "ordered true is kept");
  assert.deepStrictEqual(sanitize_board_layout({ mode: "studio", width: 900, ordered: false }), { mode: "studio", width: 900, ordered: false }, "ordered false is kept");
  assert.strictEqual(sanitize_board_layout({ mode: "grid", width: 1280 }).ordered, false, "a layout without the flag is not ordered");
  ["yes", "true", 1, {}, [], null].forEach((value) => {
    assert.strictEqual(sanitize_board_layout({ mode: "grid", width: 1280, ordered: value }).ordered, false, `only a real true orders a board, not ${JSON.stringify(value)}`);
  });
  const stray = sanitize_board_layout({ mode: "grid", width: 1280, ordered: true, junk: 1, $set: { widgets: [] } });
  assert.deepStrictEqual(Object.keys(stray).sort(), ["mode", "ordered", "width"], "nothing but mode, width and ordered survives");
  assert.strictEqual(sanitize_board_layout(null), null);
  assert.strictEqual(sanitize_board_layout("grid"), null);
}

async function test_put_saves_ordered_and_get_returns_it() {
  const created = await dashboards_model.create_dashboard(FORM, PROJECT_ID, "Ordered board");
  assert.deepStrictEqual(created.layout, { mode: "grid", width: 1280, ordered: false }, "a new board shows KPI cards first");
  const id = created._id.toString();

  const saving = fake_response();
  await dashboards.save_dashboard_by_id(request(id, { widgets: [chart("b", 0), kpi("a", 1), kpi("c", 2)], layout: { mode: "grid", width: 1280, ordered: true, junk: "x" } }), saving);
  assert.strictEqual(saving.status_code, 200, `the save is accepted: ${JSON.stringify(saving.body)}`);
  assert.deepStrictEqual(saving.body.data.layout, { mode: "grid", width: 1280, ordered: true }, "the save answers with the ordered layout and nothing stray");
  assert.deepStrictEqual(saving.body.data.widgets.map((widget) => widget.id), ["b", "a", "c"], "the widgets keep the order they were sent in");
  assert.deepStrictEqual(saving.body.data.widgets.map((widget) => widget.position), [0, 1, 2], "and their positions");

  const reading = fake_response();
  await dashboards.get_dashboard_by_id(request(id, {}), reading);
  assert.strictEqual(reading.status_code, 200, `the read is accepted: ${JSON.stringify(reading.body)}`);
  assert.deepStrictEqual(reading.body.data.layout, { mode: "grid", width: 1280, ordered: true }, "a read gives the flag back");
  assert.deepStrictEqual(reading.body.data.widgets.map((widget) => widget.id), ["b", "a", "c"], "in the saved order");

  const without_layout = fake_response();
  await dashboards.save_dashboard_by_id(request(id, { widgets: [kpi("a", 0), chart("b", 1), kpi("c", 2)] }), without_layout);
  assert.strictEqual(without_layout.status_code, 200);
  assert.strictEqual(without_layout.body.data.layout.ordered, true, "a save that sends no layout leaves the flag as it was");
  const stored = await dashboards_model.get_dashboard_by_id(FORM, id);
  assert.strictEqual(stored.layout.ordered, true, "and so does the stored document");

  const turning_off = fake_response();
  await dashboards.save_dashboard_by_id(request(id, { widgets: [kpi("a", 0), chart("b", 1), kpi("c", 2)], layout: { mode: "grid", width: 1280, ordered: false } }), turning_off);
  assert.strictEqual(turning_off.status_code, 200);
  assert.strictEqual(turning_off.body.data.layout.ordered, false, "ordered false is stored like any other value");

  const lying = fake_response();
  await dashboards.save_dashboard_by_id(request(id, { widgets: [kpi("a", 0)], layout: { mode: "grid", width: 1280, ordered: "true" } }), lying);
  assert.strictEqual(lying.body.data.layout.ordered, false, "a string is not a flag");
}

let client = null;
let server = null;

async function run_all_tests() {
  server = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  client = await MongoClient.connect(server.getUri());
  const db = client.db("data_collection_system");
  await db.collection("dcs_forms").insertOne(FORM_VERSION);
  await db.collection("dcs_projects").insertOne(PROJECT);
  set_db_handles(db, client.db("cok"));
  try {
    test_sanitize_board_layout_keeps_ordered();
    await test_put_saves_ordered_and_get_returns_it();
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
