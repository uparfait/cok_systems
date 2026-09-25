const assert = require("assert");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { MongoClient, ObjectId } = require("mongodb");

/**
 * The stage reading of a tracked form, checked against a real MongoDB on
 * one scenario borrowed from the smart-parking case it exists for.
 *
 * A car is recorded on arrival with status "in", and the SAME record is
 * labelled "out" when it leaves. That is one record and two stages, and
 * every surface has to see both: the table lists each stage, an "over
 * time" chart puts the arrival in one column and the departure in another,
 * and two KPI cards - cars in, cars out - both read correctly over the very
 * same hours.
 *
 * The export and the data feed are the deliberate exception: one line per
 * CAR, carrying the value it held at the end of the range, because a
 * spreadsheet repeating the same plate reads as duplicated data.
 *
 * Every number below is asserted, not printed, and the scenario is built
 * from fixed instants so nothing drifts with the day it runs.
 */

const FORM = "parking-form";
const PLATE = "plate";
const STATUS = "status";
const BAY = "bay";
const TRACKING = { enabled: true, key_field_id: PLATE, key_unique: false, editable_field_ids: [STATUS, BAY] };

// 2026-09-25, in UTC. The window helpers are timezone-agnostic: every
// bound below is built explicitly, never from a preset.
const T09 = new Date("2026-09-25T09:00:00Z");
const T12 = new Date("2026-09-25T12:00:00Z");
const T13 = new Date("2026-09-25T13:00:00Z");
const YESTERDAY = new Date("2026-09-24T08:00:00Z");

const DAY = { start: new Date("2026-09-25T00:00:00Z"), end: new Date("2026-09-25T23:59:59.999Z") };
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
  // RAB 001 - arrived 12:00, left 13:00. Two stages, both inside the day.
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
  // RAB 002 - arrived 09:00, still parked. One stage.
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
  // RAB 003 - arrived YESTERDAY, left at 13:00 today. Only the departure
  // belongs to today, but it must not be missed: this is the record the
  // old reading lost the moment a lower bound was applied to submitted_at.
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
  // RAB 004 - two fields moved at the SAME instant. That is one stage, not
  // two: the car left once, it did not leave twice because its bay also
  // changed.
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
    await test_stage_expansion_sees_both_movements();
    await test_one_instant_is_one_stage();
    await test_a_car_that_arrived_earlier_still_leaves_today();
    await test_two_kpi_cards_over_the_same_hours();
    await test_over_time_puts_each_movement_in_its_own_column();
    await test_a_status_filter_keeps_the_matching_stage();
    await test_export_and_feed_send_one_line_per_car();
    await test_export_carries_the_value_held_at_the_range_end();
    await test_feed_since_redelivers_a_corrected_car();
    await test_untracked_form_is_unchanged();
  } finally {
    await client.close();
    await server.stop();
  }
}

const { STAGE_AT, time_expr, stage_prefilter, stage_rows_stages, date_window_filter } = require("../utilities/tracking_window.js");

/** The stage rows one range produces, as compact "plate@HH:MM=status" strings. */
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

/** How many stages carry each value of one field, inside a range. */
async function counts_by(field_id, bounds, tracking) {
  const rows = await collection
    .aggregate([
      { $match: Object.assign({ form_group_id: FORM }, stage_prefilter(bounds, tracking)) },
      ...stage_rows_stages(tracking, bounds),
      { $group: { _id: `$data.${field_id}`, n: { $sum: 1 } } },
    ])
    .toArray();
  const out = {};
  rows.forEach((row) => {
    out[row._id] = row.n;
  });
  return out;
}

/** One record, two stages: the table has to list the arrival AND the departure. */
async function test_stage_expansion_sees_both_movements() {
  const rows = await stages_in(DAY, TRACKING);
  assert.deepStrictEqual(
    rows,
    [
      "RAB 002@09:00=in",
      "RAB 004@09:00=in",
      "RAB 001@12:00=in",
      "RAB 001@13:00=out",
      "RAB 003@13:00=out",
      "RAB 004@13:00=out",
    ],
    "the day must list every movement, with the value each stage carried",
  );
  const plates = rows.filter((row) => row.startsWith("RAB 001"));
  assert.strictEqual(plates.length, 2, "RAB 001 arrived and left inside the day, so it is two rows");
  assert.strictEqual(plates[0].endsWith("=in"), true, "its 12:00 stage says in");
  assert.strictEqual(plates[1].endsWith("=out"), true, "its 13:00 stage says out");
}

/** Two fields changing together is one movement. */
async function test_one_instant_is_one_stage() {
  const rows = await stages_in(DAY, TRACKING);
  const rab004 = rows.filter((row) => row.startsWith("RAB 004"));
  assert.strictEqual(rab004.length, 2, "RAB 004 moved twice (09:00 and 13:00), not four times");
  // Its bay changed at the same instant as its status, and each stage must
  // carry the bay it held THEN, not the one it holds now.
  const bays = await collection
    .aggregate([
      { $match: Object.assign({ form_group_id: FORM, _id: oid("000000000000000000000004") }, stage_prefilter(DAY, TRACKING)) },
      ...stage_rows_stages(TRACKING, DAY),
      { $sort: { [STAGE_AT]: 1 } },
      { $project: { _id: 0, bay: `$data.${BAY}` } },
    ])
    .toArray();
  assert.deepStrictEqual(bays.map((row) => row.bay), ["D1", "D9"], "each stage carries the bay of its own moment");
}

/** The record the old reading lost: in yesterday, out today. */
async function test_a_car_that_arrived_earlier_still_leaves_today() {
  const rows = await stages_in(DAY, TRACKING);
  assert.strictEqual(rows.includes("RAB 003@13:00=out"), true, "a car recorded yesterday and driven out today belongs to today");
  assert.strictEqual(
    rows.some((row) => row.startsWith("RAB 003") && row.endsWith("=in")),
    false,
    "its arrival was yesterday, so it is not one of today's movements",
  );
}

