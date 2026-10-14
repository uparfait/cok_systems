const assert = require("assert");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { MongoClient, ObjectId } = require("mongodb");

/**
 * How the tables and the dashboards read a tracked form, checked against
 * a real MongoDB on one scenario borrowed from the smart-parking case.
 *
 * A car is recorded on arrival with status "in", and the SAME record is
 * labelled "out" when it leaves. The table and every dashboard read the
 * CURRENT state: one row per car carrying the status it holds now, dated
 * by the moment it LAST MOVED (its last update, or its arrival when it
 * was never updated). A range keeps the cars that last moved inside it,
 * an over-time chart puts each car in the column of its last move, and a
 * KPI window counts the cars that last moved inside it with the value
 * they hold now - so the table, the charts and the cards all agree.
 *
 * The export and the data feed are the deliberate exception: one line
 * per car that was created OR changed at any moment in the range,
 * carrying the value it held at the end of the range.
 *
 * Every number below is asserted, not printed, and the scenario is built
 * from fixed instants so nothing drifts with the day it runs.
 */

const FORM = "parking-form";
const PLATE = "plate";
const STATUS = "status";
const BAY = "bay";
const TRACKING = { enabled: true, key_field_ids: [PLATE], key_field_id: PLATE, key_unique: false, editable_field_ids: [STATUS, BAY] };

// 2026-09-25, in UTC. The window helpers are timezone-agnostic: every
// bound below is built explicitly, never from a preset.
const T09 = new Date("2026-09-25T09:00:00Z");
const T12 = new Date("2026-09-25T12:00:00Z");
const T13 = new Date("2026-09-25T13:00:00Z");
const YESTERDAY = new Date("2026-09-24T08:00:00Z");

const DAY = { start: new Date("2026-09-25T00:00:00Z"), end: new Date("2026-09-25T23:59:59.999Z") };
const DAY_BEFORE = { start: new Date("2026-09-24T00:00:00Z"), end: new Date("2026-09-24T23:59:59.999Z") };
const HOUR_12 = { start: T12, end: new Date("2026-09-25T12:59:59.999Z") };
const HOUR_13 = { start: T13, end: new Date("2026-09-25T13:59:59.999Z") };

function periods(spec) {
  const out = {};
  Object.keys(spec).forEach((field_id) => {
    out[field_id] = spec[field_id].map(([value, from, to]) => ({ value, from, to: to || null }));
  });
  return out;
}

const oid = (hex) => new ObjectId(hex);

const CARS = [
  // RAB 001 - arrived 12:00, left 13:00. Last moved at 13:00, now out.
  {
    _id: oid("000000000000000000000001"),
    form_group_id: FORM,
    version: 1,
    submitted_at: T12,
    updated_at: T13,
    record_key: "rab 001",
    data: { [PLATE]: "RAB 001", [STATUS]: "out", [BAY]: "B2" },
    tracking_periods: periods({ [STATUS]: [["in", T12, T13], ["out", T13, null]], [BAY]: [["B2", T12, null]] }),
    history: [{ at: T12, kind: "created" }, { at: T13, kind: "updated" }],
  },
  // RAB 002 - arrived 09:00, still parked. Never updated: dated by arrival.
  {
    _id: oid("000000000000000000000002"),
    form_group_id: FORM,
    version: 1,
    submitted_at: T09,
    record_key: "rab 002",
    data: { [PLATE]: "RAB 002", [STATUS]: "in", [BAY]: "A1" },
    tracking_periods: periods({ [STATUS]: [["in", T09, null]], [BAY]: [["A1", T09, null]] }),
    history: [{ at: T09, kind: "created" }],
  },
  // RAB 003 - arrived YESTERDAY, left at 13:00 today. It belongs to today,
  // not to yesterday: this is the record a plain submitted_at range loses.
  {
    _id: oid("000000000000000000000003"),
    form_group_id: FORM,
    version: 1,
    submitted_at: YESTERDAY,
    updated_at: T13,
    record_key: "rab 003",
    data: { [PLATE]: "RAB 003", [STATUS]: "out", [BAY]: "C3" },
    tracking_periods: periods({ [STATUS]: [["in", YESTERDAY, T13], ["out", T13, null]], [BAY]: [["C3", YESTERDAY, null]] }),
    history: [{ at: YESTERDAY, kind: "created" }, { at: T13, kind: "updated" }],
  },
  // RAB 004 - two fields moved at the SAME instant: still one car, one row.
  {
    _id: oid("000000000000000000000004"),
    form_group_id: FORM,
    version: 1,
    submitted_at: T09,
    updated_at: T13,
    record_key: "rab 004",
    data: { [PLATE]: "RAB 004", [STATUS]: "out", [BAY]: "D9" },
    tracking_periods: periods({ [STATUS]: [["in", T09, T13], ["out", T13, null]], [BAY]: [["D1", T09, T13], ["D9", T13, null]] }),
    history: [{ at: T09, kind: "created" }, { at: T13, kind: "updated" }],
  },
  // RAB 005 - arrived yesterday, left at 12:00 and came BACK at 13:00.
  // Moved twice today; only its last move dates it, and it is "in" now.
  {
    _id: oid("000000000000000000000005"),
    form_group_id: FORM,
    version: 1,
    submitted_at: YESTERDAY,
    updated_at: T13,
    record_key: "rab 005",
    data: { [PLATE]: "RAB 005", [STATUS]: "in", [BAY]: "E5" },
    tracking_periods: periods({ [STATUS]: [["in", YESTERDAY, T12], ["out", T12, T13], ["in", T13, null]], [BAY]: [["E5", YESTERDAY, null]] }),
    history: [{ at: YESTERDAY, kind: "created" }, { at: T12, kind: "updated" }, { at: T13, kind: "updated" }],
  },
];

