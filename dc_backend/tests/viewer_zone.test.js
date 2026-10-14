// The server is UTC here (the deployed stack is), the viewer is in Kigali.
process.env.TZ = "UTC";

const assert = require("assert");
const express = require("express");
const ExcelJS = require("exceljs");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { MongoClient, ObjectId } = require("mongodb");
const { set_db_handles } = require("../db_connection/db.js");
const { resolve_period_bounds } = require("../utilities/period_bounds.js");
const { wall_clock, zoned_to_utc, zone_of } = require("../utilities/time_zone.js");

/**
 * The viewer's time zone through every reader. The deployed server runs
 * in UTC while the browser in Kigali (UTC+2) sends wall-clock picks like
 * "2026-10-14T16:46:11" with no zone, and presets like "today": with tz
 * "Africa/Kigali" a pick is read as Kigali time, "today" starts at 22:00Z
 * the day before, over-time days fall on Kigali midnights, and the
 * records table, the export, the feed and a public share link all accept
 * it. Without tz (or with an unknown one) everything reads in the
 * server's zone exactly as before.
 *
 * The record is the user's real one: alive 14:40:56Z, dead 14:42:31Z,
 * alive again 14:45:41Z, dead 15:25:12Z on 2026-10-14. A period ending
 * 16:46:11 Kigali (14:46:11Z) must read it alive; 16:43:01 Kigali reads
 * it dead.
 */

const KIGALI = "Africa/Kigali";
const FORM = "zone-tracked";
const PLAIN = "zone-plain";
const ID = "id_f";
const STATUS = "status_f";
const NAME = "name_f";
const TRACKING = { enabled: true, key_field_ids: [ID], key_field_id: ID, key_unique: true, editable_field_ids: [STATUS, NAME] };
const SCHEMA = {
  fields: [
    { id: ID, type: "text", label: { en: "Id" } },
    { id: STATUS, type: "single_select", label: { en: "Status" }, options: [{ id: "o1", value: "alive", label: { en: "Alive" } }, { id: "o2", value: "dead", label: { en: "Dead" } }] },
    { id: NAME, type: "text", label: { en: "Name" } },
  ],
};

const z = (text) => new Date(`${text}Z`);
const span = (value, from, to) => ({ value, from, to: to || null });
const USER_RECORD = {
  _id: new ObjectId("0000000000000000000000d1"),
  form_group_id: FORM,
  version: 1,
  submitted_at: z("2026-10-14T14:40:56.000"),
  updated_at: z("2026-10-14T15:25:12.000"),
  record_key: "u1",
  record_key_pairs: [{ f: ID, k: "u1" }],
  record_key_fields: ID,
  data: { [ID]: "u1", [STATUS]: "dead", [NAME]: "n" },
  tracking_periods: {
    [STATUS]: [span("alive", z("2026-10-14T14:40:56.000"), z("2026-10-14T14:42:31.000")), span("dead", z("2026-10-14T14:42:31.000"), z("2026-10-14T14:45:41.000")), span("alive", z("2026-10-14T14:45:41.000"), z("2026-10-14T15:25:12.000")), span("dead", z("2026-10-14T15:25:12.000"))],
    [NAME]: [span("n", z("2026-10-14T14:40:56.000"))],
  },
  history: [{ at: z("2026-10-14T14:40:56.000"), kind: "created", by: null, changes: [] }],
};
// The time_correct example: alive/a at 13:00Z, b from 13:20Z, dead from 13:51Z (15:00, 15:20, 15:51 in Kigali).
const T = (time) => z(`2023-12-12T${time}`);
const EXAMPLE = {
  _id: new ObjectId("0000000000000000000000d2"),
  form_group_id: FORM,
  version: 1,
  submitted_at: T("13:00:00.000"),
  updated_at: T("13:51:00.000"),
  record_key: "p1",
  record_key_pairs: [{ f: ID, k: "p1" }],
  record_key_fields: ID,
  data: { [ID]: "p1", [STATUS]: "dead", [NAME]: "b" },
  tracking_periods: { [STATUS]: [span("alive", T("13:00:00.000"), T("13:51:00.000")), span("dead", T("13:51:00.000"))], [NAME]: [span("a", T("13:00:00.000"), T("13:20:00.000")), span("b", T("13:20:00.000"))] },
  history: [{ at: T("13:00:00.000"), kind: "created", by: null, changes: [] }],
};
// An untracked record at 00:30 Kigali on the 14th, which is still the 13th in UTC.
const NIGHT_RECORD = { _id: new ObjectId("0000000000000000000000d3"), form_group_id: PLAIN, version: 1, submitted_at: z("2026-10-13T22:30:00.000"), data: { [ID]: "night", [STATUS]: "alive", [NAME]: "n" } };

