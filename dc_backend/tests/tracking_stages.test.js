const assert = require("assert");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { MongoClient, ObjectId } = require("mongodb");

/**
 * How every reader sees a tracked form inside a date range, checked
 * against a real MongoDB on one scenario borrowed from the smart-parking
 * case: a car is recorded on arrival with status "in", and the SAME
 * record is labelled "out" when it leaves.
 *
 * A range shows the register AS IT WAS at the range's end: it keeps the
 * cars created or changed at any moment inside the range, one row each,
 * every updatable field holding the value it had at the end - so the
 * 12:00 hour says a car that left at 13:00 was still in. The over-time
 * charts alone read the state DURING each column: one row per movement,
 * carrying the value at that moment. The export and the data feed read
 * exactly as the table does.
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
  // RAB 001 - arrived 12:00, left 13:00.
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
  // RAB 002 - arrived 09:00, still parked.
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
  // RAB 003 - arrived YESTERDAY, left at 13:00 today.
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
  // RAB 004 - two fields moved at the SAME instant: one movement.
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
    await test_a_range_lists_each_car_once_as_it_was_at_the_end();
    await test_an_hour_reads_the_cars_as_they_stood_at_its_end();
    await test_yesterday_reads_the_cars_as_they_stood_yesterday();
    await test_two_kpi_cards_over_the_same_hours();
    await test_over_time_puts_each_movement_in_its_own_column();
    await test_a_status_filter_judges_the_value_at_the_end();
    await test_export_and_feed_send_one_line_per_car();
    await test_export_carries_the_value_held_at_the_range_end();
    await test_feed_since_redelivers_a_corrected_car();
    await test_a_range_ending_in_the_future_reads_today();
    await test_untracked_form_is_unchanged();
  } finally {
    await client.close();
    await server.stop();
  }
}

const { STAGE_AT, date_window_filter, as_of_stages, stage_prefilter, stage_rows_stages, time_expr } = require("../utilities/tracking_window.js");

/** The rows one range lists, exactly as the table reads them: membership, as-of rewrite, newest arrival first. */
async function rows_in(bounds, tracking) {
  const rows = await collection
    .aggregate([
      { $match: Object.assign({ form_group_id: FORM }, date_window_filter(bounds, tracking)) },
      ...as_of_stages(tracking, bounds),
      { $sort: { submitted_at: -1, _id: -1 } },
    ])
    .toArray();
  return rows.map((row) => `${row.data[PLATE]}=${row.data[STATUS]}`);
}

/** How many cars carry each value of one field as of a range's end - what a KPI card counts. */
async function counts_by(field_id, bounds, tracking) {
  const rows = await collection
    .aggregate([
      { $match: Object.assign({ form_group_id: FORM }, date_window_filter(bounds, tracking)) },
      ...as_of_stages(tracking, bounds),
      { $group: { _id: `$data.${field_id}`, n: { $sum: 1 } } },
    ])
    .toArray();
  const out = {};
  rows.forEach((row) => {
    out[row._id] = row.n;
  });
  return out;
}

/** The stage rows an over-time chart reads for a range: "plate@HH:MM=status", by moment. */
async function stages_in(bounds, tracking) {
  const rows = await collection
    .aggregate([
      { $match: Object.assign({ form_group_id: FORM }, stage_prefilter(bounds, tracking)) },
      ...stage_rows_stages(tracking, bounds),
      { $sort: { [STAGE_AT]: 1, _id: 1 } },
    ])
    .toArray();
  return rows.map((row) => `${row.data[PLATE]}@${row[STAGE_AT].toISOString().slice(11, 16)}=${row.data[STATUS]}`);
}

/** The day lists every car once, with the status it held at the day's end. */
async function test_a_range_lists_each_car_once_as_it_was_at_the_end() {
  const rows = await rows_in(DAY, TRACKING);
  assert.deepStrictEqual(
    rows,
    ["RAB 001=out", "RAB 004=out", "RAB 002=in", "RAB 005=in", "RAB 003=out"],
    "one row per car that was created or moved during the day, newest arrival first, as it stood at midnight",
  );
  const plates = rows.map((row) => row.split("=")[0]);
  assert.strictEqual(new Set(plates).size, plates.length, "no car is listed twice, however often it moved");
}

