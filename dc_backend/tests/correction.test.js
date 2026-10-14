const assert = require("assert");
const express = require("express");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { MongoClient, ObjectId } = require("mongodb");
const { set_db_handles } = require("../db_connection/db.js");

/**
 * Correcting the past from the record edit page, over HTTP against the
 * real public router: PUT /public/records/:id with as_of rewrites what
 * the record said at that moment. A status "alive" from 13:00 to 13:50
 * and "dead" after, corrected to "sold" as of 13:30: the 13:00-13:50
 * period now holds sold, the 13:00 entry's `to` and the 13:50 entry's
 * `from` read sold, later periods are untouched, the data still says
 * dead, updated_at has not moved, and a "corrected" entry with as_of
 * 13:30 is appended; a period ending 13:30 now reads sold, one ending
 * 14:00 still dead. Correcting the open period changes the data and
 * updated_at; nothing to change is 400; a plain (not updatable) field
 * corrected takes the new value; an untracked record edits as always.
 */

const FORM = "correction-form";
const PLAIN_FORM = "correction-plain";
const ID = "id_f";
const STATUS = "status_f";
const NAME = "name_f";
const TRACKING = { enabled: true, key_field_ids: [ID], key_field_id: ID, key_unique: true, editable_field_ids: [STATUS] };
const SCHEMA = {
  fields: [
    { id: ID, type: "text", label: { en: "Id" } },
    {
      id: STATUS,
      type: "single_select",
      label: { en: "Status" },
      options: [
        { id: "o0", value: "new", label: { en: "New" } },
        { id: "o1", value: "alive", label: { en: "Alive" } },
        { id: "o2", value: "dead", label: { en: "Dead" } },
        { id: "o3", value: "sold", label: { en: "Sold" } },
        { id: "o4", value: "buried", label: { en: "Buried" } },
      ],
    },
    { id: NAME, type: "text", label: { en: "Name" } },
  ],
};

const T = (time) => new Date(`2023-12-12T${time}Z`);
const T1200 = T("12:00:00.000");
const T1300 = T("13:00:00.000");
const T1350 = T("13:50:00.000");
const span = (value, from, to) => ({ value, from, to: to || null });

/** New at 12:00, alive from 13:00, dead from 13:50. */
function tracked_record() {
  return {
    _id: new ObjectId(),
    form_group_id: FORM,
    version: 1,
    submitted_at: T1200,
    updated_at: T1350,
    record_key: "r1",
    record_key_pairs: [{ f: ID, k: "r1" }],
    record_key_fields: ID,
    data: { [ID]: "r1", [STATUS]: "dead", [NAME]: "first" },
    tracking_periods: { [STATUS]: [span("new", T1200, T1300), span("alive", T1300, T1350), span("dead", T1350)] },
    history: [
      { at: T1200, kind: "created", by: null, changes: [] },
      { at: T1300, kind: "updated", by: null, changes: [{ field_id: STATUS, from: "new", to: "alive" }] },
      { at: T1350, kind: "updated", by: null, changes: [{ field_id: STATUS, from: "alive", to: "dead" }] },
    ],
  };
}

let server = null;
let client = null;
let db = null;
let http = null;
let base = "";
let form_version = null;