const PICK = { from: "2026-10-14T16:40:00", to: "2026-10-14T16:46:11" };
const EARLY_PICK = { from: "2026-10-14T16:40:00", to: "2026-10-14T16:43:01" };
const LINK_TOKEN = "fedcba9876543210fedcba9876543210fedcba9876543210";
const FEED_TOKEN = "zonefeedtoken00000000000000000";

let server = null;
let client = null;
let db = null;
let http = null;
let base = "";
let form_version = null;
let plain_version = null;
let project = null;

async function call(method, url, body) {
  const options = { method, headers: { "x-language": "en", "x-user": "owner" } };
  if (body !== undefined) {
    options.headers["content-type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  const response = await fetch(base + url, options);
  const type = response.headers.get("content-type") || "";
  const payload = type.includes("application/json") ? await response.json() : Buffer.from(await response.arrayBuffer());
  return { status: response.status, body: payload };
}

async function run_all_tests() {
  server = await MongoMemoryServer.create();
  client = await MongoClient.connect(server.getUri());
  db = client.db("dcs_viewer_zone");
  set_db_handles(db, client.db("cok_test"));

  const owner_id = new ObjectId();
  project = { _id: new ObjectId(), name: "P", created_by: owner_id.toString(), access_control_enabled: false, created_at: new Date() };
  await db.collection("dcs_projects").insertOne(project);
  const form_doc = (form_group_id, tracking) => ({ form_group_id, version: 1, is_active: true, form_name: "People", project_id: project._id.toString(), schema: SCHEMA, tracking, created_by: owner_id.toString(), created_at: new Date(), updated_at: new Date() });
  form_version = form_doc(FORM, TRACKING);
  plain_version = form_doc(PLAIN, null);
  await db.collection("dcs_forms").insertMany([form_version, plain_version]);
  await db.collection("dcs_submissions").insertMany([USER_RECORD, EXAMPLE, NIGHT_RECORD]);
  await db.collection("dcs_submissions").createIndex({ form_group_id: 1, submitted_at: -1 });
  const dashboard = { _id: new ObjectId(), form_group_id: FORM, name: "Board", widgets: [], filters: [], created_at: new Date(), updated_at: new Date() };
  await db.collection("dcs_dashboards").insertOne(dashboard);
  await db.collection("dcs_dashboard_links").insertOne({ token: LINK_TOKEN, form_group_id: FORM, dashboard_id: dashboard._id.toString(), title: "Shared", config: {}, expires_at: null, created_at: new Date(), views: 0 });
  await db.collection("dcs_data_feed_tokens").insertOne({ token: FEED_TOKEN, form_group_id: FORM, name: "BI", scope: { version: null, from: null, to: null }, revoked_at: null, expires_at: null, created_at: new Date() });

  const user = { user_id: owner_id, email: "owner@x.rw", full_name: "Olive Owner", role: "Officer", permissions: [], department_id: null };
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = user;
    req.language = "en";
    req.navigation = { links: [{ id: "dcs" }] };
    next();
  });
  app.use("/dcs/api/public", require("../routes/public/routes.js"));
  app.use("/dcs/api/submissions", require("../routes/submissions/routes.js"));
  http = app.listen(0);
  base = `http://127.0.0.1:${http.address().port}/dcs/api`;

  try {
    test_a_wall_clock_pick_is_read_in_the_viewers_zone();
    test_presets_are_the_viewers_day_week_and_month();
    await test_the_dashboard_reads_the_users_record_in_kigali_time();
    await test_over_time_by_day_uses_the_viewers_midnight();
    await test_the_records_table_and_the_export_accept_tz();
    await test_the_feed_and_the_share_link_accept_tz();
    await test_the_full_example_in_kigali_time();
  } finally {
    await new Promise((resolve) => http.close(resolve));
    await client.close();
    await server.stop();
  }
}

const kpi_widget = (status_value, pick) => ({ id: `kpi_${status_value}`, form_group_id: FORM, title: "Card", chart_type: "kpi", metric: { aggregation: "count", field_id: null }, filters: [{ field_id: STATUS, operator: "eq", value: status_value }], period: pick ? { preset: "custom", from: pick.from, to: pick.to } : { preset: "all" } });

