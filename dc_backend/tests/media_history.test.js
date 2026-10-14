const assert = require("assert");
const fs = require("fs");
const path = require("path");
const express = require("express");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { MongoClient, ObjectId } = require("mongodb");
const { set_db_handles } = require("../db_connection/db.js");
const { SUBMISSION_UPLOAD_DIR } = require("../utilities/upload.js");
const { tracking_fields_for_new } = require("../utilities/tracking.js");

/**
 * Media through the history frames, over HTTP against the real routers.
 * A photo field is an updatable field like any other: [cat] at 12:00
 * replaced by [dog] at the follow-up stores the 12:00 period [cat], the
 * new period [dog], the history change from [cat] to [dog], the data
 * [dog]; the as-of reading shows the files valid at the chosen time. No
 * update ever removes a file from disk (the older period still shows
 * cat); the public upload DELETE refuses a url any saved record refers
 * to and still removes an unreferenced temp upload; deleting the record
 * through the code-confirmed delete removes both files.
 */

const FORM = "media-history-form";
const ID = "id_f";
const PHOTO = "photo_f";
const TRACKING = { enabled: true, key_field_ids: [ID], key_field_id: ID, key_unique: true, editable_field_ids: [PHOTO] };
const SCHEMA = { fields: [{ id: ID, type: "text", label: { en: "Id" } }, { id: PHOTO, type: "image", label: { en: "Photo" } }] };

const T12 = new Date("2026-10-14T12:00:00.000Z");
const stamp = Math.random().toString(36).slice(2, 10);
const upload = (name) => ({ name: `${name}.jpg`, type: "image/jpeg", size: 3, url: `/dcs/api/uploads/submissions/mh-${stamp}-${name}.jpg` });
const CAT = upload("cat");
const DOG = upload("dog");
const TEMP = upload("temp");
const on_disk = (file) => path.join(SUBMISSION_UPLOAD_DIR, path.basename(file.url));
const exists = (file) => fs.existsSync(on_disk(file));

let server = null;
let client = null;
let db = null;
let http = null;
let base = "";
let record_id = null;

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
  db = client.db("dcs_media_history");
  set_db_handles(db, client.db("cok_test"));

  const owner_id = new ObjectId();
  const project = { _id: new ObjectId(), name: "P", created_by: owner_id.toString(), access_control_enabled: false, created_at: new Date() };
  await db.collection("dcs_projects").insertOne(project);
  await db.collection("dcs_forms").insertOne({ form_group_id: FORM, version: 1, is_active: true, form_name: "Pets", project_id: project._id.toString(), schema: SCHEMA, tracking: TRACKING, created_by: owner_id.toString(), created_at: new Date(), updated_at: new Date() });
  // The three files really exist in the uploads folder.
  [CAT, DOG, TEMP].forEach((file) => fs.writeFileSync(on_disk(file), "jpg"));
  const data = { [ID]: "pet-1", [PHOTO]: [CAT] };
  const inserted = await records().insertOne(Object.assign({ form_group_id: FORM, version: 1, submitted_at: T12, data, project_id: project._id.toString() }, tracking_fields_for_new(TRACKING, data, T12, null)));
  record_id = inserted.insertedId;

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
    await test_a_replaced_photo_lives_on_in_its_period();
    await test_the_upload_delete_refuses_a_referenced_file();
    await test_deleting_the_record_removes_its_files();
  } finally {
    [CAT, DOG, TEMP].forEach((file) => {
      try {
        fs.unlinkSync(on_disk(file));
      } catch (error) {
        // Already gone - that is what some of the checks assert.
      }
    });
    await new Promise((resolve) => http.close(resolve));
    await client.close();
    await server.stop();
  }
}

