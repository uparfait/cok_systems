const assert = require("assert");
const express = require("express");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { MongoClient, ObjectId } = require("mongodb");
const { set_db_handles } = require("../db_connection/db.js");

/**
 * The key index of a tracked form with SEVERAL key fields, over HTTP
 * against the real public router and a real MongoDB:
 *
 *   - a form keyed on two fields (a national id and a plot number), the
 *     COMBINATION unique: a second record with the same pair is refused
 *     with 409 and a field error on both key fields;
 *   - the public lookup by one key field (?field=&key=), paged, and by
 *     any key field when no field is named; a field that is not a key is
 *     refused;
 *   - the respondent update (PUT) still works, and once a record is
 *     updated it is dated by that update: it moves into the later period
 *     in the records table and in a KPI card;
 *   - a form saved with the old single key_field_id still reads, submits
 *     and looks up, and normalises to key_field_ids.
 */

const FORM = "lookup-two-keys";
const OLD_FORM = "lookup-old-key";
const NID = "nid_f";
const PLOT = "plot_f";
const NOTE = "note_f";
const OTHER = "other_f";

const SCHEMA = {
  fields: [
    { id: NID, type: "text", label: { en: "National ID" } },
    { id: PLOT, type: "text", label: { en: "Plot number" } },
    { id: NOTE, type: "text", label: { en: "Note" } },
    { id: OTHER, type: "text", label: { en: "Other" } },
  ],
};

const TRACKING = { enabled: true, key_field_ids: [NID, PLOT], key_field_id: NID, key_unique: true, editable_field_ids: [NOTE] };
const OLD_TRACKING = { enabled: true, key_field_id: NID, key_unique: true, editable_field_ids: [NOTE] };

const DAY_MS = 86400000;
const days_ago = (days) => new Date(Date.now() - days * DAY_MS);

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

const submit = (form, data) => call("POST", `/forms/${form}/submit`, { version: 1, data });

async function run_all_tests() {
  server = await MongoMemoryServer.create();
  client = await MongoClient.connect(server.getUri());
  db = client.db("dcs_lookup_test");
  set_db_handles(db, client.db("cok_test"));
  await require("../models/tracked_records_model.js").ensure_tracked_record_indexes();

  const form_doc = (form_group_id, tracking) => ({
    form_group_id,
    version: 1,
    is_active: true,
    form_name: "Plots",
    project_id: new ObjectId().toString(),
    schema: SCHEMA,
    tracking,
    created_at: new Date(),
    updated_at: new Date(),
  });
  await db.collection("dcs_forms").insertMany([form_doc(FORM, TRACKING), form_doc(OLD_FORM, OLD_TRACKING)]);

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
    await test_submit_stamps_the_composite_key_and_its_pairs();
    await test_a_duplicate_combination_is_refused_on_both_keys();
    await test_lookup_by_each_key_field_with_paging();
    await test_lookup_without_field_matches_either_key();
    await test_lookup_by_a_non_key_field_is_refused();
    await test_an_update_moves_the_record_into_the_later_period();
    await test_the_old_single_key_config_still_works();
    await test_records_without_pairs_are_backfilled_at_startup();
  } finally {
    await new Promise((resolve) => http.close(resolve));
    await client.close();
    await server.stop();
  }
}

/** The first record: its key is both values joined, its pairs one per key field. */
async function test_submit_stamps_the_composite_key_and_its_pairs() {
  const created = await submit(FORM, { [NID]: " ID-001 ", [PLOT]: "P-7", [NOTE]: "first" });
  assert.strictEqual(created.status, 201, `submit must succeed: ${JSON.stringify(created.body)}`);
  const stored = await db.collection("dcs_submissions").findOne({ form_group_id: FORM });
  assert.strictEqual(stored.record_key, "id-001|p-7", "the whole key is both values, normalised, joined with |");
  assert.deepStrictEqual(stored.record_key_pairs, [{ f: NID, k: "id-001" }, { f: PLOT, k: "p-7" }], "one searchable pair per key field, in key order");
  assert.strictEqual(stored.updated_at, null, "a new record has no update yet");
}

/** The same pair again is refused, and every key field is marked. */
async function test_a_duplicate_combination_is_refused_on_both_keys() {
  const again = await submit(FORM, { [NID]: "id-001", [PLOT]: " p-7", [NOTE]: "again" });
  assert.strictEqual(again.status, 409, `a duplicate combination is a 409: ${JSON.stringify(again.body)}`);
  assert.strictEqual(again.body.record_key, "id-001|p-7", "the refused key is reported");
  assert.deepStrictEqual(Object.keys(again.body.field_errors).sort(), [NID, PLOT].sort(), "both key fields carry the error");
  assert.strictEqual(/National ID \/ Plot number/.test(again.body.field_errors[NID][0]), true, `the message names the key fields: ${again.body.field_errors[NID][0]}`);

  // Only half the pair in common is a different combination: allowed.
  const other_plot = await submit(FORM, { [NID]: "id-001", [PLOT]: "P-8", [NOTE]: "other plot" });
  assert.strictEqual(other_plot.status, 201, "the same id on another plot is a new record");
  assert.strictEqual(await db.collection("dcs_submissions").countDocuments({ form_group_id: FORM }), 2, "two records so far");
}