/** "2026-10-14T16:46:11" with tz Kigali ends at 14:46:11Z; without tz, or with an unknown tz, it is the server's 16:46Z. */
function test_a_wall_clock_pick_is_read_in_the_viewers_zone() {
  assert.strictEqual(zone_of(KIGALI), KIGALI, "a known zone is accepted");
  assert.strictEqual(zone_of("Mars/Olympus"), null, "an unknown zone is not");
  assert.strictEqual(zone_of(""), null, "nor an empty one");
  const kigali = resolve_period_bounds("custom", PICK.from, PICK.to, KIGALI);
  assert.strictEqual(kigali.start.toISOString(), "2026-10-14T14:40:00.000Z", "16:40 Kigali is 14:40Z");
  assert.strictEqual(kigali.end.toISOString(), "2026-10-14T14:46:11.999Z", "16:46:11 Kigali ends at 14:46:11.999Z");
  const plain = resolve_period_bounds("custom", PICK.from, PICK.to);
  assert.strictEqual(plain.start.toISOString(), "2026-10-14T16:40:00.000Z", "without tz the server (UTC) reads 16:40Z");
  const unknown = resolve_period_bounds("custom", PICK.from, PICK.to, "Mars/Olympus");
  assert.strictEqual(unknown.start.toISOString(), plain.start.toISOString(), "an unknown tz falls back to the server's zone");
  const absolute = resolve_period_bounds("custom", "2026-10-14T16:40:00+02:00", "2026-10-14T14:46:11Z", KIGALI);
  assert.strictEqual(absolute.start.toISOString(), "2026-10-14T14:40:00.000Z", "a pick carrying an offset stays absolute");
  assert.strictEqual(absolute.end.toISOString(), "2026-10-14T14:46:11.999Z", "and so does one ending in Z");
  const day = resolve_period_bounds("custom", "2026-10-14", "2026-10-14", KIGALI);
  assert.strictEqual(day.start.toISOString(), "2026-10-13T22:00:00.000Z", "a bare date is the viewer's whole day, from their midnight");
  assert.strictEqual(day.end.toISOString(), "2026-10-14T21:59:59.999Z", "to their last millisecond");
  assert.strictEqual(zoned_to_utc("2026-10-14T00:30", KIGALI).toISOString(), "2026-10-13T22:30:00.000Z", "00:30 Kigali is 22:30Z the day before");
}

/** "today" in Kigali starts at 22:00Z the day before; the week starts on a Kigali Monday; the month on its first day. */
function test_presets_are_the_viewers_day_week_and_month() {
  const now = new Date();
  const today = resolve_period_bounds("today", null, null, KIGALI);
  assert.ok(today.start.toISOString().endsWith("T22:00:00.000Z"), `today in Kigali starts at 22:00Z: ${today.start.toISOString()}`);
  assert.strictEqual(today.end.getTime() - today.start.getTime(), 86400000 - 1, "and lasts one day");
  assert.strictEqual(wall_clock(KIGALI, today.start).day, wall_clock(KIGALI, now).day, "it is the viewer's calendar day");
  assert.ok(today.start <= now && now <= today.end, "which holds now");
  const week = resolve_period_bounds("this_week", null, null, KIGALI);
  assert.strictEqual(wall_clock(KIGALI, week.start).weekday, 1, "the week starts on a Monday in Kigali");
  assert.strictEqual(wall_clock(KIGALI, week.start).hour, 0, "at Kigali midnight");
  assert.strictEqual(week.end.getTime() - week.start.getTime(), 7 * 86400000 - 1, "and lasts seven days");
  const month = resolve_period_bounds("this_month", null, null, KIGALI);
  assert.strictEqual(wall_clock(KIGALI, month.start).day, 1, "the month starts on its first day");
  assert.ok(month.start.toISOString().endsWith("T22:00:00.000Z"), "at Kigali midnight, 22:00Z");
  assert.strictEqual(wall_clock(KIGALI, month.end).hour, 23, "and ends at the viewer's 23:59");
  const server_today = resolve_period_bounds("today");
  assert.ok(server_today.start.toISOString().endsWith("T00:00:00.000Z"), "without tz, today is the server's UTC day");
}