let client = null;
let server = null;
let collection = null;

async function run_all_tests() {
  server = await MongoMemoryServer.create();
  client = await MongoClient.connect(server.getUri());
  collection = client.db("dcs_stage_test").collection("dcs_submissions");
  await collection.insertMany(CARS);
  await collection.createIndex({ form_group_id: 1, submitted_at: -1 }, { name: "form_group_submitted_at" });

  try {
    await test_one_row_per_car_with_its_current_value();
    await test_a_car_is_dated_by_its_last_move();
    await test_a_car_that_arrived_earlier_still_counts_today();
    await test_two_kpi_cards_over_the_same_hours();
    await test_over_time_puts_each_car_in_the_column_of_its_last_move();
    await test_a_status_filter_reads_the_current_value();
    await test_export_and_feed_send_one_line_per_car();
    await test_export_carries_the_value_held_at_the_range_end();
    await test_feed_since_redelivers_a_corrected_car();
    await test_untracked_form_is_unchanged();
  } finally {
    await client.close();
    await server.stop();
  }
}

const { window_filter, last_moved_expr, date_window_filter } = require("../utilities/tracking_window.js");

/** The rows one range lists, exactly as the table reads them: find() on the window, newest arrival first. */
async function rows_in(bounds, tracking) {
  const rows = await collection
    .find(Object.assign({ form_group_id: FORM }, window_filter(bounds, tracking)))
    .sort({ submitted_at: -1, _id: -1 })
    .toArray();
  return rows.map((row) => `${row.data[PLATE]}=${row.data[STATUS]}`);
}

/** How many cars carry each value of one field, inside a range - what a KPI card counts. */
async function counts_by(field_id, bounds, tracking) {
  const rows = await collection
    .aggregate([
      { $match: Object.assign({ form_group_id: FORM }, window_filter(bounds, tracking)) },
      { $group: { _id: `$data.${field_id}`, n: { $sum: 1 } } },
    ])
    .toArray();
  const out = {};
  rows.forEach((row) => {
    out[row._id] = row.n;
  });
  return out;
}

/** The day lists every car once, with the status it holds now. */
async function test_one_row_per_car_with_its_current_value() {
  const rows = await rows_in(DAY, TRACKING);
  assert.deepStrictEqual(
    rows,
    ["RAB 001=out", "RAB 004=out", "RAB 002=in", "RAB 005=in", "RAB 003=out"],
    "one row per car, newest arrival first, each carrying its current status",
  );
  const plates = rows.map((row) => row.split("=")[0]);
  assert.strictEqual(new Set(plates).size, plates.length, "no car is listed twice, however often it moved");
  assert.strictEqual(rows.includes("RAB 001=out"), true, "a car that arrived and left is one row, saying out");
  assert.strictEqual(rows.includes("RAB 005=in"), true, "a car that left and came back is one row, saying in");
}

