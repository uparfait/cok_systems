const assert = require("assert");
const express = require("express");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { MongoClient, ObjectId } = require("mongodb");
const { set_db_handles } = require("../db_connection/db.js");

/**
 * The key index of a tracked form with SEVERAL key fields, over HTTP
 * against the real public router and a real MongoDB: the COMBINATION of
 * the keys is unique (409 with a field error on every key), the public
 * lookup is a search by any key field or one named field, paged; the
 * respondent update (PUT) still works and a period reads the record as it
 * was at the period's end; the old single key_field_id config still works
 * and normalises to key_field_ids.
 */

const FORM = "lookup-two-keys";
const OLD_FORM = "lookup-old-key";
const NUM_FORM = "lookup-number-keys";
const SEARCH_FORM = "lookup-search";
const NID = "nid_f";
const PLOT = "plot_f";
const NOTE = "note_f";
const OTHER = "other_f";
const NUM = "num_f";
const BIG = "big_f";

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

// A form keyed on a number and a textarea.
const NUM_SCHEMA = {
  fields: [
    { id: NUM, type: "number", label: { en: "Household number" } },
    { id: BIG, type: "large_text", label: { en: "Description" } },
    { id: NOTE, type: "text", label: { en: "Note" } },
  ],
};
const NUM_TRACKING = { enabled: true, key_field_ids: [NUM, BIG], key_field_id: NUM, key_unique: false, editable_field_ids: [NOTE] };
const SEARCH_TRACKING = { enabled: true, key_field_ids: [NID], key_field_id: NID, key_unique: false, editable_field_ids: [NOTE] };

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

  const form_doc = (form_group_id, tracking, schema) => ({
    form_group_id,
    version: 1,
    is_active: true,
    form_name: "Plots",
    project_id: new ObjectId().toString(),
    schema: schema || SCHEMA,
    tracking,
    created_at: new Date(),
    updated_at: new Date(),
  });
  await db.collection("dcs_forms").insertMany([form_doc(FORM, TRACKING), form_doc(OLD_FORM, OLD_TRACKING), form_doc(NUM_FORM, NUM_TRACKING, NUM_SCHEMA), form_doc(SEARCH_FORM, SEARCH_TRACKING)]);

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
    await test_any_key_field_matches_and_a_record_comes_back_once();
    await test_number_and_large_text_keys_are_searchable();
    await test_a_legacy_record_is_found_and_stamped_by_the_lookup();
    await test_any_number_of_key_fields_is_accepted();
    await test_a_record_without_any_tracking_fields_is_found_by_its_answers();
    await test_a_record_whose_pairs_are_wrong_is_found_by_its_answers();
    await test_changing_the_key_fields_makes_records_findable_by_the_new_field();
    await test_the_lookup_is_a_search_ordered_by_closeness();
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
  assert.strictEqual(stored.record_key_fields, `${NID}|${PLOT}`, "and the marker of the key fields the pairs were built for");
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
  // Back-dated whole: its submission, the opening of its first period and its "created" entry are its creation moment.
  await db.collection("dcs_submissions").updateOne({ _id: record._id }, { $set: { submitted_at: days_ago(10), [`tracking_periods.${NOTE}.0.from`]: days_ago(10), "history.0.at": days_ago(10) } });

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
  assert.strictEqual(rows.total, 25, "after the update, the recent window lists the updated record too: it changed inside it");
  const row = rows.items.find((item) => String(item._id) === String(record._id));
  assert.ok(row, "the updated record is in the recent window");
  assert.strictEqual(row.data[NOTE], "revised", "with its current answers - the window ends in the future, nothing to rewrite");
  assert.strictEqual(row.as_of, undefined, "so the row carries no as_of");
  const old_rows = await list(old_window);
  assert.strictEqual(old_rows.total, 1, "it still belongs to the old window, where it was created");
  assert.strictEqual(old_rows.items[0].data[NOTE], "first", "read as it was at the old window's end: the note before the update");
  assert.strictEqual(old_rows.items[0].as_of.getTime(), old_window.end.getTime(), "and the row says what moment it reads as of");
  assert.strictEqual(await kpi(recent_window), 25, "the recent KPI counts it now");
  assert.strictEqual(await kpi(old_window), 1, "and the old KPI still counts it, as it was then");
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
  await db.collection("dcs_submissions").insertMany([
    legacy(OLD_FORM, "legacy-9", { [NID]: "Legacy-9", [NOTE]: "old" }),
    legacy(FORM, "id-777|p-q1", { [NID]: "ID-777", [PLOT]: "P-q1" }),
    legacy(FORM, "id-778|", { [NID]: "ID-778" }),
  ]);
  // The lookup sees a legacy row through its record_key and stamps that form; the other form waits for the startup pass.
  assert.strictEqual((await call("GET", `/forms/${OLD_FORM}/records?key=legacy-9`)).body.data.total, 1, "even without pairs the lookup finds the old record");
  assert.strictEqual(await backfill_record_key_pairs(), 2, "the startup pass stamps the two-key form's rows the lookup never touched");
  assert.strictEqual(await backfill_record_key_pairs(), 0, "and a second run has nothing left to do");

  assert.strictEqual((await call("GET", `/forms/${OLD_FORM}/records?key=legacy-9`)).body.data.total, 1, "a single-key record is found by its whole key");
  const two_keys = await db.collection("dcs_submissions").findOne({ form_group_id: FORM, record_key: "id-777|p-q1" });
  assert.deepStrictEqual(two_keys.record_key_pairs, [{ f: NID, k: "id-777" }, { f: PLOT, k: "p-q1" }], "a two-key record's key is split back into its fields");
  assert.strictEqual((await call("GET", `/forms/${FORM}/records?field=${PLOT}&key=P-q1`)).body.data.total, 1, "and it is found by its second key");
  const half = await db.collection("dcs_submissions").findOne({ form_group_id: FORM, record_key: "id-778|" });
  assert.deepStrictEqual(half.record_key_pairs, [{ f: NID, k: "id-778" }], "an unanswered key field makes no pair");
}