/** The deployed symptom: with tz the card reads alive at 16:46:11 Kigali and dead at 16:43:01; without tz the record is not even in the window. */
async function test_the_dashboard_reads_the_users_record_in_kigali_time() {
  const { compute_dashboard_results } = require("../util-dashboard/compute_results.js");
  const values = (results) => Object.fromEntries(results.map((entry) => [entry.widget_id, entry.value]));
  const at_1646 = values(await compute_dashboard_results({ widgets: [kpi_widget("alive", PICK), kpi_widget("dead", PICK)], tz: KIGALI }, FORM, form_version, project._id));
  assert.deepStrictEqual(at_1646, { kpi_alive: 1, kpi_dead: 0 }, "a period ending 16:46:11 Kigali (14:46:11Z) reads the record alive");
  const at_1643 = values(await compute_dashboard_results({ widgets: [kpi_widget("alive", EARLY_PICK), kpi_widget("dead", EARLY_PICK)], tz: KIGALI }, FORM, form_version, project._id));
  assert.deepStrictEqual(at_1643, { kpi_alive: 0, kpi_dead: 1 }, "a period ending 16:43:01 Kigali (14:43:01Z) reads it dead");
  const server_zone = values(await compute_dashboard_results({ widgets: [kpi_widget("alive", PICK), kpi_widget("dead", PICK)] }, FORM, form_version, project._id));
  assert.deepStrictEqual(server_zone, { kpi_alive: 0, kpi_dead: 0 }, "without tz the pick is 16:46Z, after everything happened, and the record is not in the window at all");
  const override = values(await compute_dashboard_results({ widgets: [kpi_widget("alive"), kpi_widget("dead")], period: { preset: "custom", from: PICK.from, to: PICK.to }, tz: KIGALI }, FORM, form_version, project._id));
  assert.deepStrictEqual(override, { kpi_alive: 1, kpi_dead: 0 }, "the board's period override is read in the viewer's zone too");
}

/** A record at 00:30 Kigali on the 14th lands on the Kigali 14th, not the UTC 13th. */
async function test_over_time_by_day_uses_the_viewers_midnight() {
  const { compute_dashboard_results } = require("../util-dashboard/compute_results.js");
  const submissions_model = require("../models/submissions_model.js");
  const widget = { id: "ot", form_group_id: PLAIN, title: "Over time", chart_type: "bar", metric: { aggregation: "count", field_id: null }, group_by: { field_id: STATUS }, over_time: { enabled: true, field_id: "submitted_at", granularity: "day" }, filters: [], period: { preset: "custom", from: "2026-10-13", to: "2026-10-14" } };
  const [kigali] = await compute_dashboard_results({ widgets: [widget], tz: KIGALI }, PLAIN, plain_version, project._id);
  assert.ok(Array.isArray(kigali.rows), `the over-time widget computes: ${JSON.stringify(kigali)}`);
  assert.deepStrictEqual(kigali.rows.map((row) => `${row.label}=${row.value}`), ["Oct 13=0", "Oct 14=1"], "in Kigali the record belongs to the 14th");
  const [utc] = await compute_dashboard_results({ widgets: [widget] }, PLAIN, plain_version, project._id);
  assert.deepStrictEqual(utc.rows.map((row) => `${row.label}=${row.value}`), ["Oct 13=1", "Oct 14=0"], "on the UTC server it belongs to the 13th");
  const bounds = resolve_period_bounds("custom", "2026-10-13", "2026-10-14", KIGALI);
  const chart = await submissions_model.count_submissions_over_time(PLAIN, bounds.start, bounds.end, "day", KIGALI, "monday", null);
  assert.deepStrictEqual(chart.buckets.map((bucket) => `${bucket.at.toISOString()}=${bucket.count}`), ["2026-10-13T22:00:00.000Z=1"], "the stats chart buckets on the Kigali day too");
}