/** [cat] replaced by [dog]: periods, history and data follow the frames; both files stay on disk. */
async function test_a_replaced_photo_lives_on_in_its_period() {
  const submissions_model = require("../models/submissions_model.js");
  const updated = await call("PUT", `/public/forms/${FORM}/records/${record_id}`, { data: { [PHOTO]: [DOG] } });
  assert.strictEqual(updated.status, 200, `the follow-up succeeds: ${JSON.stringify(updated.body)}`);
  const record = await records().findOne({ _id: record_id });
  assert.deepStrictEqual(record.data[PHOTO], [DOG], "the data holds the new list");
  const periods = record.tracking_periods[PHOTO];
  assert.deepStrictEqual(periods.map((period) => period.value), [[CAT], [DOG]], "the 12:00 period still holds cat, the new one dog");
  assert.strictEqual(periods[0].from.getTime(), T12.getTime(), "cat from 12:00");
  assert.strictEqual(periods[0].to.getTime(), record.updated_at.getTime(), "until the follow-up");
  assert.strictEqual(periods[1].to, null, "dog open");
  const change = record.history[1].changes.find((entry) => entry.field_id === PHOTO);
  assert.deepStrictEqual([change.from, change.to], [[CAT], [DOG]], "the history change reads from [cat] to [dog]");
  const before = new Date(record.updated_at.getTime() - 1000);
  const row_as_of = async (end) => (await submissions_model.list_submissions(FORM, undefined, 1, 10, { start: T12, end }, { tracking: TRACKING })).items[0];
  assert.deepStrictEqual((await row_as_of(before)).data[PHOTO], [CAT], "as of a moment before the follow-up the photo is cat");
  assert.deepStrictEqual((await row_as_of(record.updated_at)).data[PHOTO], [DOG], "as of the follow-up it is dog");
  assert.ok(exists(CAT) && exists(DOG), "no update removes a file: cat and dog are both still on disk");
  const nothing = await call("PUT", `/public/forms/${FORM}/records/${record_id}`, { data: { [PHOTO]: [DOG] } });
  assert.strictEqual(nothing.status, 400, "sending the same list again is no change");
}

/** A url any saved record refers to - even only in an older period - cannot be removed; a temp upload can. */
async function test_the_upload_delete_refuses_a_referenced_file() {
  const cat = await call("DELETE", `/public/forms/${FORM}/upload`, { url: CAT.url });
  assert.strictEqual(cat.status, 409, `cat is referenced by the 12:00 period and the history: ${JSON.stringify(cat.body)}`);
  assert.strictEqual(/saved record/i.test(cat.body.message), true, "with a clear message");
  const dog = await call("DELETE", `/public/forms/${FORM}/upload`, { url: DOG.url });
  assert.strictEqual(dog.status, 409, "dog is referenced by the current answer");
  assert.ok(exists(CAT) && exists(DOG), "both files are still on disk");
  const temp = await call("DELETE", `/public/forms/${FORM}/upload`, { url: TEMP.url });
  assert.strictEqual(temp.status, 200, "an uploaded but never saved file is removed");
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.strictEqual(exists(TEMP), false, "and is gone from disk");
  const outside = await call("DELETE", `/public/forms/${FORM}/upload`, { url: "https://elsewhere.example.com/pic.jpg" });
  assert.strictEqual(outside.status, 400, "a url outside the upload folder is not ours to remove");
}

/** The code-confirmed delete of the record takes cat and dog from the disk. */
async function test_deleting_the_record_removes_its_files() {
  const requested = await call("POST", "/submissions/delete-selected/request", { submission_ids: [String(record_id)] });
  assert.strictEqual(requested.status, 200, `the delete code is issued: ${JSON.stringify(requested.body)}`);
  const { request_id, code } = requested.body.data;
  assert.ok(request_id && code, "outside production the code comes back in the response");
  const wrong = await call("POST", "/submissions/delete-selected/confirm", { request_id, code: "000000" });
  assert.strictEqual(wrong.status, 401, "a wrong code deletes nothing");
  assert.ok(exists(CAT) && exists(DOG), "and the files stay");
  const confirmed = await call("POST", "/submissions/delete-selected/confirm", { request_id, code });
  assert.strictEqual(confirmed.status, 200, `the right code deletes: ${JSON.stringify(confirmed.body)}`);
  assert.strictEqual(confirmed.body.data.deleted, 1, "one record deleted");
  assert.strictEqual(confirmed.body.data.files_removed, 2, "and its two files");
  assert.strictEqual(await records().countDocuments({ _id: record_id }), 0, "the record is gone");
  assert.strictEqual(exists(CAT) || exists(DOG), false, "cat and dog are gone from disk");
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