/** A car belongs to the hour of its LAST move only. */
async function test_a_car_is_dated_by_its_last_move() {
  assert.deepStrictEqual(await rows_in(HOUR_12, TRACKING), [], "nothing last moved in the 12:00 hour: RAB 001 and RAB 005 both moved again at 13:00");
  assert.deepStrictEqual(
    (await rows_in(HOUR_13, TRACKING)).sort(),
    ["RAB 001=out", "RAB 003=out", "RAB 004=out", "RAB 005=in"],
    "the 13:00 hour holds every car whose last move was then",
  );
  const rab005 = (await rows_in(DAY, TRACKING)).filter((row) => row.startsWith("RAB 005"));
  assert.strictEqual(rab005.length, 1, "a car that moved twice in the day is still one row");
}

/** The record a plain submitted_at range loses: in yesterday, out today. */
async function test_a_car_that_arrived_earlier_still_counts_today() {
  const today = await rows_in(DAY, TRACKING);
  assert.strictEqual(today.includes("RAB 003=out"), true, "a car recorded yesterday and driven out today belongs to today");
  assert.deepStrictEqual(await rows_in(DAY_BEFORE, TRACKING), [], "it no longer belongs to yesterday: its last move was today");
}

/** The two cards the scenario is about, both over the same hours. */
async function test_two_kpi_cards_over_the_same_hours() {
  const day = await counts_by(STATUS, DAY, TRACKING);
  assert.strictEqual(day.in, 2, "two cars are in right now among those that moved today (RAB 002, RAB 005)");
  assert.strictEqual(day.out, 3, "three cars are out right now among those that moved today");

  const hour_12 = await counts_by(STATUS, HOUR_12, TRACKING);
  assert.deepStrictEqual(hour_12, {}, "no car's last move was in the 12:00 hour");

  const hour_13 = await counts_by(STATUS, HOUR_13, TRACKING);
  assert.strictEqual(hour_13.out, 3, "three of the cars that last moved at 13:00 are out");
  assert.strictEqual(hour_13.in, 1, "one of them (RAB 005, back at 13:00) is in");
}

/** The over-time chart buckets on the last move, so each car lands in one column. */
async function test_over_time_puts_each_car_in_the_column_of_its_last_move() {
  const rows = await collection
    .aggregate([
      { $match: Object.assign({ form_group_id: FORM }, window_filter(DAY, TRACKING)) },
      { $group: { _id: { hour: { $dateTrunc: { date: last_moved_expr(TRACKING), unit: "hour" } }, status: `$data.${STATUS}` }, n: { $sum: 1 } } },
      { $sort: { "_id.hour": 1, "_id.status": 1 } },
    ])
    .toArray();
  const shaped = rows.map((row) => `${row._id.hour.toISOString().slice(11, 16)} ${row._id.status}=${row.n}`);
  assert.deepStrictEqual(shaped, ["09:00 in=1", "13:00 in=1", "13:00 out=3"], "each car lands in the hour of its last move, with its current status");

  const total = rows.reduce((sum, row) => sum + row.n, 0);
  const table_rows = await rows_in(DAY, TRACKING);
  assert.strictEqual(total, table_rows.length, "the chart's columns add up to exactly what the table lists");
}

/** A value filter judges what the record says today. */
async function test_a_status_filter_reads_the_current_value() {
  const rows = await collection
    .find(Object.assign({ form_group_id: FORM, [`data.${STATUS}`]: { $in: ["in"] } }, window_filter(DAY, TRACKING)))
    .sort({ submitted_at: -1, _id: -1 })
    .toArray();
  assert.deepStrictEqual(
    rows.map((row) => row.data[PLATE]),
    ["RAB 002", "RAB 005"],
    'filtering on "in" keeps the cars that are in right now - not those that were in at some point',
  );
}