/** The 12:00 hour says RAB 001 was still in, even though it has since left. */
async function test_an_hour_reads_the_cars_as_they_stood_at_its_end() {
  assert.deepStrictEqual(await rows_in(HOUR_12, TRACKING), ["RAB 001=in", "RAB 005=out"], "the 12:00 hour: RAB 001 arrived (in), RAB 005 left (out) - as of 12:59");
  assert.deepStrictEqual(
    await rows_in(HOUR_13, TRACKING),
    ["RAB 001=out", "RAB 004=out", "RAB 005=in", "RAB 003=out"],
    "the 13:00 hour holds every car that moved then, as of 13:59",
  );
}

/** Yesterday holds the two cars recorded then, both still in at yesterday's end. */
async function test_yesterday_reads_the_cars_as_they_stood_yesterday() {
  assert.deepStrictEqual(await rows_in(DAY_BEFORE, TRACKING), ["RAB 005=in", "RAB 003=in"], "both were in yesterday, whatever they say today");
}

/** The two cards the scenario is about, both over the same hours. */
async function test_two_kpi_cards_over_the_same_hours() {
  const day = await counts_by(STATUS, DAY, TRACKING);
  assert.strictEqual(day.in, 2, "at the day's end two of the cars that moved today are in (RAB 002, RAB 005)");
  assert.strictEqual(day.out, 3, "and three are out");

  const hour_12 = await counts_by(STATUS, HOUR_12, TRACKING);
  assert.strictEqual(hour_12.in, 1, "at 12:59 RAB 001 was in");
  assert.strictEqual(hour_12.out, 1, "and RAB 005 was out");

  const hour_13 = await counts_by(STATUS, HOUR_13, TRACKING);
  assert.strictEqual(hour_13.out, 3, "at 13:59 three of the cars that moved at 13:00 were out");
  assert.strictEqual(hour_13.in, 1, "and RAB 005 was back in");
}

/** The over-time chart reads one row per movement, with the value of that moment. */
async function test_over_time_puts_each_movement_in_its_own_column() {
  assert.deepStrictEqual(
    await stages_in(DAY, TRACKING),
    ["RAB 002@09:00=in", "RAB 004@09:00=in", "RAB 001@12:00=in", "RAB 005@12:00=out", "RAB 001@13:00=out", "RAB 003@13:00=out", "RAB 004@13:00=out", "RAB 005@13:00=in"],
    "every movement of the day, with the status it set",
  );
  const rows = await collection
    .aggregate([
      { $match: Object.assign({ form_group_id: FORM }, stage_prefilter(DAY, TRACKING)) },
      ...stage_rows_stages(TRACKING, DAY),
      { $group: { _id: { hour: { $dateTrunc: { date: time_expr(TRACKING), unit: "hour" } }, status: `$data.${STATUS}` }, n: { $sum: 1 } } },
      { $sort: { "_id.hour": 1, "_id.status": 1 } },
    ])
    .toArray();
  const shaped = rows.map((row) => `${row._id.hour.toISOString().slice(11, 16)} ${row._id.status}=${row.n}`);
  assert.deepStrictEqual(shaped, ["09:00 in=2", "12:00 in=1", "12:00 out=1", "13:00 in=1", "13:00 out=3"], "each movement lands in the hour it happened");
  assert.strictEqual(rows.reduce((sum, row) => sum + row.n, 0), 8, "eight movements during the day, over five cars");
}

/** A value filter judges the value at the range's end. */
async function test_a_status_filter_judges_the_value_at_the_end() {
  const kept = async (bounds, value) =>
    (
      await collection
        .aggregate([
          { $match: Object.assign({ form_group_id: FORM }, date_window_filter(bounds, TRACKING)) },
          ...as_of_stages(TRACKING, bounds),
          { $match: { [`data.${STATUS}`]: { $in: [value] } } },
          { $sort: { submitted_at: -1, _id: -1 } },
        ])
        .toArray()
    ).map((row) => row.data[PLATE]);
  assert.deepStrictEqual(await kept(DAY, "in"), ["RAB 002", "RAB 005"], 'at the day\'s end, filtering on "in" keeps the cars that were in then');
  assert.deepStrictEqual(await kept(HOUR_12, "in"), ["RAB 001"], 'in the 12:00 hour, "in" keeps RAB 001 - it was still in at 12:59');
}

