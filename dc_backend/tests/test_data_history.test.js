const assert = require("assert");
const express = require("express");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { MongoClient, ObjectId } = require("mongodb");
const { set_db_handles } = require("../db_connection/db.js");
const { TEST_DATA_FLAG } = require("../models/submissions_model.js");
const { composite_record_key, record_key_pairs, key_fields_version, record_key_of } = require("../utilities/tracking.js");
const { MIN_UPDATES, MAX_UPDATES, random_update_moments } = require("../utilities/test_data_history.js");

/**
 * The test data manager on a TRACKED form, over HTTP against the real
 * test-data router and a real MongoDB: every generated record carries a
 * change history written the way the real update path writes it - three
 * to six "updated" entries at strictly increasing moments after the
 * submission and never after now, value periods that chain without a
 * gap and end open on today's value, data equal to the final values, the
 * key stamp untouched, updated_at the last moment - and the dashboard
 * reads each record in the period of its last update. An untracked form
 * generates exactly as before, and the test-data flag still lets a delete
 * remove everything.
 */

const FORM = "history-tracked";
const PLAIN_FORM = "history-plain";
const PLATE = "plate_f";
const STATUS = "status_f";
const NOTE = "note_f";
const AMOUNT = "amount_f";
const EDITABLE = [STATUS, NOTE, AMOUNT];
const TRACKING = { enabled: true, key_field_ids: [PLATE], key_field_id: PLATE, key_unique: false, editable_field_ids: EDITABLE };

const SCHEMA = {
  fields: [
    { id: PLATE, type: "text", label: { en: "Plate" }, mandatory: true },
    {
      id: STATUS,
      type: "single_select",
      label: { en: "Status" },
      mandatory: true,
      options: [
        { id: "o1", value: "in", label: { en: "In" } },
        { id: "o2", value: "out", label: { en: "Out" } },
        { id: "o3", value: "pending", label: { en: "Pending" } },
      ],
    },
    { id: NOTE, type: "text", label: { en: "Note" } },
    { id: AMOUNT, type: "number", label: { en: "Amount" } },
  ],
};

const DAY_MS = 86400000;
const HOUR_MS = 3600000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const json = (value) => JSON.stringify(value === undefined ? null : value);

let server = null;
let client = null;
let db = null;
let http = null;
let base = "";

async function call(method, url, body) {
  const options = { method, headers: { "x-language": "en" } };
  if (body !== undefined) {
    options.headers["content-type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  const response = await fetch(base + url, options);
  return { status: response.status, body: await response.json() };
}

/** Starts a generation over a six-hour window ten days ago and waits for the job to finish. */
async function generate(form_group_id) {
  const from = new Date(Date.now() - 10 * DAY_MS);
  const started = await call("POST", `/${form_group_id}/generate`, {
    version: 1,
    from: from.toISOString(),
    to: new Date(from.getTime() + 6 * HOUR_MS).toISOString(),
    min_per_hour: 2,
    max_per_hour: 3,
  });
  assert.strictEqual(started.status, 202, `generation must start: ${JSON.stringify(started.body)}`);
  const job_id = started.body.data.job_id;
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const polled = await call("GET", `/jobs/${job_id}`);
    const job = polled.body.data;
    if (job.status === "completed" || job.status === "error" || job.status === "cancelled") return job;
    await sleep(100);
  }
  throw new Error("the generation job did not finish");
}

async function run_all_tests() {
  server = await MongoMemoryServer.create();
  client = await MongoClient.connect(server.getUri());
  db = client.db("dcs_test_data_history");
  set_db_handles(db, client.db("cok_test"));

  const owner_id = new ObjectId();
  const project = { _id: new ObjectId(), name: "P", created_by: owner_id.toString(), access_control_enabled: false, created_at: new Date() };
  await db.collection("dcs_projects").insertOne(project);
  const form_doc = (form_group_id, tracking) => ({
    form_group_id,
    version: 1,
    is_active: true,
    form_name: "Parking",
    project_id: project._id.toString(),
    schema: SCHEMA,
    tracking,
    created_by: owner_id.toString(),
    created_at: new Date(),
    updated_at: new Date(),
  });
  await db.collection("dcs_forms").insertMany([form_doc(FORM, TRACKING), form_doc(PLAIN_FORM, null)]);

  const user = { user_id: owner_id, email: "owner@x.rw", full_name: "Olive Owner", role: "Officer", permissions: [], department_id: null };
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = user;
    req.language = "en";
    req.navigation = { links: [{ id: "dcs" }] };
    next();
  });
  app.use("/dcs/api/test-data", require("../routes/test_data/routes.js"));
  http = app.listen(0);
  base = `http://127.0.0.1:${http.address().port}/dcs/api/test-data`;

  try {
    test_update_moments_are_increasing_and_bounded();
    await test_every_generated_record_carries_a_consistent_history();
    await test_the_dashboard_reads_each_record_by_its_last_update();
    await test_an_untracked_form_generates_as_before();
    await test_deleting_test_data_removes_everything();
  } finally {
    await new Promise((resolve) => http.close(resolve));
    await client.close();
    await server.stop();
  }
}

