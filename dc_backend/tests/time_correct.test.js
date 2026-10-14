const assert = require("assert");
const express = require("express");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { MongoClient, ObjectId } = require("mongodb");
const { set_db_handles } = require("../db_connection/db.js");

/**
 * The user's own example, through every reader: a status "alive" from
 * 12/12/2023 13:00 to 13:50 and "dead" from 13:51, a name "a" until 13:20
 * and "b" after. A period ending 13:30 must read alive and b; one ending
 * 13:10 reads a; one ending 14:00 reads dead. A window [13:00, 13:30]
 * includes the record, [15:00, 16:00] does not. The over-time chart shows
 * the state during each hour. The table, the KPI, the category chart, the
 * filter values, the records behind a widget, the submissions-over-time
 * chart, the export, the data feed and a public share link all agree, and
 * with no period at all everything reads today's values.
 */

const FORM = "time-correct";
const ID = "id_f";
const STATUS = "status_f";
const NAME = "name_f";
const TRACKING = { enabled: true, key_field_ids: [ID], key_field_id: ID, key_unique: true, editable_field_ids: [STATUS, NAME] };

const SCHEMA = {
  fields: [
    { id: ID, type: "text", label: { en: "Id" } },
    {
      id: STATUS,
      type: "single_select",
      label: { en: "Status" },
      options: [
        { id: "o1", value: "alive", label: { en: "Alive" } },
        { id: "o2", value: "dead", label: { en: "Dead" } },
      ],
    },
    { id: NAME, type: "text", label: { en: "Name" } },
  ],
};

const at = (time) => new Date(`2023-12-12T${time}Z`);
const T1300 = at("13:00:00.000");
const T1305 = at("13:05:00.000");
const T1320 = at("13:20:00.000");
const T1351 = at("13:51:00.000");
const T1410 = at("14:10:00.000");

const W_1310 = { start: T1300, end: at("13:10:00.000") };
const W_1330 = { start: T1300, end: at("13:30:00.000") };
const W_1400 = { start: T1300, end: at("14:00:00.000") };
const W_NONE = { start: at("15:00:00.000"), end: at("16:00:00.000") };
const W_COVER = { start: T1300, end: at("14:59:59.999") };

const period_of = (window) => ({ preset: "custom", from: window.start.toISOString(), to: window.end.toISOString() });
const span = (value, from, to) => ({ value, from, to: to || null });

const RECORDS = [
  // p1: alive and "a" at 13:00, "b" from 13:20, dead from 13:51.
  {
    _id: new ObjectId("0000000000000000000000c1"),
    form_group_id: FORM,
    version: 1,
    submitted_at: T1300,
    updated_at: T1351,
    record_key: "p1",
    record_key_pairs: [{ f: ID, k: "p1" }],
    record_key_fields: ID,
    data: { [ID]: "p1", [STATUS]: "dead", [NAME]: "b" },
    tracking_periods: { [STATUS]: [span("alive", T1300, T1351), span("dead", T1351)], [NAME]: [span("a", T1300, T1320), span("b", T1320)] },
    history: [
      { at: T1300, kind: "created", by: null, changes: [] },
      { at: T1320, kind: "updated", by: null, changes: [{ field_id: NAME, from: "a", to: "b" }] },
      { at: T1351, kind: "updated", by: null, changes: [{ field_id: STATUS, from: "alive", to: "dead" }] },
    ],
  },
  // p2: alive and "c" at 13:05, dead from 14:10.
  {
    _id: new ObjectId("0000000000000000000000c2"),
    form_group_id: FORM,
    version: 1,
    submitted_at: T1305,
    updated_at: T1410,
    record_key: "p2",
    record_key_pairs: [{ f: ID, k: "p2" }],
    record_key_fields: ID,
    data: { [ID]: "p2", [STATUS]: "dead", [NAME]: "c" },
    tracking_periods: { [STATUS]: [span("alive", T1305, T1410), span("dead", T1410)], [NAME]: [span("c", T1305)] },
    history: [
      { at: T1305, kind: "created", by: null, changes: [] },
      { at: T1410, kind: "updated", by: null, changes: [{ field_id: STATUS, from: "alive", to: "dead" }] },
    ],
  },
];