/** GET /submissions/:fg?tz= and the Excel export read the pick in the viewer's zone. */
async function test_the_records_table_and_the_export_accept_tz() {
  const query = `period=custom&from=${PICK.from}&to=${PICK.to}`;
  // The table answers its rows as data (an array) or under data.items.
  const rows_of = (response) => (Array.isArray(response.body.data) ? response.body.data : (response.body.data && response.body.data.items) || []);
  const kigali = await call("GET", `/submissions/${FORM}?${query}&tz=${KIGALI}`);
  assert.strictEqual(kigali.status, 200, `the table answers: ${JSON.stringify(kigali.body)}`);
  const items = rows_of(kigali);
  assert.strictEqual(items.length, 1, `the record is in the Kigali window: ${JSON.stringify(kigali.body.data).slice(0, 300)}`);
  assert.strictEqual(items[0].data[STATUS], "alive", "read alive as of 14:46:11Z");
  assert.strictEqual(new Date(items[0].as_of).toISOString(), "2026-10-14T14:46:11.999Z", "and the row says as of 14:46:11.999Z");
  const utc = await call("GET", `/submissions/${FORM}?${query}`);
  assert.strictEqual(rows_of(utc).length, 0, "without tz the window is 16:46Z and holds nothing");
  const exported = await call("GET", `/submissions/export/${FORM}?${query}&tz=${KIGALI}&language=en`);
  assert.strictEqual(exported.status, 200, "the export answers");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(exported.body);
  const sheet = workbook.getWorksheet("Data") || workbook.worksheets[0];
  const header = sheet.getRow(1).values.slice(1).map((cell) => String(cell && cell.text !== undefined ? cell.text : cell));
  const status_at = header.findIndex((label) => /status/i.test(label));
  assert.ok(status_at >= 0, `the export has a Status column: ${JSON.stringify(header)}`);
  const first = sheet.getRow(2).values.slice(1);
  assert.strictEqual(String(first[status_at] && first[status_at].text !== undefined ? first[status_at].text : first[status_at]).toLowerCase(), "alive", "the exported line reads alive as of 14:46:11Z");
}

/** The Power BI feed (?tz=) and a public share link (body.tz) read the same. */
async function test_the_feed_and_the_share_link_accept_tz() {
  const feed = await call("GET", `/public/data-feed/${FEED_TOKEN}?from=${PICK.from}&to=${PICK.to}&tz=${KIGALI}&keys=id`);
  assert.strictEqual(feed.status, 200, `the feed answers: ${JSON.stringify(feed.body).slice(0, 200)}`);
  assert.strictEqual(feed.body.count, 1, "one record in the Kigali window");
  assert.strictEqual(feed.body.results[0][STATUS], "alive", "read alive as of 14:46:11Z");
  const feed_utc = await call("GET", `/public/data-feed/${FEED_TOKEN}?from=${PICK.from}&to=${PICK.to}&keys=id`);
  assert.strictEqual(feed_utc.body.count, 0, "without tz the feed's window is 16:46Z and holds nothing");
  const shared = await call("POST", `/public/dashboard/${LINK_TOKEN}/data`, { widgets: [kpi_widget("alive", PICK), kpi_widget("dead", PICK)], tz: KIGALI });
  assert.strictEqual(shared.status, 200, `the share link answers: ${JSON.stringify(shared.body).slice(0, 200)}`);
  const values = Object.fromEntries(shared.body.data.results.map((entry) => [entry.widget_id, entry.value]));
  assert.deepStrictEqual(values, { kpi_alive: 1, kpi_dead: 0 }, "the shared board reads alive at 16:46:11 Kigali");
}

/** The time_correct example, picked in Kigali time: 15:30 Kigali is 13:30Z and reads alive/b; 15:10 reads a; 16:00 reads dead. */
async function test_the_full_example_in_kigali_time() {
  const submissions_model = require("../models/submissions_model.js");
  const read = async (to) => {
    const bounds = resolve_period_bounds("custom", "2023-12-12T15:00:00", to, KIGALI);
    const result = await submissions_model.list_submissions(FORM, undefined, 1, 50, bounds, { tracking: TRACKING });
    const row = result.items.find((item) => item.data[ID] === "p1");
    return row ? `${row.data[STATUS]}/${row.data[NAME]}` : "absent";
  };
  assert.strictEqual(await read("2023-12-12T15:30:00"), "alive/b", "at 15:30 Kigali (13:30Z) p1 was alive and named b");
  assert.strictEqual(await read("2023-12-12T15:10:00"), "alive/a", "at 15:10 Kigali it was still named a");
  assert.strictEqual(await read("2023-12-12T16:00:00"), "dead/b", "at 16:00 Kigali (14:00Z) it was dead");
  const bounds = resolve_period_bounds("custom", "2023-12-12T17:00:00", "2023-12-12T18:00:00", KIGALI);
  assert.strictEqual((await submissions_model.list_submissions(FORM, undefined, 1, 50, bounds, { tracking: TRACKING })).total, 0, "17:00-18:00 Kigali (15:00-16:00Z) holds nothing");
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