/** 25 records on one id: page 1 holds 20, page 2 holds 5. */
async function test_lookup_by_each_key_field_with_paging() {
  // 23 more plots for ID-001, making 25 records that share the id.
  for (let index = 9; index < 32; index += 1) {
    const created = await submit(FORM, { [NID]: "ID-001", [PLOT]: `P-${index}`, [NOTE]: `plot ${index}` });
    assert.strictEqual(created.status, 201, `record ${index} must save`);
  }
  const page_1 = await call("GET", `/forms/${FORM}/records?field=${NID}&key=${encodeURIComponent(" Id-001 ")}`);
  assert.strictEqual(page_1.status, 200, `lookup by the id must succeed: ${JSON.stringify(page_1.body)}`);
  const data_1 = page_1.body.data;
  assert.strictEqual(data_1.key, "id-001", "the typed key comes back normalised");
  assert.strictEqual(data_1.field_id, NID, "the field searched comes back");
  assert.deepStrictEqual(data_1.key_field_ids, [NID, PLOT], "the key fields come back in order");
  assert.deepStrictEqual(data_1.editable_field_ids, [NOTE], "the updatable fields come back");
  assert.strictEqual(data_1.total, 25, "25 records share the id");
  assert.strictEqual(data_1.pages, 2, "20 per page makes 2 pages");
  assert.strictEqual(data_1.page, 1, "page 1 by default");
  assert.strictEqual(data_1.records.length, 20, "page 1 holds 20 records");
  assert.strictEqual("approval" in data_1.records[0], false, "a public record carries no approval state");
  assert.ok(Array.isArray(data_1.records[0].history), "each record carries its history");

  const page_2 = await call("GET", `/forms/${FORM}/records?field=${NID}&key=id-001&page=2&limit=20`);
  assert.strictEqual(page_2.body.data.records.length, 5, "page 2 holds the remaining 5");
  const ids_1 = data_1.records.map((record) => String(record._id));
  const ids_2 = page_2.body.data.records.map((record) => String(record._id));
  assert.strictEqual(new Set(ids_1.concat(ids_2)).size, 25, "the two pages do not overlap");
  assert.ok(new Date(ids_1[0] && data_1.records[0].submitted_at) >= new Date(data_1.records[19].submitted_at), "newest first");

  const capped = await call("GET", `/forms/${FORM}/records?field=${NID}&key=id-001&limit=500`);
  assert.strictEqual(capped.body.data.records.length, 25, "limit is capped at 50, so 25 fit on one page");
  assert.strictEqual(capped.body.data.pages, 1, "one page at the cap");

  const by_plot = await call("GET", `/forms/${FORM}/records?field=${PLOT}&key=p-7`);
  assert.strictEqual(by_plot.body.data.total, 1, "one record holds plot P-7");
  assert.strictEqual(by_plot.body.data.records[0].data[PLOT], "P-7", "and it is that record, with its raw answers");
  assert.strictEqual(by_plot.body.data.field_id, PLOT, "the field searched is the plot");

  const empty = await call("GET", `/forms/${FORM}/records?field=${PLOT}&key=nowhere`);
  assert.strictEqual(empty.body.data.total, 0, "an unknown plot finds nothing");
  assert.strictEqual(empty.body.data.pages, 1, "and still reports one (empty) page");
}

/** Without ?field the value is matched on any key field. */
async function test_lookup_without_field_matches_either_key() {
  const by_id = await call("GET", `/forms/${FORM}/records?key=ID-001`);
  assert.strictEqual(by_id.status, 200, "lookup without a field must succeed");
  assert.strictEqual(by_id.body.data.field_id, null, "no field was named");
  assert.strictEqual(by_id.body.data.total, 25, "the id matches through the id field");
  const by_plot = await call("GET", `/forms/${FORM}/records?key=P-8`);
  assert.strictEqual(by_plot.body.data.total, 1, "the plot matches through the plot field");
  const blank = await call("GET", `/forms/${FORM}/records?key=%20%20`);
  assert.strictEqual(blank.status, 400, "a blank key is refused");
  assert.strictEqual(/key/i.test(blank.body.message), true, "with the key-required message");
}

