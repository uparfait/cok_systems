const assert = require("assert");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { MongoClient } = require("mongodb");
const { date_window_filter } = require("../utilities/tracking_window.js");
const { resolve_period_bounds } = require("../utilities/period_bounds.js");

/**
 * Which records a picked date range keeps, run against a real MongoDB.
 *
 * This exists because the rule cannot be read off the filter object: it is
 * a $expr over tracking_periods, and the only way to know it keeps the
 * right records is to put records in front of it. The regression it guards
 * is a range that silently keeps everything - a tracked form whose date
 * filter matched every record it had ever collected, because only the
 * upper bound was applied and every current preset ends in the future.
 */

const FORM = "form-window-test";
const OTHER_FORM = "form-other";
const TRACKING = { enabled: true, key_field_id: "k", editable_field_ids: ["status", "note"] };

const LAST_YEAR = new Date("2025-06-15T10:00:00Z");
const IN_JANUARY = new Date("2026-01-20T10:00:00Z");
const IN_WINDOW = new Date("2026-09-25T09:00:00Z");

// The range under test, and a past range that must still narrow.
const WINDOW = { start: new Date("2026-09-25T00:00:00Z"), end: new Date("2026-09-25T23:59:59.999Z") };
const JANUARY = { start: new Date("2026-01-01T00:00:00Z"), end: new Date("2026-01-31T23:59:59.999Z") };

function periods(field_values) {
  const out = {};
  Object.keys(field_values).forEach((field_id) => {
    out[field_id] = field_values[field_id].map(([value, from, to]) => ({ value, from, to: to || null }));
  });
  return out;
}

const RECORDS = [
  // No tracking_periods at all: only an arrival date to read.
  { _id: "arrived_in_window", form_group_id: FORM, submitted_at: IN_WINDOW },
  { _id: "arrived_long_ago", form_group_id: FORM, submitted_at: LAST_YEAR },

  // Recorded long ago and CHANGED inside the window. The register has to
  // show it: this is the record the whole feature exists for.
  {
    _id: "old_changed_in_window",
    form_group_id: FORM,
    submitted_at: LAST_YEAR,
    tracking_periods: periods({ status: [["alive", LAST_YEAR, IN_WINDOW], ["dead", IN_WINDOW, null]], note: [["n", LAST_YEAR, null]] }),
  },
  // Recorded long ago, never touched since: nothing happened to it here.
  {
    _id: "old_untouched",
    form_group_id: FORM,
    submitted_at: LAST_YEAR,
    tracking_periods: periods({ status: [["alive", LAST_YEAR, null]], note: [["n", LAST_YEAR, null]] }),
  },
  // Recorded long ago, changed only in January.
  {
    _id: "old_changed_in_january",
    form_group_id: FORM,
    submitted_at: LAST_YEAR,
    tracking_periods: periods({ status: [["alive", LAST_YEAR, IN_JANUARY], ["moved", IN_JANUARY, null]], note: [["n", LAST_YEAR, null]] }),
  },
  // Created inside the window.
  {
    _id: "created_in_window",
    form_group_id: FORM,
    submitted_at: IN_WINDOW,
    tracking_periods: periods({ status: [["alive", IN_WINDOW, null]], note: [["n", IN_WINDOW, null]] }),
  },
  // Tracked form, but these predate tracking (or the form tracks no
  // updatable field), so they carry no periods and must fall back to
  // their arrival date instead of vanishing from every range.
  { _id: "no_periods_in_window", form_group_id: FORM, submitted_at: IN_WINDOW, tracking_periods: {} },
  { _id: "no_periods_long_ago", form_group_id: FORM, submitted_at: LAST_YEAR, tracking_periods: {} },
  { _id: "empty_period_lists_in_window", form_group_id: FORM, submitted_at: IN_WINDOW, tracking_periods: { status: [] } },

  // Another form: must never leak into either reading.
  { _id: "other_form", form_group_id: OTHER_FORM, submitted_at: IN_WINDOW },
];

async function run_all_tests() {
  const server = await MongoMemoryServer.create();
  const client = await MongoClient.connect(server.getUri());
  try {
    const collection = client.db("dcs_window_test").collection("dcs_submissions");
    await collection.insertMany(RECORDS);
    // The index the production query is shaped to keep using.
    await collection.createIndex({ form_group_id: 1, submitted_at: -1 }, { name: "form_group_submitted_at" });

    await test_untracked_reads_arrivals(collection);
    await test_tracked_reads_created_or_changed(collection);
    await test_tracked_excludes_what_did_not_move(collection);
    await test_a_past_range_still_narrows(collection);
    await test_records_without_periods_fall_back_to_arrival(collection);
    await test_unbounded_range_keeps_everything(collection);
    await test_no_preset_keeps_a_record_that_never_moved(collection);
    await test_the_index_is_still_used(collection);
  } finally {
    await client.close();
    await server.stop();
  }
}

/** The ids one filter keeps, both through find() and through an aggregation $match. */
async function kept(collection, filter) {
  const found = (await collection.find(filter).toArray()).map((document) => document._id).sort();
  const aggregated = (await collection.aggregate([{ $match: filter }]).toArray()).map((document) => document._id).sort();
  assert.deepStrictEqual(aggregated, found, "a $match must keep exactly what find() keeps - the table uses both paths");
  return found;
}