/** A row written before the pairs existed: record_key alone, no pairs, no marker. */
const legacy = (form_group_id, record_key, data) => ({ form_group_id, version: 1, record_key, data, submitted_at: days_ago(30), history: [] });

const lookup = async (form, key, field, paging) => {
  const page = paging && paging.page ? `&page=${paging.page}` : "";
  const limit = paging && paging.limit ? `&limit=${paging.limit}` : "";
  return (await call("GET", `/forms/${form}/records?key=${encodeURIComponent(key)}${field ? `&field=${field}` : ""}${page}${limit}`)).body.data;
};

/** The normal call names no field: any key field holding the value matches, and a record comes back once. */
async function test_any_key_field_matches_and_a_record_comes_back_once() {
  const second_only = await lookup(FORM, "P-8");
  assert.strictEqual(second_only.total, 1, "a value held by the second key field alone is found without naming a field");
  assert.strictEqual(second_only.records[0].data[PLOT], "P-8", "and it is that record");
  assert.strictEqual(second_only.field_id, null, "no field was named");

  const both = await submit(FORM, { [NID]: "Same-1", [PLOT]: "same-1", [NOTE]: "twice" });
  assert.strictEqual(both.status, 201, "a record may hold the same value on both keys");
  const once = await lookup(FORM, "SAME-1");
  assert.strictEqual(once.total, 1, "a value held by both key fields returns the record once");
  assert.strictEqual(once.records.length, 1, "one row, not one per matching key");

  const pio = await submit(FORM, { [NID]: "pio", [PLOT]: "Z-1", [NOTE]: "name" });
  assert.strictEqual(pio.status, 201, "a lowercase name saves");
  assert.strictEqual((await lookup(FORM, "Pio")).total, 1, '"Pio" finds "pio"');
  assert.strictEqual((await lookup(FORM, " PIO ")).total, 1, "and so does an upper-case, padded spelling");
  assert.strictEqual((await lookup(FORM, "pio", NID)).total, 1, "narrowed to the id field it is still found");
  assert.strictEqual((await lookup(FORM, "pio", PLOT)).total, 0, "narrowed to the plot field it is not: the value sits on the id");
}