/** The export and the feed collapse: one line per car, never a history. */
async function test_export_and_feed_send_one_line_per_car() {
  const records = await collection.find(Object.assign({ form_group_id: FORM }, date_window_filter(DAY, TRACKING))).toArray();
  assert.strictEqual(records.length, 5, "five cars moved during the day, so the file has five lines");
  const ids = records.map((record) => record._id.toString()).sort();
  assert.strictEqual(new Set(ids).size, 5, "no car appears twice in the file");

  // And it is the same set of cars the table lists for the day.
  const table_plates = new Set((await rows_in(DAY, TRACKING)).map((row) => row.split("=")[0]));
  const file_plates = new Set(records.map((record) => record.data[PLATE]));
  assert.deepStrictEqual([...file_plates].sort(), [...table_plates].sort(), "the file holds exactly the cars the table showed");
}

/** A collapsed line still reads as of the range end, not as of today. */
async function test_export_carries_the_value_held_at_the_range_end() {
  const { tracking_stages } = require("../util-dashboard/tracking_stage.js");
  const as_of_noon = await collection
    .aggregate([
      { $match: Object.assign({ form_group_id: FORM }, date_window_filter(HOUR_12, TRACKING)) },
      ...tracking_stages({ tracking: TRACKING }, HOUR_12),
      { $sort: { _id: 1 } },
      { $project: { _id: 0, plate: `$data.${PLATE}`, status: `$data.${STATUS}` } },
    ])
    .toArray();
  assert.deepStrictEqual(
    as_of_noon,
    [{ plate: "RAB 001", status: "in" }, { plate: "RAB 005", status: "out" }],
    "an export of the 12:00 hour says RAB 001 was IN and RAB 005 was OUT, whatever they say now",
  );
}

/** ?since has to re-deliver a car whose label was corrected afterwards. */
async function test_feed_since_redelivers_a_corrected_car() {
  // A BI tool that last pulled at 12:30 asks for everything since then.
  const since = { start: new Date("2026-09-25T12:30:00Z"), end: null };
  const records = await collection.find(Object.assign({ form_group_id: FORM }, date_window_filter(since, TRACKING))).toArray();
  const plates = records.map((record) => record.data[PLATE]).sort();
  assert.deepStrictEqual(
    plates,
    ["RAB 001", "RAB 003", "RAB 004", "RAB 005"],
    "the four cars that moved at 13:00 are re-delivered, so the dataset finally shows where they stand",
  );
  assert.strictEqual(plates.includes("RAB 002"), false, "the car that has not moved since 09:00 is not re-sent");
}

/** An untracked form must read exactly as it always did: by arrival. */
async function test_untracked_form_is_unchanged() {
  assert.deepStrictEqual(
    window_filter(DAY, null),
    { submitted_at: { $gte: DAY.start, $lte: DAY.end } },
    "an untracked range is still a plain both-bounds filter on submitted_at",
  );
  assert.strictEqual(last_moved_expr(null), "$submitted_at", "an untracked form is dated by its arrival");
  // A tracked form that declares no updatable field can never move after
  // arrival, so it reads the same plain way.
  const no_fields = { enabled: true, key_field_ids: [PLATE], key_field_id: PLATE, editable_field_ids: [] };
  assert.deepStrictEqual(
    window_filter(DAY, no_fields),
    { submitted_at: { $gte: DAY.start, $lte: DAY.end } },
    "and its range stays a plain both-bounds filter",
  );
  assert.strictEqual(last_moved_expr(no_fields), "$submitted_at", "and it is dated by its arrival too");
  assert.deepStrictEqual(window_filter(null, TRACKING), {}, "no bounds means no condition at all");

  const arrivals = await collection.find(Object.assign({ form_group_id: FORM }, window_filter(DAY, null))).toArray();
  assert.deepStrictEqual(
    arrivals.map((record) => record.data[PLATE]).sort(),
    ["RAB 001", "RAB 002", "RAB 004"],
    "read as an untracked form, the day holds only what arrived in it - RAB 003 and RAB 005 arrived yesterday",
  );
}

run_all_tests().then(
  () => {
    process.stdout.write("ALL_TESTS_PASSED\n");
  },
  (error) => {
    process.stdout.write(`${error && error.stack ? error.stack : error}\n`);
    process.exit(1);
  },
);