async function call(method, url, body) {
  const options = { method, headers: { "x-language": "en" } };
  if (body !== undefined) {
    options.headers["content-type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  const response = await fetch(base + url, options);
  return { status: response.status, body: await response.json() };
}

const records = () => db.collection("dcs_submissions");

async function run_all_tests() {
  server = await MongoMemoryServer.create();
  client = await MongoClient.connect(server.getUri());
  db = client.db("dcs_correction");
  set_db_handles(db, client.db("cok_test"));
  const project_id = new ObjectId().toString();
  form_version = { form_group_id: FORM, version: 1, is_active: true, form_name: "People", project_id, schema: SCHEMA, tracking: TRACKING, created_at: T1200, updated_at: T1200 };
  await db.collection("dcs_forms").insertMany([form_version, Object.assign({}, form_version, { form_group_id: PLAIN_FORM, tracking: null })]);

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
    await test_a_past_period_is_corrected_without_moving_the_record();
    await test_the_readers_show_the_corrected_past();
    await test_correcting_the_open_period_changes_the_data();
    await test_nothing_to_correct_is_refused();
    await test_a_plain_field_is_corrected_in_the_data();
    await test_a_wall_clock_as_of_is_read_in_the_viewers_zone();
    await test_an_untracked_record_edits_as_always();
  } finally {
    await new Promise((resolve) => http.close(resolve));
    await client.close();
    await server.stop();
  }
}

let corrected_id = null;

/** Sold as of 13:30: the alive period becomes sold, both entries around it agree, the rest stays. */
async function test_a_past_period_is_corrected_without_moving_the_record() {
  const inserted = await records().insertOne(tracked_record());
  corrected_id = inserted.insertedId;
  const response = await call("PUT", `/records/${corrected_id}`, { data: { [STATUS]: "sold" }, as_of: "2023-12-12T13:30:00Z" });
  assert.strictEqual(response.status, 200, `the correction succeeds: ${JSON.stringify(response.body)}`);
  const record = await records().findOne({ _id: corrected_id });
  assert.deepStrictEqual(
    record.tracking_periods[STATUS].map((period) => `${period.value}:${period.from.toISOString().slice(11, 16)}-${period.to ? period.to.toISOString().slice(11, 16) : "open"}`),
    ["new:12:00-13:00", "sold:13:00-13:50", "dead:13:50-open"],
    "the 13:00-13:50 period now holds sold, its bounds and the others untouched",
  );
  assert.strictEqual(record.history[1].changes[0].to, "sold", "the 13:00 entry now says it set sold");
  assert.strictEqual(record.history[2].changes[0].from, "sold", "the 13:50 entry now says it changed sold to dead");
  assert.strictEqual(record.data[STATUS], "dead", "the data still says dead");
  assert.strictEqual(record.updated_at.getTime(), T1350.getTime(), "updated_at has not moved");
  const last = record.history[record.history.length - 1];
  assert.strictEqual(last.kind, "corrected", "a corrected entry was appended");
  assert.strictEqual(last.as_of.toISOString(), "2023-12-12T13:30:00.000Z", "saying which moment it corrected");
  assert.deepStrictEqual(last.changes, [{ field_id: STATUS, from: "alive", to: "sold", at: T1300 }], "with the change and the start of the period it corrected");
  assert.strictEqual(response.body.data.history[3].kind, "corrected", "the response carries the entry");
  assert.strictEqual(response.body.data.history[3].as_of, "2023-12-12T13:30:00.000Z", "with its as_of");
  assert.strictEqual(response.body.data.data[STATUS], "dead", "and the record as it stands");
}

/** The table and a KPI read the corrected past. */
async function test_the_readers_show_the_corrected_past() {
  const submissions_model = require("../models/submissions_model.js");
  const { compute_widget_data } = require("../util-dashboard/widget_data.js");
  const status_at = async (end) => (await submissions_model.list_submissions(FORM, undefined, 1, 50, { start: T1200, end }, { tracking: TRACKING })).items[0].data[STATUS];
  assert.strictEqual(await status_at(T("13:30:00.000")), "sold", "the table at 13:30 reads sold");
  assert.strictEqual(await status_at(T("14:00:00.000")), "dead", "and at 14:00 still dead");
  const kpi = async (value, to) => (await compute_widget_data({ form_group_id: FORM, chart_type: "kpi", metric: { aggregation: "count" }, filters: [{ field_id: STATUS, operator: "eq", value }], period: { preset: "custom", from: "2023-12-12T12:00:00Z", to } }, form_version, null)).value;
  assert.strictEqual(await kpi("sold", "2023-12-12T13:30:00Z"), 1, "a sold card at 13:30 counts it");
  assert.strictEqual(await kpi("alive", "2023-12-12T13:30:00Z"), 0, "the alive card no longer does");
  assert.strictEqual(await kpi("dead", "2023-12-12T14:00:00Z"), 1, "at 14:00 it is dead");
}

/** Correcting the open period is correcting today: the data and updated_at move. */
async function test_correcting_the_open_period_changes_the_data() {
  const before = new Date();
  const response = await call("PUT", `/records/${corrected_id}`, { data: { [STATUS]: "buried" }, as_of: "2023-12-12T14:30:00Z", respondent: { name: "Clerk" } });
  assert.strictEqual(response.status, 200, `the correction succeeds: ${JSON.stringify(response.body)}`);
  const record = await records().findOne({ _id: corrected_id });
  assert.strictEqual(record.data[STATUS], "buried", "the open period is today's value, so the data changed");
  assert.strictEqual(record.tracking_periods[STATUS][2].value, "buried", "the open period holds it");
  assert.strictEqual(record.tracking_periods[STATUS][2].to, null, "and stays open");
  assert.strictEqual(record.history[2].changes[0].to, "buried", "the 13:50 entry now says it set buried");
  assert.ok(record.updated_at >= before, "updated_at moved to now");
  const last = record.history[record.history.length - 1];
  assert.deepStrictEqual(last.changes, [{ field_id: STATUS, from: "dead", to: "buried", at: T1350 }], "the corrected entry names the open period's start");
  assert.deepStrictEqual(last.by, { name: "Clerk", email: "", phone: "" }, "and who corrected");
}

/** The same value as of that moment is nothing to correct. */
async function test_nothing_to_correct_is_refused() {
  const response = await call("PUT", `/records/${corrected_id}`, { data: { [STATUS]: "sold" }, as_of: "2023-12-12T13:30:00Z" });
  assert.strictEqual(response.status, 400, "sold as of 13:30 is what it already says");
  assert.strictEqual(/chang/i.test(response.body.message), true, "with the no-changes message");
}

/** A field that is not updatable has one value: the correction sets it, listed with no period. */
async function test_a_plain_field_is_corrected_in_the_data() {
  const before = await records().findOne({ _id: corrected_id });
  const response = await call("PUT", `/records/${corrected_id}`, { data: { [NAME]: "second" }, as_of: "2023-12-12T13:30:00Z" });
  assert.strictEqual(response.status, 200, `the correction succeeds: ${JSON.stringify(response.body)}`);
  const record = await records().findOne({ _id: corrected_id });
  assert.strictEqual(record.data[NAME], "second", "the data holds the new name");
  const last = record.history[record.history.length - 1];
  assert.deepStrictEqual(last.changes, [{ field_id: NAME, from: "first", to: "second", at: null }], "listed in the corrected entry with no period");
  assert.strictEqual(record.updated_at.getTime(), before.updated_at.getTime(), "no open period changed, so updated_at stayed");
  assert.strictEqual(record.tracking_periods[STATUS].length, 3, "the status periods are untouched");
}

/** as_of without a zone is the viewer's wall clock when tz is given. */
async function test_a_wall_clock_as_of_is_read_in_the_viewers_zone() {
  // 15:10 in Kigali is 13:10Z: inside the 13:00-13:50 period.
  const response = await call("PUT", `/records/${corrected_id}`, { data: { [STATUS]: "alive" }, as_of: "2023-12-12T15:10:00", tz: "Africa/Kigali" });
  assert.strictEqual(response.status, 200, `the correction succeeds: ${JSON.stringify(response.body)}`);
  const record = await records().findOne({ _id: corrected_id });
  assert.strictEqual(record.tracking_periods[STATUS][1].value, "alive", "the 13:00-13:50 period was corrected back to alive");
  const last = record.history[record.history.length - 1];
  assert.strictEqual(last.as_of.toISOString(), "2023-12-12T13:10:00.000Z", "as_of was read in Kigali time");
  const bad = await call("PUT", `/records/${corrected_id}`, { data: { [STATUS]: "sold" }, as_of: "not a moment" });
  assert.strictEqual(bad.status, 400, "an unreadable as_of is refused");
}

/** An untracked record has no past to correct: as_of is ignored and the edit is a plain one. */
async function test_an_untracked_record_edits_as_always() {
  const inserted = await records().insertOne({ form_group_id: PLAIN_FORM, version: 1, submitted_at: T1200, data: { [ID]: "p1", [STATUS]: "alive", [NAME]: "n" } });
  const before = new Date();
  const response = await call("PUT", `/records/${inserted.insertedId}`, { data: { [STATUS]: "dead" }, as_of: "2023-12-12T13:30:00Z" });
  assert.strictEqual(response.status, 200, `the edit succeeds: ${JSON.stringify(response.body)}`);
  const record = await records().findOne({ _id: inserted.insertedId });
  assert.strictEqual(record.data[STATUS], "dead", "the data changed");
  assert.strictEqual(record.history[record.history.length - 1].kind, "edited", "as a plain edit");
  assert.ok(record.updated_at >= before, "at now");
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
