const assert = require("assert");
const express = require("express");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { MongoClient, ObjectId } = require("mongodb");
const { set_db_handles } = require("../db_connection/db.js");

/**
 * Two things a follow-up change must get right, over HTTP against the
 * real public router:
 *
 * 1. A record collected BEFORE the key index (no "created" entry, no
 *    periods) gets its baseline the moment it is first updated - through
 *    the respondent update, the full edit, or the startup/lookup backfill:
 *    a "created" entry at its submission, the first period of every
 *    updatable field open since the submission, so the very first change
 *    already reads as a history and a period ending before the change
 *    reads the old value.
 * 2. Media fields are updatable: a follow-up change adds a photo, the
 *    history change carries the old and the new file lists, the periods
 *    hold the lists, and an update that does not touch the field keeps
 *    the stored files.
 */

const FORM = "baseline-form";
const ID = "id_f";
const STATUS = "status_f";
const PHOTO = "photo_f";
const DOC = "doc_f";
const VID = "vid_f";
const SIG = "sig_f";
const WHERE = "where_f";
const TRACKING = { enabled: true, key_field_ids: [ID], key_field_id: ID, key_unique: true, editable_field_ids: [STATUS, PHOTO] };
const SCHEMA = {
  fields: [
    { id: ID, type: "text", label: { en: "Id" } },
    { id: STATUS, type: "single_select", label: { en: "Status" }, options: [{ id: "o1", value: "alive", label: { en: "Alive" } }, { id: "o2", value: "dead", label: { en: "Dead" } }] },
    { id: PHOTO, type: "image", label: { en: "Photo" } },
    { id: DOC, type: "file_upload", label: { en: "Document" } },
    { id: VID, type: "video", label: { en: "Video" } },
    { id: SIG, type: "signature", label: { en: "Signature" } },
    { id: WHERE, type: "geolocation", label: { en: "Where" } },
    { id: "notice", type: "file", label: { en: "Notice" } },
  ],
};
const FILE_1 = { name: "front.jpg", type: "image/jpeg", size: 1234, url: "https://files.example.com/front.jpg" };
const FILE_2 = { name: "back.jpg", type: "image/jpeg", size: 2345, url: "https://files.example.com/back.jpg" };

const DAY_MS = 86400000;
const days_ago = (days) => new Date(Date.now() - days * DAY_MS);
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

const records = () => db.collection("dcs_submissions");
const plain_record = (id, status) => ({ form_group_id: FORM, version: 1, submitted_at: days_ago(3), data: { [ID]: id, [STATUS]: status } });

async function run_all_tests() {
  server = await MongoMemoryServer.create();
  client = await MongoClient.connect(server.getUri());
  db = client.db("dcs_follow_up_baseline");
  set_db_handles(db, client.db("cok_test"));
  await db.collection("dcs_forms").insertOne({ form_group_id: FORM, version: 1, is_active: true, form_name: "Plots", project_id: new ObjectId().toString(), schema: SCHEMA, tracking: TRACKING, created_at: new Date(), updated_at: new Date() });

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
    await test_the_first_follow_up_change_seeds_the_baseline();
    await test_the_full_edit_seeds_the_baseline_too();
    await test_the_backfill_seeds_the_baseline();
    await test_media_fields_are_updatable();
  } finally {
    await new Promise((resolve) => http.close(resolve));
    await client.close();
    await server.stop();
  }
}

/** The baseline a seeded record must carry: created at its submission, every updatable field's first period open since then. */
function check_baseline(record, status_before) {
  assert.strictEqual(record.history[0].kind, "created", "the history opens with the creation");
  assert.strictEqual(record.history[0].at.getTime(), record.submitted_at.getTime(), "dated at the submission");
  assert.strictEqual(record.history[0].by, null, "by nobody");
  assert.deepStrictEqual(record.history[0].changes, [], "with no change");
  assert.strictEqual(record.tracking_periods[STATUS][0].from.getTime(), record.submitted_at.getTime(), "the status' first period starts at the submission");
  assert.strictEqual(record.tracking_periods[STATUS][0].value, status_before, "holding the value the record had");
  assert.deepStrictEqual(record.tracking_periods[PHOTO], [{ value: null, from: record.submitted_at, to: null }], "the untouched photo field got its first period too, open, empty");
}