/** A field that is not a key cannot be searched. */
async function test_lookup_by_a_non_key_field_is_refused() {
  const refused = await call("GET", `/forms/${FORM}/records?field=${NOTE}&key=first`);
  assert.strictEqual(refused.status, 400, "a non-key field is a 400");
  assert.strictEqual(/key fields: nid_f, plot_f/.test(refused.body.detail || ""), true, `the detail names the key fields: ${JSON.stringify(refused.body)}`);
  assert.deepStrictEqual(refused.body.key_field_ids, [NID, PLOT], "and lists them");
  const untracked = await db.collection("dcs_forms").insertOne(Object.assign({}, { form_group_id: "plain-form", version: 1, is_active: true, form_name: "Plain", schema: SCHEMA, tracking: null }));
  void untracked;
  const not_tracked = await call("GET", `/forms/plain-form/records?key=x`);
  assert.strictEqual(not_tracked.status, 400, "an untracked form has no lookup");
  assert.strictEqual(/track/i.test(not_tracked.body.message), true, "with the not-enabled message");
}

/** After a PUT the record is dated by its update: it leaves the old period and enters the new one. */
async function test_an_update_moves_the_record_into_the_later_period() {
  const submissions_model = require("../models/submissions_model.js");
  const { compute_widget_data } = require("../util-dashboard/widget_data.js");
  const form_version = await db.collection("dcs_forms").findOne({ form_group_id: FORM });

  // The P-7 record is made to look ten days old; the others stay today.
  const record = await db.collection("dcs_submissions").findOne({ form_group_id: FORM, record_key: "id-001|p-7" });
  await db.collection("dcs_submissions").updateOne({ _id: record._id }, { $set: { submitted_at: days_ago(10) } });

  const old_window = { start: days_ago(15), end: days_ago(5) };
  const recent_window = { start: days_ago(2), end: new Date(Date.now() + DAY_MS) };
  const list = (bounds) => submissions_model.list_submissions(FORM, undefined, 1, 100, bounds, { tracking: TRACKING });
  const kpi = async (bounds) => {
    const widget = { form_group_id: FORM, chart_type: "kpi", metric: { aggregation: "count" }, filters: [], period: { preset: "custom", from: bounds.start.toISOString(), to: bounds.end.toISOString() } };
    return (await compute_widget_data(widget, form_version, null)).value;
  };

  assert.strictEqual((await list(old_window)).total, 1, "before the update, the old window lists the ten-day-old record");
  assert.strictEqual((await list(recent_window)).total, 24, "and the recent window lists the other 24");
  assert.strictEqual(await kpi(old_window), 1, "a KPI over the old window counts it");
  assert.strictEqual(await kpi(recent_window), 24, "a KPI over the recent window counts the others");

  const no_change = await call("PUT", `/forms/${FORM}/records/${record._id}`, { data: { [NOTE]: "first" } });
  assert.strictEqual(no_change.status, 400, "an update that changes nothing is refused");
  const locked = await call("PUT", `/forms/${FORM}/records/${record._id}`, { data: { [NOTE]: "revised", [PLOT]: "P-999" } });
  assert.strictEqual(locked.status, 200, `the update must succeed: ${JSON.stringify(locked.body)}`);
  assert.strictEqual(locked.body.data.data[NOTE], "revised", "the updatable field changed");
  assert.strictEqual(locked.body.data.data[PLOT], "P-7", "a key field cannot be changed by a respondent update");
  assert.ok(locked.body.data.updated_at, "the record now carries its update time");
  assert.strictEqual(locked.body.data.history.length, 2, "created, then updated");

  const rows = await list(recent_window);
  assert.strictEqual(rows.total, 25, "after the update, the recent window lists the updated record too");
  const row = rows.items.find((item) => String(item._id) === String(record._id));
  assert.ok(row, "the updated record is in the recent window");
  assert.strictEqual(row.data[NOTE], "revised", "with its current answers");
  assert.strictEqual((await list(old_window)).total, 0, "and it has left the old window: it is dated by its last move");
  assert.strictEqual(await kpi(recent_window), 25, "the recent KPI counts it now");
  assert.strictEqual(await kpi(old_window), 0, "the old KPI no longer does");
  assert.strictEqual(rows.items.filter((item) => String(item._id) === String(record._id)).length, 1, "and it is one row, not one per change");

  const looked_up = await call("GET", `/forms/${FORM}/records?field=${PLOT}&key=P-7`);
  assert.strictEqual(looked_up.body.data.records[0].data[NOTE], "revised", "the lookup returns the updated answers");
  assert.strictEqual(looked_up.body.data.records[0].history.length, 2, "with the whole history");
}