/** The export and the feed collapse: one line per car, never a history. */
async function test_export_and_feed_send_one_line_per_car() {
  const records = await collection.find(Object.assign({ form_group_id: FORM }, date_window_filter(DAY, TRACKING))).toArray();
  assert.strictEqual(records.length, 5, "five cars moved during the day, so the file has five lines");
  assert.strictEqual(new Set(records.map((record) => record._id.toString())).size, 5, "no car appears twice in the file");
  const table_plates = new Set((await rows_in(DAY, TRACKING)).map((row) => row.split("=")[0]));
  const file_plates = new Set(records.map((record) => record.data[PLATE]));
  assert.deepStrictEqual([...file_plates].sort(), [...table_plates].sort(), "the file holds exactly the cars the table showed");
}

/** A collapsed line still reads as of the range end, not as of today - the very same rewrite the table uses. */
async function test_export_carries_the_value_held_at_the_range_end() {
  const as_of_noon = await collection
    .aggregate([
      { $match: Object.assign({ form_group_id: FORM }, date_window_filter(HOUR_12, TRACKING)) },
      ...as_of_stages(TRACKING, HOUR_12),
      { $sort: { _id: 1 } },
      { $project: { _id: 0, plate: `$data.${PLATE}`, status: `$data.${STATUS}` } },
    ])
    .toArray();
  assert.deepStrictEqual(as_of_noon, [{ plate: "RAB 001", status: "in" }, { plate: "RAB 005", status: "out" }], "an export of the 12:00 hour says RAB 001 was IN and RAB 005 OUT");
}

/** ?since has to re-deliver a car whose label was corrected afterwards. */
async function test_feed_since_redelivers_a_corrected_car() {
  const since = { start: new Date("2026-09-25T12:30:00Z"), end: null };
  const records = await collection.find(Object.assign({ form_group_id: FORM }, date_window_filter(since, TRACKING))).toArray();
  const plates = records.map((record) => record.data[PLATE]).sort();
  assert.deepStrictEqual(plates, ["RAB 001", "RAB 003", "RAB 004", "RAB 005"], "the four cars that moved at 13:00 are re-delivered");
  assert.strictEqual(plates.includes("RAB 002"), false, "the car that has not moved since 09:00 is not re-sent");
  assert.deepStrictEqual(as_of_stages(TRACKING, since), [], "a window with no end rewrites nothing: today's values are the values");
}

/** A range ending now or later has nothing to rewrite: the register as it stands. */
async function test_a_range_ending_in_the_future_reads_today() {
  const open_ended = { start: DAY.start, end: new Date(Date.now() + 3600 * 1000) };
  assert.deepStrictEqual(as_of_stages(TRACKING, open_ended), [], "no rewrite for an end in the future");
  assert.deepStrictEqual(await rows_in(open_ended, TRACKING), ["RAB 001=out", "RAB 004=out", "RAB 002=in", "RAB 005=in", "RAB 003=out"], "every car as it stands today");
}

/** An untracked form must read exactly as it always did: by arrival, as stored. */
async function test_untracked_form_is_unchanged() {
  assert.deepStrictEqual(date_window_filter(DAY, null), { submitted_at: { $gte: DAY.start, $lte: DAY.end } }, "an untracked range is a plain both-bounds filter on submitted_at");
  assert.deepStrictEqual(as_of_stages(null, DAY), [], "nothing to rewrite");
  assert.deepStrictEqual(stage_rows_stages(null, DAY), [], "nothing to expand");
  assert.deepStrictEqual(stage_prefilter(DAY, null), { submitted_at: { $gte: DAY.start, $lte: DAY.end } }, "and the over-time opening keeps both bounds");
  // A tracked form that declares no updatable field can never move after
  // arrival, so it reads the same plain way.
  const no_fields = { enabled: true, key_field_ids: [PLATE], key_field_id: PLATE, editable_field_ids: [] };
  assert.deepStrictEqual(date_window_filter(DAY, no_fields), { submitted_at: { $gte: DAY.start, $lte: DAY.end } }, "its range stays a plain both-bounds filter");
  assert.deepStrictEqual(as_of_stages(no_fields, DAY), [], "and nothing is rewritten");
  assert.deepStrictEqual(date_window_filter(null, TRACKING), {}, "no bounds means no condition at all");

  const arrivals = await collection.find(Object.assign({ form_group_id: FORM }, date_window_filter(DAY, null))).toArray();
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