/** A plain record updated once through the respondent update: history [created, updated], periods chained, as-of before the change reads the old value. */
async function test_the_first_follow_up_change_seeds_the_baseline() {
  const submissions_model = require("../models/submissions_model.js");
  const inserted = await records().insertOne(plain_record("b1", "alive"));
  const updated = await call("PUT", `/forms/${FORM}/records/${inserted.insertedId}`, { data: { [STATUS]: "dead" } });
  assert.strictEqual(updated.status, 200, `the update succeeds: ${JSON.stringify(updated.body)}`);
  const record = await records().findOne({ _id: inserted.insertedId });
  assert.strictEqual(record.history.length, 2, "history: created, then updated");
  check_baseline(record, "alive");
  assert.strictEqual(record.history[1].kind, "updated", "then the update");
  assert.strictEqual(record.history[1].at.getTime(), record.updated_at.getTime(), "at the update's moment");
  assert.deepStrictEqual(record.history[1].changes, [{ field_id: STATUS, from: "alive", to: "dead" }], "with the change");
  assert.deepStrictEqual(
    record.tracking_periods[STATUS].map((period) => `${period.value}:${period.from.getTime()}-${period.to ? period.to.getTime() : "open"}`),
    [`alive:${record.submitted_at.getTime()}-${record.updated_at.getTime()}`, `dead:${record.updated_at.getTime()}-open`],
    "the old value from the submission to the change, the new value open",
  );
  assert.strictEqual(updated.body.data.history.length, 2, "the response carries both entries");
  const before = new Date(record.updated_at.getTime() - 1000);
  const rows = async (end) => (await submissions_model.list_submissions(FORM, undefined, 1, 50, { start: record.submitted_at, end }, { tracking: TRACKING })).items.find((item) => String(item._id) === String(record._id));
  const earlier = await rows(before);
  assert.strictEqual(earlier.data[STATUS], "alive", "a period ending before the change reads the old value");
  assert.strictEqual(earlier.as_of.getTime(), before.getTime(), "and says so");
  assert.strictEqual((await rows(record.updated_at)).data[STATUS], "dead", "a period holding the change reads the new one");
}

/** The staff full edit seeds the same baseline. */
async function test_the_full_edit_seeds_the_baseline_too() {
  const inserted = await records().insertOne(plain_record("b2", "alive"));
  const edited = await call("PUT", `/records/${inserted.insertedId}`, { data: { [ID]: "b2", [STATUS]: "dead" } });
  assert.strictEqual(edited.status, 200, `the full edit succeeds: ${JSON.stringify(edited.body)}`);
  const record = await records().findOne({ _id: inserted.insertedId });
  assert.strictEqual(record.history.length, 2, "history: created, then edited");
  check_baseline(record, "alive");
  assert.strictEqual(record.history[1].kind, "edited", "then the edit");
  assert.strictEqual(record.tracking_periods[STATUS].length, 2, "the status period chain has the old and the new value");
  assert.strictEqual(record.record_key, "b2", "the full edit stamps the key");
}