/** A form saved with key_field_id alone still works everywhere, and normalises to a list. */
async function test_the_old_single_key_config_still_works() {
  const { normalize_tracking_config, validate_tracking_config, key_ids_of, composite_record_key } = require("../utilities/tracking.js");
  assert.deepStrictEqual(validate_tracking_config(OLD_TRACKING, SCHEMA), { valid: true, errors: [] }, "the old shape validates");
  assert.deepStrictEqual(
    normalize_tracking_config(OLD_TRACKING),
    { enabled: true, key_field_ids: [NID], key_field_id: NID, key_unique: true, editable_field_ids: [NOTE] },
    "and normalises to key_field_ids of one, key_field_id kept",
  );
  assert.deepStrictEqual(key_ids_of(OLD_TRACKING), [NID], "its key ids are read as a list of one");
  assert.strictEqual(composite_record_key(OLD_TRACKING, { [NID]: " X-1 " }), "x-1", "one key gives the plain normalised value, no joiner");
  const too_many = Object.assign({}, TRACKING, { key_field_ids: [NID, PLOT, NOTE, OTHER, "a", "b"] });
  assert.strictEqual(validate_tracking_config(too_many, SCHEMA).valid, false, "more than five keys is refused");
  const key_editable = Object.assign({}, TRACKING, { editable_field_ids: [PLOT] });
  assert.strictEqual(validate_tracking_config(key_editable, SCHEMA).valid, false, "a key field cannot be updatable");

  const public_form = await call("GET", `/forms/${OLD_FORM}`);
  assert.deepStrictEqual(public_form.body.data.tracking.key_field_ids, [NID], "the public form sends key_field_ids even for an old config");

  const first = await submit(OLD_FORM, { [NID]: "Old-1", [NOTE]: "a" });
  assert.strictEqual(first.status, 201, "a submit on the old config saves");
  const stored = await db.collection("dcs_submissions").findOne({ form_group_id: OLD_FORM });
  assert.strictEqual(stored.record_key, "old-1", "its key is the single value");
  assert.deepStrictEqual(stored.record_key_pairs, [{ f: NID, k: "old-1" }], "and it carries one pair");
  const duplicate = await submit(OLD_FORM, { [NID]: "OLD-1", [NOTE]: "b" });
  assert.strictEqual(duplicate.status, 409, "the single key is still unique");
  assert.deepStrictEqual(Object.keys(duplicate.body.field_errors), [NID], "with the error on the one key field");
  const found = await call("GET", `/forms/${OLD_FORM}/records?key=old-1`);
  assert.strictEqual(found.body.data.total, 1, "the lookup finds it without a field");
  assert.deepStrictEqual(found.body.data.key_field_ids, [NID], "and reports the one key field");
  const by_field = await call("GET", `/forms/${OLD_FORM}/records?field=${NID}&key=old-1`);
  assert.strictEqual(by_field.body.data.total, 1, "and with the field named");
}

/** Records collected before the key index carry record_key alone; the startup backfill derives their pairs. */
async function test_records_without_pairs_are_backfilled_at_startup() {
  const { backfill_record_key_pairs } = require("../models/tracked_records_model.js");
  const legacy = (form_group_id, record_key, data) => ({ form_group_id, version: 1, record_key, data, submitted_at: days_ago(30), history: [] });
  await db.collection("dcs_submissions").insertMany([
    legacy(OLD_FORM, "legacy-9", { [NID]: "Legacy-9", [NOTE]: "old" }),
    legacy(FORM, "id-777|p-1", { [NID]: "ID-777", [PLOT]: "P-1" }),
    legacy(FORM, "id-778|", { [NID]: "ID-778" }),
  ]);
  assert.strictEqual((await call("GET", `/forms/${OLD_FORM}/records?key=legacy-9`)).body.data.total, 0, "without pairs the lookup cannot see the old record");

  assert.strictEqual(await backfill_record_key_pairs(), 3, "the three records missing their pairs are stamped");
  assert.strictEqual(await backfill_record_key_pairs(), 0, "and a second run has nothing left to do");

  assert.strictEqual((await call("GET", `/forms/${OLD_FORM}/records?key=legacy-9`)).body.data.total, 1, "a single-key record is found by its whole key");
  const two_keys = await db.collection("dcs_submissions").findOne({ form_group_id: FORM, record_key: "id-777|p-1" });
  assert.deepStrictEqual(two_keys.record_key_pairs, [{ f: NID, k: "id-777" }, { f: PLOT, k: "p-1" }], "a two-key record's key is split back into its fields");
  assert.strictEqual((await call("GET", `/forms/${FORM}/records?field=${PLOT}&key=P-1`)).body.data.total, 1, "and it is found by its second key");
  const half = await db.collection("dcs_submissions").findOne({ form_group_id: FORM, record_key: "id-778|" });
  assert.deepStrictEqual(half.record_key_pairs, [{ f: NID, k: "id-778" }], "an unanswered key field makes no pair");
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