/** A number key reads the same however it is typed; a textarea key is searchable. */
async function test_number_and_large_text_keys_are_searchable() {
  const created = await submit(NUM_FORM, { [NUM]: 12, [BIG]: "A long story about a plot", [NOTE]: "n" });
  assert.strictEqual(created.status, 201, `a number and a textarea can be keys: ${JSON.stringify(created.body)}`);
  const stored = await db.collection("dcs_submissions").findOne({ form_group_id: NUM_FORM });
  assert.strictEqual(stored.record_key, "12|a long story about a plot", "the stored key is the canonical number and the lowercased text");
  assert.strictEqual((await lookup(NUM_FORM, "12")).total, 1, "12 finds the record");
  assert.strictEqual((await lookup(NUM_FORM, " 12.0 ")).total, 1, '"12.0" with spaces finds the stored 12');
  assert.strictEqual((await lookup(NUM_FORM, "12.00")).total, 1, '"12.00" finds it too');
  assert.strictEqual((await lookup(NUM_FORM, "120")).total, 0, "120 finds nothing: no key contains 120");
  assert.strictEqual((await lookup(NUM_FORM, "A LONG STORY ABOUT A PLOT")).total, 1, "the textarea key matches whatever the case");
  assert.strictEqual((await lookup(NUM_FORM, "story")).total, 1, "a word of it finds it too: the lookup is a search");
  const spaced = await submit(NUM_FORM, { [NUM]: 1234, [BIG]: "b", [NOTE]: "n" });
  assert.strictEqual(spaced.status, 201, "another household saves");
  assert.strictEqual((await lookup(NUM_FORM, "1 234")).total, 1, "a number typed with a space inside finds the stored 1234");
  assert.strictEqual((await lookup(NUM_FORM, "1234", BIG)).total, 0, "narrowed to the textarea the number is not there");
  const twelve = await lookup(NUM_FORM, "12");
  assert.strictEqual(twelve.total, 2, '"12" now also lists 1234, which contains it');
  assert.strictEqual(twelve.records[0].data[NUM], 12, "the exact match is listed first");
  assert.strictEqual(twelve.records[1].data[NUM], 1234, "the one that merely contains it after");
}

/** A row carrying record_key alone (no pairs) is found by the lookup, which stamps its pairs on the way. */
async function test_a_legacy_record_is_found_and_stamped_by_the_lookup() {
  await db.collection("dcs_submissions").insertMany([
    legacy(OLD_FORM, "lazy-1", { [NID]: "Lazy-1", [NOTE]: "old" }),
    legacy(FORM, "id-900|p-900", { [NID]: "ID-900", [PLOT]: "P-900" }),
  ]);
  const found = await lookup(OLD_FORM, "Lazy-1");
  assert.strictEqual(found.total, 1, "a single-key legacy row is found through its record_key");
  const stamped = await db.collection("dcs_submissions").findOne({ form_group_id: OLD_FORM, record_key: "lazy-1" });
  assert.deepStrictEqual(stamped.record_key_pairs, [{ f: NID, k: "lazy-1" }], "and the lookup stamped its pairs");

  const by_second_key = await lookup(FORM, "p-900");
  assert.strictEqual(by_second_key.total, 1, "a two-key legacy row is found by its second key: the lookup stamps the form's rows and reads again");
  const two = await db.collection("dcs_submissions").findOne({ form_group_id: FORM, record_key: "id-900|p-900" });
  assert.deepStrictEqual(two.record_key_pairs, [{ f: NID, k: "id-900" }, { f: PLOT, k: "p-900" }], "with both pairs");
  assert.strictEqual((await lookup(FORM, "id-900")).total, 1, "and by its first key");
}