/** The two cards the scenario is about, both over the same hours. */
async function test_two_kpi_cards_over_the_same_hours() {
  const day = await counts_by(STATUS, DAY, TRACKING);
  assert.strictEqual(day.in, 3, "three cars arrived during the day");
  assert.strictEqual(day.out, 3, "three cars left during the day");

  const hour_12 = await counts_by(STATUS, HOUR_12, TRACKING);
  assert.strictEqual(hour_12.in, 1, "one car arrived in the 12:00 hour");
  assert.strictEqual(hour_12.out, undefined, "no car left in the 12:00 hour");

  const hour_13 = await counts_by(STATUS, HOUR_13, TRACKING);
  assert.strictEqual(hour_13.out, 3, "three cars left in the 13:00 hour");
  assert.strictEqual(hour_13.in, undefined, "no car arrived in the 13:00 hour");
}

/** The over-time chart buckets on the stage, so a car appears in both columns. */
async function test_over_time_puts_each_movement_in_its_own_column() {
  const rows = await collection
    .aggregate([
      { $match: Object.assign({ form_group_id: FORM }, stage_prefilter(DAY, TRACKING)) },
      ...stage_rows_stages(TRACKING, DAY),
      { $group: { _id: { hour: { $dateTrunc: { date: time_expr(TRACKING), unit: "hour" } }, status: `$data.${STATUS}` }, n: { $sum: 1 } } },
      { $sort: { "_id.hour": 1, "_id.status": 1 } },
    ])
    .toArray();
  const shaped = rows.map((row) => `${row._id.hour.toISOString().slice(11, 16)} ${row._id.status}=${row.n}`);
  assert.deepStrictEqual(shaped, ["09:00 in=2", "12:00 in=1", "13:00 out=3"], "each movement lands in the hour it happened");

  const total = rows.reduce((sum, row) => sum + row.n, 0);
  const table_rows = await stages_in(DAY, TRACKING);
  assert.strictEqual(total, table_rows.length, "the chart's columns add up to exactly what the table lists");
}

/** A value filter judges the stage, not whatever the record says today. */
async function test_a_status_filter_keeps_the_matching_stage() {
  const rows = await collection
    .aggregate([
      { $match: Object.assign({ form_group_id: FORM }, stage_prefilter(DAY, TRACKING)) },
      ...stage_rows_stages(TRACKING, DAY),
      { $match: { [`data.${STATUS}`]: { $in: ["in"] } } },
      { $sort: { [STAGE_AT]: 1, _id: 1 } },
    ])
    .toArray();
  assert.deepStrictEqual(
    rows.map((row) => `${row.data[PLATE]}@${row[STAGE_AT].toISOString().slice(11, 16)}`),
    ["RAB 002@09:00", "RAB 004@09:00", "RAB 001@12:00"],
    'filtering on "in" keeps the arrival stages - including those of cars that have since left',
  );
}

/** The export and the feed collapse: one line per car, never a history. */
async function test_export_and_feed_send_one_line_per_car() {
  const records = await collection.find(Object.assign({ form_group_id: FORM }, date_window_filter(DAY, TRACKING))).toArray();
  assert.strictEqual(records.length, 4, "four cars moved during the day, so the file has four lines");
  const ids = records.map((record) => record._id.toString()).sort();
  assert.strictEqual(new Set(ids).size, 4, "no car appears twice in the file");

  // And it is the same set of cars the table's stages belong to.
  const table_plates = new Set((await stages_in(DAY, TRACKING)).map((row) => row.split("@")[0]));
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
      { $project: { _id: 0, plate: `$data.${PLATE}`, status: `$data.${STATUS}` } },
    ])
    .toArray();
  assert.deepStrictEqual(
    as_of_noon,
    [{ plate: "RAB 001", status: "in" }],
    "an export of the 12:00 hour says the car was IN, even though it has since left",
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
    ["RAB 001", "RAB 003", "RAB 004"],
    "the three cars labelled out at 13:00 are re-delivered, so the dataset finally shows they left",
  );
  assert.strictEqual(
    plates.includes("RAB 002"),
    false,
    "the car that has not moved since 09:00 is not re-sent",
  );
}

/** An untracked form must read exactly as it always did: by arrival. */
async function test_untracked_form_is_unchanged() {
  assert.deepStrictEqual(stage_rows_stages(null, DAY), [], "an untracked form needs no stage expansion at all");
  assert.deepStrictEqual(
    stage_prefilter(DAY, null),
    { submitted_at: { $gte: DAY.start, $lte: DAY.end } },
    "an untracked range is still a plain both-bounds filter on submitted_at",
  );
  // A tracked form that declares no updatable field can never have a second
  // stage, so it reads the same plain way.
  const no_fields = { enabled: true, key_field_id: PLATE, editable_field_ids: [] };
  assert.deepStrictEqual(stage_rows_stages(no_fields, DAY), [], "nothing to expand when nothing can change");
  assert.deepStrictEqual(
    stage_prefilter(DAY, no_fields),
    { submitted_at: { $gte: DAY.start, $lte: DAY.end } },
    "and its range stays a plain both-bounds filter",
  );

  const arrivals = await collection
    .find(Object.assign({ form_group_id: FORM }, stage_prefilter(DAY, null)))
    .toArray();
  assert.deepStrictEqual(
    arrivals.map((record) => record.data[PLATE]).sort(),
    ["RAB 001", "RAB 002", "RAB 004"],
    "read as an untracked form, the day holds only what arrived in it - RAB 003 arrived yesterday",
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