/** The moment helper alone: strictly increasing, after the start, never at or after the end. */
function test_update_moments_are_increasing_and_bounded() {
  const from = new Date(Date.now() - 10 * DAY_MS);
  const until = new Date();
  for (let round = 0; round < 50; round += 1) {
    const moments = random_update_moments(from, until, 6);
    assert.strictEqual(moments.length, 6, "a ten-day span holds six moments");
    moments.forEach((at, index) => {
      assert.ok(at > (index === 0 ? from : moments[index - 1]), "each moment is strictly after the previous one");
      assert.ok(at < until, "and never after now");
    });
  }
  assert.deepStrictEqual(random_update_moments(until, until, 3), [], "an empty span holds no moment");
  const tight = random_update_moments(new Date(until.getTime() - 10), until, 3);
  assert.ok(tight.length >= 1 && tight.length <= 3 && tight.every((at) => at < until), "a ten-millisecond span still fits what it can");
}

/** One record's history, periods, data and keys all agree with each other. */
function check_record(record, finished_at) {
  assert.strictEqual(record[TEST_DATA_FLAG], true, "the record is flagged as generated");
  const history = record.history;
  assert.ok(Array.isArray(history) && history.length >= 1, "the record carries a history");
  assert.strictEqual(history[0].kind, "created", "the history opens with the creation");
  assert.strictEqual(history[0].at.getTime(), record.submitted_at.getTime(), "dated at the submission");
  const updates = history.slice(1);
  assert.ok(updates.length >= MIN_UPDATES && updates.length <= MAX_UPDATES, `${MIN_UPDATES} to ${MAX_UPDATES} updates, got ${updates.length}`);
  let previous = record.submitted_at;
  updates.forEach((entry) => {
    assert.strictEqual(entry.kind, "updated", "every later entry is an update");
    assert.ok(entry.at > previous, "moments strictly increase");
    assert.ok(entry.at <= finished_at, "no change happens after now");
    assert.ok(entry.by === null || (entry.by && typeof entry.by.name === "string" && entry.by.name), "made by a generated respondent or nobody");
    assert.ok(Array.isArray(entry.changes) && entry.changes.length > 0, "an update changes something");
    entry.changes.forEach((change) => {
      assert.ok(EDITABLE.includes(change.field_id), "only updatable fields change");
      assert.notStrictEqual(json(change.from), json(change.to), "a change is a real change");
    });
    previous = entry.at;
  });
  assert.strictEqual(record.updated_at.getTime(), previous.getTime(), "updated_at is the last moment");

  EDITABLE.forEach((field_id) => {
    const periods = record.tracking_periods[field_id];
    assert.ok(Array.isArray(periods) && periods.length >= 1, `${field_id} carries periods`);
    assert.strictEqual(periods[0].from.getTime(), record.submitted_at.getTime(), "the first period starts at the submission");
    periods.forEach((period, index) => {
      if (index < periods.length - 1) assert.strictEqual(period.to.getTime(), periods[index + 1].from.getTime(), "periods chain without a gap");
      else assert.strictEqual(period.to, null, "the last period is open");
    });
    assert.strictEqual(json(periods[periods.length - 1].value), json(record.data[field_id]), "data holds the open period's value");
    const changed_at = updates.filter((entry) => entry.changes.some((change) => change.field_id === field_id));
    assert.strictEqual(periods.length, changed_at.length + 1, "one period per change of the field, plus the first");
    changed_at.forEach((entry, index) => {
      const change = entry.changes.find((candidate) => candidate.field_id === field_id);
      assert.strictEqual(periods[index + 1].from.getTime(), entry.at.getTime(), "a period opens at the change");
      assert.strictEqual(json(periods[index].value), json(change.from), "the closed period held the old value");
      assert.strictEqual(json(periods[index + 1].value), json(change.to), "the opened period holds the new one");
    });
  });

  assert.strictEqual(record.record_key, composite_record_key(TRACKING, record.data), "the whole key matches the data");
  assert.strictEqual(record.record_key, record_key_of(record.data[PLATE]), "and the key is the plate alone");
  assert.deepStrictEqual(record.record_key_pairs, record_key_pairs(TRACKING, record.data), "the pairs match the data");
  assert.strictEqual(record.record_key_fields, key_fields_version(TRACKING), "the marker names the key field");
  assert.ok(!updates.some((entry) => entry.changes.some((change) => change.field_id === PLATE)), "the key was never edited");
}

let tracked_records = [];