/** The data-based backfill (startup, a lookup miss) seeds the baseline of a record that was never updated. */
async function test_the_backfill_seeds_the_baseline() {
  const { backfill_form_key_pairs } = require("../models/tracked_records_model.js");
  const inserted = await records().insertOne(plain_record("b3", "alive"));
  assert.ok((await backfill_form_key_pairs(FORM, TRACKING)) >= 1, "the backfill stamps the record");
  const record = await records().findOne({ _id: inserted.insertedId });
  assert.strictEqual(record.history.length, 1, "history: the creation alone");
  check_baseline(record, "alive");
  assert.strictEqual(record.tracking_periods[STATUS].length, 1, "one open period per updatable field");
  assert.deepStrictEqual(record.record_key_pairs, [{ f: ID, k: "b3" }], "and the keys");
  assert.strictEqual(await backfill_form_key_pairs(FORM, TRACKING), 0, "a repeat run changes nothing");
  assert.strictEqual((await call("GET", `/forms/${FORM}/records?key=b3`)).body.data.records[0].history.length, 1, "the lookup shows the creation");
}

/** A photo added by a follow-up change: data holds both files, the history carries the lists, an update without the field keeps them. */
async function test_media_fields_are_updatable() {
  const { validate_tracking_config, NOT_EDITABLE_TYPES } = require("../utilities/tracking.js");
  const media_editable = { enabled: true, key_field_ids: [ID], key_unique: true, editable_field_ids: [PHOTO, DOC, VID, SIG] };
  assert.deepStrictEqual(validate_tracking_config(media_editable, SCHEMA), { valid: true, errors: [] }, "image, file_upload, video and signature fields may be updatable");
  assert.strictEqual(validate_tracking_config({ enabled: true, key_field_ids: [ID], key_unique: true, editable_field_ids: ["notice"] }, SCHEMA).valid, false, "the static file block may not");
  assert.strictEqual(validate_tracking_config({ enabled: true, key_field_ids: [ID], key_unique: true, editable_field_ids: [WHERE] }, SCHEMA).valid, false, "nor the location");
  assert.ok(!["image", "file_upload", "video", "signature", "audio"].some((type) => NOT_EDITABLE_TYPES.includes(type)), "no media type is excluded");

  const created = await call("POST", `/forms/${FORM}/submit`, { version: 1, data: { [ID]: "m1", [STATUS]: "alive", [PHOTO]: [FILE_1] } });
  assert.strictEqual(created.status, 201, `a record with one photo saves: ${JSON.stringify(created.body)}`);
  const id = created.body.data._id;
  const added = await call("PUT", `/forms/${FORM}/records/${id}`, { data: { [PHOTO]: [FILE_1, FILE_2] } });
  assert.strictEqual(added.status, 200, `adding a photo succeeds: ${JSON.stringify(added.body)}`);
  let record = await records().findOne({ _id: new ObjectId(id) });
  assert.strictEqual(json(record.data[PHOTO]), json([FILE_1, FILE_2]), "data holds both files");
  const change = record.history[1].changes.find((entry) => entry.field_id === PHOTO);
  assert.strictEqual(json(change.from), json([FILE_1]), "the history change says from one file");
  assert.strictEqual(json(change.to), json([FILE_1, FILE_2]), "to two");
  assert.strictEqual(json(record.tracking_periods[PHOTO].map((period) => period.value)), json([[FILE_1], [FILE_1, FILE_2]]), "the periods hold the lists");
  assert.strictEqual(record.tracking_periods[PHOTO][1].to, null, "the two-file period is open");

  const untouched = await call("PUT", `/forms/${FORM}/records/${id}`, { data: { [STATUS]: "dead" } });
  assert.strictEqual(untouched.status, 200, "a later update without the photo field succeeds");
  record = await records().findOne({ _id: new ObjectId(id) });
  assert.strictEqual(json(record.data[PHOTO]), json([FILE_1, FILE_2]), "and keeps both files");
  assert.deepStrictEqual(record.history[2].changes.map((entry) => entry.field_id), [STATUS], "only the status changed");
  assert.strictEqual(record.tracking_periods[PHOTO].length, 2, "the photo periods did not move");
  const same_again = await call("PUT", `/forms/${FORM}/records/${id}`, { data: { [PHOTO]: [FILE_1, FILE_2] } });
  assert.strictEqual(same_again.status, 400, "sending the same files again changes nothing");
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