const TOKEN = "0123456789abcdef0123456789abcdef0123456789abcdef";

let server = null;
let client = null;
let db = null;
let http = null;
let base = "";
let form_version = null;
let project = null;

async function run_all_tests() {
  server = await MongoMemoryServer.create();
  client = await MongoClient.connect(server.getUri());
  db = client.db("dcs_time_correct");
  set_db_handles(db, client.db("cok_test"));

  project = { _id: new ObjectId(), name: "P", created_by: new ObjectId().toString(), access_control_enabled: false, created_at: new Date() };
  await db.collection("dcs_projects").insertOne(project);
  form_version = { form_group_id: FORM, version: 1, is_active: true, form_name: "People", project_id: project._id.toString(), schema: SCHEMA, tracking: TRACKING, created_at: T1300, updated_at: T1300 };
  await db.collection("dcs_forms").insertOne(form_version);
  await db.collection("dcs_submissions").insertMany(RECORDS);
  await db.collection("dcs_submissions").createIndex({ form_group_id: 1, submitted_at: -1 });

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.language = "en";
    next();
  });
  app.use("/dcs/api/public", require("../routes/public/routes.js"));
  http = app.listen(0);
  base = `http://127.0.0.1:${http.address().port}/dcs/api/public`;

  try {
    await test_the_table_reads_as_of_the_period_end();
    await test_the_name_reads_as_it_was();
    await test_kpi_category_and_filter_values_read_as_of_the_end();
    await test_the_records_behind_a_widget_read_as_of_the_end();
    await test_over_time_shows_the_state_during_each_hour();
    await test_export_and_feed_read_the_same();
    await test_a_share_link_reads_like_the_signed_in_board();
    await test_no_period_reads_today();
  } finally {
    await new Promise((resolve) => http.close(resolve));
    await client.close();
    await server.stop();
  }
}

const submissions_model = require("../models/submissions_model.js");
const { compute_widget_data } = require("../util-dashboard/widget_data.js");

/** The table rows of a window, keyed by id: "status/name". */
async function table_rows(window) {
  const result = await submissions_model.list_submissions(FORM, undefined, 1, 50, window, { tracking: TRACKING });
  const out = {};
  result.items.forEach((item) => {
    out[item.data[ID]] = { status: item.data[STATUS], name: item.data[NAME], as_of: item.as_of };
  });
  return out;
}

function kpi_widget(status_value, window) {
  return { id: `kpi_${status_value}`, form_group_id: FORM, title: "Card", chart_type: "kpi", metric: { aggregation: "count", field_id: null }, filters: [{ field_id: STATUS, operator: "eq", value: status_value }], period: window ? period_of(window) : { preset: "all" } };
}

const kpi = async (status_value, window) => (await compute_widget_data(kpi_widget(status_value, window), form_version, null)).value;

/** A period ending 13:30 reads alive; one ending 14:00 reads dead; [15:00, 16:00] holds nothing. */
async function test_the_table_reads_as_of_the_period_end() {
  const at_1330 = await table_rows(W_1330);
  assert.deepStrictEqual(Object.keys(at_1330).sort(), ["p1", "p2"], "both records were created inside [13:00, 13:30]");
  assert.strictEqual(at_1330.p1.status, "alive", "at 13:30 p1 was still alive - it died at 13:51");
  assert.strictEqual(at_1330.p1.as_of.getTime(), W_1330.end.getTime(), "and the row says it reads as of 13:30");
  assert.strictEqual(at_1330.p2.status, "alive", "p2 too");
  const at_1400 = await table_rows(W_1400);
  assert.strictEqual(at_1400.p1.status, "dead", "at 14:00 p1 reads dead");
  assert.strictEqual(at_1400.p2.status, "alive", "but p2 only died at 14:10");
  assert.deepStrictEqual(await table_rows(W_NONE), {}, "a window after everything happened holds no record");
}