async function test_every_generated_record_carries_a_consistent_history() {
  const job = await generate(FORM);
  const finished_at = new Date();
  assert.strictEqual(job.status, "completed", `the job completes: ${JSON.stringify(job)}`);
  assert.strictEqual(job.failed, 0, "no record failed validation");
  tracked_records = await db.collection("dcs_submissions").find({ form_group_id: FORM }).toArray();
  assert.strictEqual(tracked_records.length, job.saved, "every saved record is in the database");
  assert.ok(tracked_records.length >= 12, `six hours at two to three an hour: at least twelve records, got ${tracked_records.length}`);
  tracked_records.forEach((record) => check_record(record, finished_at));
  const anonymous = tracked_records.flatMap((record) => record.history.slice(1)).filter((entry) => entry.by === null).length;
  const named = tracked_records.flatMap((record) => record.history.slice(1)).filter((entry) => entry.by !== null).length;
  assert.ok(named > 0, "some updates were made by a generated respondent");
  assert.ok(anonymous + named === tracked_records.flatMap((record) => record.history.slice(1)).length, "every update says who made it, or nobody");
}

/** A KPI over a window that holds a record's creation but not its last update does not count it. */
async function test_the_dashboard_reads_each_record_by_its_last_update() {
  const { compute_widget_data } = require("../util-dashboard/widget_data.js");
  const form_version = await db.collection("dcs_forms").findOne({ form_group_id: FORM });
  const count_in = async (start, end) => {
    const widget = { form_group_id: FORM, chart_type: "kpi", metric: { aggregation: "count" }, filters: [], period: { preset: "custom", from: start.toISOString(), to: end.toISOString() } };
    return (await compute_widget_data(widget, form_version, null)).value;
  };
  // A custom window is read to the second (its end is the end of that
  // second, and the same instant twice means the whole day), so the
  // windows below are built a second apart rather than a millisecond.
  const total = tracked_records.length;
  const first_submitted = new Date(Math.min(...tracked_records.map((record) => record.submitted_at.getTime())));
  const last_updated = new Date(Math.max(...tracked_records.map((record) => record.updated_at.getTime())));
  // cut is the last millisecond of the second before the latest update's second.
  const cut = new Date(Math.floor(last_updated.getTime() / 1000) * 1000 - 1);
  const latest = tracked_records.filter((record) => record.updated_at > cut).length;
  // The same instant twice would mean a whole day; a window of that one second, then.
  const last_second_end = new Date(cut.getTime() + 1000);
  assert.strictEqual(await count_in(first_submitted, last_updated), total, "the whole span counts every record");
  assert.strictEqual(await count_in(new Date(cut.getTime() + 1), last_second_end), latest, "the last second holds exactly the records last updated then");
  assert.ok(latest >= 1 && latest < total, "which is the latest one (or a few sharing its second), not everything");
  assert.strictEqual(await count_in(first_submitted, cut), total - latest, "a window that holds their creation but not their last update leaves them out");
  const last_submitted = new Date(Math.max(...tracked_records.map((record) => record.submitted_at.getTime())));
  const moved_inside = tracked_records.filter((record) => record.updated_at <= new Date(Math.floor(last_submitted.getTime() / 1000) * 1000 + 999)).length;
  assert.strictEqual(await count_in(first_submitted, last_submitted), moved_inside, "the submission window counts only the records whose last update fell inside it");
}

/** No tracking: records are what the generator always made, nothing more. */
async function test_an_untracked_form_generates_as_before() {
  const job = await generate(PLAIN_FORM);
  assert.strictEqual(job.status, "completed", "the untracked job completes");
  const records = await db.collection("dcs_submissions").find({ form_group_id: PLAIN_FORM }).toArray();
  assert.ok(records.length >= 12, "records were generated");
  records.forEach((record) => {
    assert.strictEqual(record[TEST_DATA_FLAG], true, "flagged as generated");
    ["history", "tracking_periods", "updated_at", "record_key", "record_key_pairs", "record_key_fields"].forEach((key) => {
      assert.strictEqual(record[key], undefined, `an untracked record carries no ${key}`);
    });
    assert.ok(record.data && record.data[PLATE], "and still carries its answers");
  });
}

/** The flag still lets the delete remove every generated record, history and all. */
async function test_deleting_test_data_removes_everything() {
  const deleted = await call("DELETE", `/${FORM}`, {});
  assert.strictEqual(deleted.status, 200, `the delete answers 200: ${JSON.stringify(deleted.body)}`);
  assert.strictEqual(await db.collection("dcs_submissions").countDocuments({ form_group_id: FORM }), 0, "every tracked test record is gone");
  assert.ok((await db.collection("dcs_submissions").countDocuments({ form_group_id: PLAIN_FORM })) > 0, "the other form's records stay");
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
