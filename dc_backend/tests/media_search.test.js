const assert = require("assert");
const express = require("express");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { MongoClient, ObjectId } = require("mongodb");
const { set_db_handles } = require("../db_connection/db.js");

/**
 * The media gallery's free-text search, over HTTP against the real
 * submissions router: GET /submissions/:fg/media?search=<text> keeps
 * only the pictures of the records whose answers match the text, the
 * very match the data table applies over every field. Paging and totals
 * follow the filtered set; an empty or absent search changes nothing;
 * the viewer's zone is still read.
 */

const FORM = "media-search-form";
const NAME = "name_f";
const NOTE = "note_f";
const PHOTO = "photo_f";
const SCHEMA = {
  fields: [
    { id: NAME, type: "text", label: { en: "Name" } },
    { id: NOTE, type: "large_text", label: { en: "Note" } },
    { id: PHOTO, type: "image", label: { en: "Photo" } },
  ],
};

const photo = (name) => ({ name: `${name}.jpg`, type: "image/jpeg", size: 100, url: `https://files.example.com/${name}.jpg` });
const DAY_MS = 86400000;
const at = (days_ago) => new Date(Date.now() - days_ago * DAY_MS);

const RECORDS = [
  { _id: new ObjectId(), form_group_id: FORM, version: 1, submitted_at: at(2), data: { [NAME]: "Bob Mugisha", [NOTE]: "two pictures", [PHOTO]: [photo("bob-front"), photo("bob-back")] } },
  { _id: new ObjectId(), form_group_id: FORM, version: 1, submitted_at: at(1), data: { [NAME]: "Alice Uwase", [NOTE]: "one picture of bob's plot", [PHOTO]: [photo("alice-plot")] } },
  { _id: new ObjectId(), form_group_id: FORM, version: 1, submitted_at: at(3), data: { [NAME]: "Claude", [NOTE]: "no picture at all" } },
];

let server = null;
let client = null;
let http = null;
let base = "";

async function call(url) {
  const response = await fetch(base + url, { headers: { "x-language": "en" } });
  return { status: response.status, body: await response.json() };
}

async function run_all_tests() {
  server = await MongoMemoryServer.create();
  client = await MongoClient.connect(server.getUri());
  const db = client.db("dcs_media_search");
  set_db_handles(db, client.db("cok_test"));
  const owner_id = new ObjectId();
  const project = { _id: new ObjectId(), name: "P", created_by: owner_id.toString(), access_control_enabled: false, created_at: new Date() };
  await db.collection("dcs_projects").insertOne(project);
  await db.collection("dcs_forms").insertOne({ form_group_id: FORM, version: 1, is_active: true, form_name: "Plots", project_id: project._id.toString(), schema: SCHEMA, tracking: null, created_by: owner_id.toString(), created_at: new Date(), updated_at: new Date() });
  await db.collection("dcs_submissions").insertMany(RECORDS);

  const user = { user_id: owner_id, email: "owner@x.rw", full_name: "Olive Owner", role: "Officer", permissions: [], department_id: null };
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = user;
    req.language = "en";
    req.navigation = { links: [{ id: "dcs" }] };
    next();
  });
  app.use("/dcs/api/submissions", require("../routes/submissions/routes.js"));
  http = app.listen(0);
  base = `http://127.0.0.1:${http.address().port}/dcs/api/submissions`;

  try {
    await test_without_a_search_every_picture_comes_back();
    await test_a_search_keeps_only_the_matching_records_pictures();
    await test_paging_follows_the_filtered_set();
    await test_the_search_reads_every_answer_and_the_zone();
  } finally {
    await new Promise((resolve) => http.close(resolve));
    await client.close();
    await server.stop();
  }
}

const names_of = (body) => body.data.map((item) => item.name).sort();

/** Three pictures over two records, newest record first. */
async function test_without_a_search_every_picture_comes_back() {
  const all = await call(`/${FORM}/media`);
  assert.strictEqual(all.status, 200, `the gallery answers: ${JSON.stringify(all.body)}`);
  assert.strictEqual(all.body.total, 3, "three pictures in all");
  assert.deepStrictEqual(names_of(all.body), ["alice-plot.jpg", "bob-back.jpg", "bob-front.jpg"], "every picture");
  const blank = await call(`/${FORM}/media?search=%20%20`);
  assert.strictEqual(blank.body.total, 3, "a blank search changes nothing");
}

/** "bob" keeps Bob's two pictures - and Alice's, whose note mentions bob's plot: the match reads every answer. */
async function test_a_search_keeps_only_the_matching_records_pictures() {
  const bob = await call(`/${FORM}/media?search=bob`);
  assert.strictEqual(bob.status, 200, "the search answers");
  assert.deepStrictEqual(names_of(bob.body), ["alice-plot.jpg", "bob-back.jpg", "bob-front.jpg"], "bob is in Bob's name and in Alice's note");
  const mugisha = await call(`/${FORM}/media?search=Mugisha`);
  assert.deepStrictEqual(names_of(mugisha.body), ["bob-back.jpg", "bob-front.jpg"], "a word only Bob's record holds keeps only Bob's pictures");
  assert.strictEqual(mugisha.body.total, 2, "and the total says two");
  assert.ok(mugisha.body.data.every((item) => String(item.submission_id) === String(RECORDS[0]._id)), "both from Bob's record");
  const nobody = await call(`/${FORM}/media?search=zzz-nobody`);
  assert.strictEqual(nobody.body.total, 0, "a text nobody holds finds nothing");
  const claude = await call(`/${FORM}/media?search=claude`);
  assert.strictEqual(claude.body.total, 0, "a matching record without pictures contributes none");
}

/** Paging and totals count the filtered pictures. */
async function test_paging_follows_the_filtered_set() {
  const page_1 = await call(`/${FORM}/media?search=Mugisha&limit=1&page=1`);
  assert.strictEqual(page_1.body.total, 2, "the total is the filtered count");
  assert.strictEqual(page_1.body.data.length, 1, "one per page");
  const page_2 = await call(`/${FORM}/media?search=Mugisha&limit=1&page=2`);
  assert.strictEqual(page_2.body.data.length, 1, "the second page holds the other");
  assert.notStrictEqual(page_1.body.data[0].name, page_2.body.data[0].name, "two different pictures");
  const page_3 = await call(`/${FORM}/media?search=Mugisha&limit=1&page=3`);
  assert.strictEqual(page_3.body.data.length, 0, "and nothing beyond");
}

/** The search is case-insensitive over any answer, and tz still narrows the period. */
async function test_the_search_reads_every_answer_and_the_zone() {
  const upper = await call(`/${FORM}/media?search=ALICE`);
  assert.deepStrictEqual(names_of(upper.body), ["alice-plot.jpg"], "upper case finds Alice");
  const noted = await call(`/${FORM}/media?search=two%20pictures`);
  assert.deepStrictEqual(names_of(noted.body), ["bob-back.jpg", "bob-front.jpg"], "a phrase from the note finds its record");
  const zoned = await call(`/${FORM}/media?search=bob&period=custom&from=2000-01-01&to=2099-12-31&tz=Africa/Kigali`);
  assert.strictEqual(zoned.status, 200, "a zoned period with a search answers");
  assert.strictEqual(zoned.body.total, 3, "and keeps the same matches inside a window holding everything");
  const bad_zone = await call(`/${FORM}/media?search=bob&tz=Mars/Olympus`);
  assert.strictEqual(bad_zone.body.total, 3, "an unknown zone falls back and still searches");
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