/** Any count of key fields is accepted, and every allowed type. */
async function test_any_number_of_key_fields_is_accepted() {
  const { validate_tracking_config, normalize_tracking_config, KEY_FIELD_TYPES } = require("../utilities/tracking.js");
  const ids = ["k1", "k2", "k3", "k4", "k5", "k6"];
  const types = ["text", "large_text", "number", "email", "phone", "date"];
  const schema = { fields: ids.map((id, index) => ({ id, type: types[index], label: { en: id } })).concat([{ id: "doc", type: "file", label: { en: "Doc" } }]) };
  const six = { enabled: true, key_field_ids: ids, key_unique: true, editable_field_ids: [] };
  assert.deepStrictEqual(validate_tracking_config(six, schema), { valid: true, errors: [] }, "six key fields are valid");
  assert.deepStrictEqual(normalize_tracking_config(six).key_field_ids, ids, "and are kept in order");
  assert.strictEqual(normalize_tracking_config(six).key_field_id, "k1", "key_field_id is the first");
  assert.strictEqual(KEY_FIELD_TYPES.includes("large_text"), true, "a textarea may be a key");
  const file_key = { enabled: true, key_field_ids: ["doc"], key_unique: false, editable_field_ids: [] };
  assert.strictEqual(validate_tracking_config(file_key, schema).valid, false, "a file cannot be a key");
}

/** The user's case: a record collected before tracking existed - answers only, no key, no pairs - found by its first name. */
async function test_a_record_without_any_tracking_fields_is_found_by_its_answers() {
  const { count_by_key_pair } = require("../models/tracked_records_model.js");
  const plain = { form_group_id: FORM, version: 1, data: { [NID]: "center bridge health", [PLOT]: "P-cb", [NOTE]: "plain" }, submitted_at: days_ago(60) };
  const inserted = await db.collection("dcs_submissions").insertOne(plain);
  const found = await lookup(FORM, "  Center Bridge Health  ");
  assert.strictEqual(found.total, 1, "the record is found by its first name, whatever the case and the spaces around");
  assert.strictEqual(String(found.records[0]._id), String(inserted.insertedId), "and it is that record");
  const stamped = await db.collection("dcs_submissions").findOne({ _id: inserted.insertedId });
  assert.strictEqual(stamped.record_key, "center bridge health|p-cb", "the lookup stamped its whole key from its answers");
  assert.deepStrictEqual(stamped.record_key_pairs, [{ f: NID, k: "center bridge health" }, { f: PLOT, k: "p-cb" }], "and its pairs");
  assert.strictEqual(stamped.record_key_fields, `${NID}|${PLOT}`, "and the marker");
  assert.strictEqual(await count_by_key_pair(FORM, [NID, PLOT], "center bridge health", false), 1, "so the pairs path alone finds it from now on");
  assert.strictEqual((await lookup(FORM, "CENTER BRIDGE HEALTH")).total, 1, "upper case finds it again");
  assert.strictEqual((await lookup(FORM, "p-cb", PLOT)).total, 1, "and so does its plot, narrowed to the plot field");
  assert.strictEqual((await lookup(FORM, "center bridge")).total, 1, "a part of the name finds it too: the lookup is a search");
}

/** A record stamped for the current keys but with pairs that do not say what its answers say is still found, and corrected. */
async function test_a_record_whose_pairs_are_wrong_is_found_by_its_answers() {
  const { count_by_key_pair } = require("../models/tracked_records_model.js");
  const wrong = Object.assign(legacy(FORM, "stale", { [NID]: "Regex-Only", [PLOT]: "P-ro", [NOTE]: "wrong pairs" }), {
    record_key_pairs: [{ f: NID, k: "stale" }],
    record_key_fields: `${NID}|${PLOT}`,
  });
  const inserted = await db.collection("dcs_submissions").insertOne(wrong);
  assert.strictEqual(await count_by_key_pair(FORM, [NID, PLOT], "regex-only", true), 0, "neither the pairs nor the whole key hold the value");
  const found = await lookup(FORM, "regex-only");
  assert.strictEqual(found.total, 1, "the answers themselves are read as the last resort");
  assert.strictEqual(String(found.records[0]._id), String(inserted.insertedId), "and the right record comes back");
  assert.strictEqual(await count_by_key_pair(FORM, [NID, PLOT], "regex-only", false), 1, "and it was re-stamped from its answers on the way");
  assert.strictEqual((await db.collection("dcs_submissions").findOne({ _id: inserted.insertedId })).record_key, "regex-only|p-ro", "whole key included");
}