/** The name "a" until 13:20 and "b" after reads "a" for a period ending before that moment. */
async function test_the_name_reads_as_it_was() {
  assert.strictEqual((await table_rows(W_1310)).p1.name, "a", "at 13:10 the name was a");
  assert.strictEqual((await table_rows(W_1330)).p1.name, "b", "at 13:30 it was b");
  assert.strictEqual((await table_rows(W_1310)).p2.name, "c", "p2, created 13:05, is there too");
}

/** The cards, a category chart and the filter dropdown count the state at the end. */
async function test_kpi_category_and_filter_values_read_as_of_the_end() {
  const values_model = require("../models/submission_values_model.js");
  assert.strictEqual(await kpi("alive", W_1330), 2, "at 13:30 both were alive");
  assert.strictEqual(await kpi("dead", W_1330), 0, "nobody was dead at 13:30");
  assert.strictEqual(await kpi("alive", W_1400), 1, "at 14:00 p2 was alive");
  assert.strictEqual(await kpi("dead", W_1400), 1, "and p1 was dead");
  assert.strictEqual(await kpi("dead", W_NONE), 0, "nothing happened between 15:00 and 16:00");
  const category = { id: "cat", form_group_id: FORM, title: "By status", chart_type: "bar", metric: { aggregation: "count", field_id: null }, group_by: { field_id: STATUS }, filters: [], period: period_of(W_1330) };
  const chart = await compute_widget_data(category, form_version, null);
  const by_label = {};
  (chart.rows || []).forEach((row) => {
    by_label[row.label] = row.value;
  });
  assert.strictEqual(by_label.alive, 2, "the category chart at 13:30 shows two alive");
  assert.strictEqual(by_label.dead, undefined, "and no dead");
  const values = await values_model.list_field_values(FORM, STATUS, W_1400, null, TRACKING);
  assert.deepStrictEqual(values.map((entry) => `${entry.value}=${entry.count}`).sort(), ["alive=1", "dead=1"], "the filter dropdown at 14:00 offers alive 1 and dead 1");
}

/** The records a card opens are read as the card counted them. */
async function test_the_records_behind_a_widget_read_as_of_the_end() {
  const { compute_widget_records } = require("../util-dashboard/widget_records.js");
  const alive_at_1330 = await compute_widget_records({ widget: kpi_widget("alive", W_1330), page: 1, limit: 20 }, FORM, form_version, project._id);
  assert.strictEqual(alive_at_1330.total, 2, "two records behind the alive card at 13:30");
  assert.ok(alive_at_1330.items.every((item) => item.data[STATUS] === "alive"), "each shown alive, as it was");
  const dead_at_1400 = await compute_widget_records({ widget: kpi_widget("dead", W_1400), page: 1, limit: 20 }, FORM, form_version, project._id);
  assert.strictEqual(dead_at_1400.total, 1, "one record behind the dead card at 14:00");
  assert.strictEqual(dead_at_1400.items[0].data[ID], "p1", "p1");
}

/** Over time, each hour shows the state during that hour: alive in the 13:00 column, dead in the 14:00 one. */
async function test_over_time_shows_the_state_during_each_hour() {
  const widget = { id: "ot", form_group_id: FORM, title: "Over time", chart_type: "bar", metric: { aggregation: "count", field_id: null }, group_by: { field_id: STATUS }, over_time: { enabled: true, field_id: "submitted_at", granularity: "hour" }, split_by: { field_id: STATUS }, filters: [], period: period_of(W_COVER) };
  const data = await compute_widget_data(widget, form_version, null);
  assert.ok(Array.isArray(data.rows) && data.rows.length === 2, `two hourly columns, got ${JSON.stringify(data.rows)}`);
  assert.strictEqual(data.rows[0].alive, 3, "the 13:00 column holds every moment someone was alive: p1 at 13:00 and 13:20, p2 at 13:05");
  assert.strictEqual(data.rows[0].dead, 1, "and p1's death at 13:51");
  assert.strictEqual(data.rows[1].dead, 1, "the 14:00 column holds p2's death at 14:10");
  assert.strictEqual(data.rows[1].alive || 0, 0, "and nobody alive");
  const chart = await submissions_model.count_submissions_over_time(FORM, W_COVER.start, W_COVER.end, "hour", 0, "monday", TRACKING);
  assert.deepStrictEqual(chart.buckets.map((bucket) => `${bucket.at.toISOString().slice(11, 16)}=${bucket.count}`), ["13:00=4", "14:00=1"], "the submissions-over-time chart counts the moments the same way");
  assert.strictEqual(chart.total, 5, "five moments in all");
}