function filter_for(bounds, tracking) {
  return Object.assign({ form_group_id: FORM }, date_window_filter(bounds, tracking));
}

/** An untracked form is answered once, so its records are dated by arrival. */
async function test_untracked_reads_arrivals(collection) {
  assert.deepStrictEqual(
    await kept(collection, filter_for(WINDOW, null)),
    ["arrived_in_window", "created_in_window", "empty_period_lists_in_window", "no_periods_in_window"].sort(),
    "untracked: the range must keep exactly what arrived inside it",
  );
}

/** A tracked form is a register: the range keeps what was created OR changed in it. */
async function test_tracked_reads_created_or_changed(collection) {
  assert.deepStrictEqual(
    await kept(collection, filter_for(WINDOW, TRACKING)),
    ["arrived_in_window", "created_in_window", "empty_period_lists_in_window", "no_periods_in_window", "old_changed_in_window"].sort(),
    "tracked: the range must keep what was created in it plus what was changed in it",
  );
}

/** The regression: a record nothing happened to must not ride along. */
async function test_tracked_excludes_what_did_not_move(collection) {
  const ids = await kept(collection, filter_for(WINDOW, TRACKING));
  assert.strictEqual(ids.includes("old_untouched"), false, "tracked: a record untouched since last year is not in this window");
  assert.strictEqual(ids.includes("old_changed_in_january"), false, "tracked: a record last changed in January is not in this window");
  assert.strictEqual(ids.includes("other_form"), false, "another form's records never leak in");
}

/** A range that ended in the past must not keep everything before it either. */
async function test_a_past_range_still_narrows(collection) {
  assert.deepStrictEqual(
    await kept(collection, filter_for(JANUARY, TRACKING)),
    ["old_changed_in_january"],
    "tracked: a January range keeps only what opened in January",
  );
  assert.deepStrictEqual(
    await kept(collection, filter_for(JANUARY, null)),
    [],
    "untracked: nothing arrived in January",
  );
}

/** Turning tracking on must not hide every record collected before it. */
async function test_records_without_periods_fall_back_to_arrival(collection) {
  const in_window = await kept(collection, filter_for(WINDOW, TRACKING));
  assert.strictEqual(in_window.includes("no_periods_in_window"), true, "a record with no periods is read by its arrival date");
  assert.strictEqual(in_window.includes("empty_period_lists_in_window"), true, "a record whose period lists are empty is read by its arrival date");
  assert.strictEqual(in_window.includes("no_periods_long_ago"), false, "that fallback still respects the range");
}

/** "All" is unbounded and must add no date predicate at all. */
async function test_unbounded_range_keeps_everything(collection) {
  assert.deepStrictEqual(date_window_filter(null, TRACKING), {}, "an unbounded range contributes no condition");
  assert.deepStrictEqual(
    await kept(collection, filter_for(null, TRACKING)),
    RECORDS.filter((record) => record.form_group_id === FORM).map((record) => record._id).sort(),
    "period=all keeps every record of the form",
  );
}

/**
 * The symptom itself, pinned against every real preset.
 *
 * A record that arrived in June 2025 and was never touched belongs to no
 * window that opened after it. The pre-fix filter applied only the upper
 * bound, so it kept that record in EVERY preset - which is what "the date
 * filter does nothing" looked like. Asserting its absence (rather than
 * merely that the presets differ from each other) is what catches that:
 * "last_month" did differ from the others even with the bug, because its
 * end is in the past, while still wrongly keeping everything before it.
 *
 * Deliberately worded so it does not depend on the day it runs: every
 * preset below is inside the current year, and the two records are dated
 * mid-2025, so none of these windows can legitimately cover them.
 */
async function test_no_preset_keeps_a_record_that_never_moved(collection) {
  const untouched_since_2025 = ["old_untouched", "no_periods_long_ago"];
  for (const preset of ["today", "this_week", "this_month", "last_month", "this_year"]) {
    const ids = await kept(collection, filter_for(resolve_period_bounds(preset), TRACKING));
    untouched_since_2025.forEach((id) => {
      assert.strictEqual(ids.includes(id), false, `${preset}: kept ${id}, which has not moved since June 2025 - the range is not being applied`);
    });
  }

  // The same reading still reaches back for a record that DID move inside
  // the year, so the rule is narrowing rather than just excluding.
  const this_year = await kept(collection, filter_for(resolve_period_bounds("this_year"), TRACKING));
  assert.strictEqual(this_year.includes("old_changed_in_january"), true, "this_year must keep the record changed in January");
  assert.strictEqual(this_year.includes("old_untouched"), false, "this_year must not keep the record that never moved");
}

/**
 * The $expr cannot be served from an index, so the tracked filter carries
 * submitted_at <= end to keep the collection's own index in play. Every
 * opened moment is at or after the record's submission, so that bound can
 * never drop a row - but it does have to actually be used.
 */
async function test_the_index_is_still_used(collection) {
  const plan = await collection.find(filter_for(WINDOW, TRACKING)).explain("queryPlanner");
  const described = JSON.stringify(plan.queryPlanner.winningPlan);
  assert.strictEqual(described.includes("form_group_submitted_at"), true, `the tracked filter must still ride the index: ${described}`);
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