/** Switching the form's key fields makes every record findable by the new field. */
async function test_changing_the_key_fields_makes_records_findable_by_the_new_field() {
  const { backfill_form_key_pairs } = require("../models/tracked_records_model.js");
  const next = { enabled: true, key_field_ids: [NOTE], key_field_id: NOTE, key_unique: false, editable_field_ids: [OTHER] };
  await db.collection("dcs_forms").updateOne({ form_group_id: FORM }, { $set: { tracking: next } });

  // The lookup alone copes: the first miss re-stamps the form's records for the new key.
  const found = await lookup(FORM, "Plain");
  assert.strictEqual(found.total, 1, "a note value finds its record once the note is the key");
  assert.deepStrictEqual(found.key_field_ids, [NOTE], "the lookup reports the new key field");
  const stamped = await db.collection("dcs_submissions").findOne({ form_group_id: FORM, "data.note_f": "plain" });
  assert.strictEqual(stamped.record_key, "plain", "the whole key is now the note");
  assert.deepStrictEqual(stamped.record_key_pairs, [{ f: NOTE, k: "plain" }], "the pairs are built for the new key");
  assert.strictEqual(stamped.record_key_fields, NOTE, "and the marker says so");
  assert.strictEqual(await backfill_form_key_pairs(FORM, next), 0, "every record of the form is current: a repeat run changes nothing");
  assert.strictEqual((await lookup(FORM, "center bridge health")).total, 0, "the old key field is no longer searched");
  assert.strictEqual((await lookup(FORM, "revised")).total, 1, "a note set by an earlier update is found too");
}

/** Typing "a" lists every record with an a in a key value: exact matches first, then "starts with", then the rest, newest first in each group; paging holds. */
async function test_the_lookup_is_a_search_ordered_by_closeness() {
  // Collected before tracking (answers only); oldest first in this order.
  const names = ["a", "Alpha", "banana", "Beta", "Gamma", "zoo"];
  await db.collection("dcs_submissions").insertMany(
    names.map((name, index) => ({ form_group_id: SEARCH_FORM, version: 1, data: { [NID]: name, [NOTE]: "n" }, submitted_at: days_ago(10 - index) })),
  );
  const page_of = async (page) => {
    const data = await lookup(SEARCH_FORM, "A", null, { page, limit: 2 });
    assert.strictEqual(data.total, 5, '"a" matches every record with an a in its key, and zoo is not one');
    assert.strictEqual(data.pages, 3, "two per page makes three pages");
    assert.strictEqual(data.page, page, "the asked page comes back");
    return data.records.map((record) => record.data[NID]);
  };
  assert.deepStrictEqual(await page_of(1), ["a", "Alpha"], "the exact match first, then the value starting with a");
  assert.deepStrictEqual(await page_of(2), ["Gamma", "Beta"], "then the rest, newest first");
  assert.deepStrictEqual(await page_of(3), ["banana"], "the oldest of the rest closes the list");
  const stamped = await db.collection("dcs_submissions").countDocuments({ form_group_id: SEARCH_FORM, record_key_fields: NID });
  assert.strictEqual(stamped, 6, "the first search stamped every record of the form");
  assert.strictEqual((await lookup(SEARCH_FORM, "an")).records.map((record) => record.data[NID]).join(","), "banana", '"an" is only in banana');
  assert.strictEqual((await lookup(SEARCH_FORM, "ZO")).total, 1, "a prefix in another case finds zoo");
  assert.strictEqual((await lookup(SEARCH_FORM, "q")).total, 0, "a letter no key holds finds nothing");
  assert.strictEqual((await lookup(SEARCH_FORM, "a", NID)).total, 5, "narrowed to the key field the search is the same");
  const all = await lookup(SEARCH_FORM, "a", null, { limit: 50 });
  assert.deepStrictEqual(all.records.map((record) => record.data[NID]), ["a", "Alpha", "Gamma", "Beta", "banana"], "one page holds the whole order");
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