/** The Excel export and the Power BI feed read exactly as the table does. */
async function test_export_and_feed_read_the_same() {
  const shape = (rows) => rows.map((row) => `${row.data[ID]}:${row.data[STATUS]}/${row.data[NAME]}`).sort();
  assert.deepStrictEqual(shape(await submissions_model.stream_in_range(FORM, W_1330, TRACKING).toArray()), ["p1:alive/b", "p2:alive/c"], "the export at 13:30");
  assert.deepStrictEqual(shape(await submissions_model.stream_in_range(FORM, W_1400, TRACKING).toArray()), ["p1:dead/b", "p2:alive/c"], "the export at 14:00");
  assert.strictEqual(await submissions_model.count_in_range(FORM, W_NONE, TRACKING), 0, "nothing to export for [15:00, 16:00]");
  assert.deepStrictEqual(shape(await submissions_model.stream_feed(FORM, { start: W_1330.start, end: W_1330.end }, 0, 0, 100, TRACKING).toArray()), ["p1:alive/b", "p2:alive/c"], "the feed at 13:30");
  assert.deepStrictEqual(shape(await submissions_model.stream_feed(FORM, { start: W_1400.start, end: W_1400.end }, 0, 0, 100, TRACKING).toArray()), ["p1:dead/b", "p2:alive/c"], "the feed at 14:00");
  assert.strictEqual(await submissions_model.count_feed(FORM, { start: W_1330.start, end: W_1330.end }, TRACKING), 2, "the feed counts the same two");
}

/** A public share link computes exactly what the signed-in board computes. */
async function test_a_share_link_reads_like_the_signed_in_board() {
  const { compute_dashboard_results } = require("../util-dashboard/compute_results.js");
  const dashboard = { _id: new ObjectId(), form_group_id: FORM, name: "Board", widgets: [kpi_widget("alive"), kpi_widget("dead")], filters: [], created_at: new Date(), updated_at: new Date() };
  await db.collection("dcs_dashboards").insertOne(dashboard);
  await db.collection("dcs_dashboard_links").insertOne({ token: TOKEN, form_group_id: FORM, dashboard_id: dashboard._id.toString(), title: "Shared", config: {}, expires_at: null, created_at: new Date(), views: 0 });
  for (const window of [W_1330, W_1400]) {
    const body = { widgets: [kpi_widget("alive"), kpi_widget("dead")], period: period_of(window) };
    const signed_in = await compute_dashboard_results(body, FORM, form_version, project._id, [], null);
    const response = await fetch(`${base}/dashboard/${TOKEN}/data`, { method: "POST", headers: { "content-type": "application/json", "x-language": "en" }, body: JSON.stringify(body) });
    assert.strictEqual(response.status, 200, "the public link answers");
    const shared = (await response.json()).data.results;
    const values = (results) => results.map((entry) => `${entry.widget_id}=${entry.value}`).sort();
    assert.deepStrictEqual(values(shared), values(signed_in), "the shared board shows the very same figures");
    const expected = window === W_1330 ? ["kpi_alive=2", "kpi_dead=0"] : ["kpi_alive=1", "kpi_dead=1"];
    assert.deepStrictEqual(values(shared), expected, "and they are the as-of figures");
  }
}

/** No period: today's values, every record. */
async function test_no_period_reads_today() {
  const rows = await table_rows(null);
  assert.strictEqual(rows.p1.status, "dead", "p1 is dead today");
  assert.strictEqual(rows.p1.name, "b", "and named b");
  assert.strictEqual(rows.p2.status, "dead", "p2 is dead today");
  assert.strictEqual(rows.p1.as_of, undefined, "no period, no as_of");
  assert.strictEqual(await kpi("dead"), 2, "the dead card reads two today");
  assert.strictEqual(await kpi("alive"), 0, "and the alive card none");
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
