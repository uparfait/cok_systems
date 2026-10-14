const assert = require("assert");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { MongoClient, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

/**
 * The follow-up form of an actual form, exercised over HTTP against the
 * real server: creating it, versioning it, its public link (searching the
 * ACTUAL form's records, loading one, saving a NEW follow-up record), the
 * authenticated table over its records, the gallery (its own, and the
 * form's gallery with ?scope=all), and dashboards created on its data.
 */

const TEST_PORT = 18767;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}/dcs/api`;
const SECRET = "dcs-follow-up-test-secret";

const FORM = "follow-up-source-form";
const OTHER_FORM = "follow-up-other-form";
const NAME = "name_f";
const AGE = "age_f";
const NOTES = "notes_f";
const PHOTO = "photo_f";
const DISTRICT = "district_f";

const SCHEMA = {
  fields: [
    { id: NAME, type: "text", label: { en: "Name" }, mandatory: true },
    { id: AGE, type: "number", label: { en: "Age" } },
    { id: NOTES, type: "large_text", label: { en: "Notes" } },
    { id: PHOTO, type: "image", label: { en: "Photo" } },
    { id: DISTRICT, type: "single_select", label: { en: "District" }, options: [{ id: "o1", value: "Gasabo" }, { id: "o2", value: "Kicukiro" }] },
  ],
};

const JEAN_RECORDS = 21;
const FORM_RECORDS = JEAN_RECORDS + 3;
const T0 = new Date("2026-09-01T10:00:00Z");

let auth_headers;

async function wait_for_server_ready() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await fetch(`${BASE_URL}/docs`);
      return;
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("server did not become ready");
}

async function call(method, path, body, headers) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: Object.assign({ "Content-Type": "application/json" }, headers || {}),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}
const as_user = (method, path, body) => call(method, path, body, auth_headers);

function seed_records(db, project_id) {
  const rows = [];
  for (let index = 0; index < JEAN_RECORDS; index += 1) {
    const names = ["Jean Paul", "JEAN", "jeanne", "Marie-Jeanne"];
    rows.push({
      form_group_id: FORM,
      version: 1,
      project_id,
      submitted_at: new Date(T0.getTime() + index * 60000),
      data: { [NAME]: `${names[index % names.length]} ${index}`, [AGE]: index === 0 ? 30 : index === 1 ? "30" : 40 + index, [NOTES]: `note ${index}` },
    });
  }
  rows.push({ form_group_id: FORM, version: 1, project_id, submitted_at: new Date(T0.getTime() + 100 * 60000), data: { [NAME]: "Marie", [AGE]: 41 } });
  rows.push({ form_group_id: FORM, version: 1, project_id, submitted_at: new Date(T0.getTime() + 101 * 60000), data: { [NAME]: "Alice", [AGE]: 52, [PHOTO]: { name: "alice.jpg", type: "image/jpeg", size: 10, url: "/dcs/api/uploads/submissions/alice.jpg" } } });
  rows.push({ form_group_id: FORM, version: 1, project_id, submitted_at: new Date(T0.getTime() + 102 * 60000), data: { [NAME]: "Bob", [AGE]: 33 } });
  rows.push({ form_group_id: OTHER_FORM, version: 1, project_id, submitted_at: T0, data: { [NAME]: "Jean Other", [AGE]: 30 } });
  return rows;
}

async function run_all_tests() {
  const server = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  const uri = server.getUri();
  process.env.conne_string = `${uri}data_collection_system`;
  process.env.COK_DB_NAME = "cok";
  process.env.DC_PORT = String(TEST_PORT);
  process.env.JWT_SECRET = SECRET;
  process.env.NODE_ENV = "test";

  const client = await MongoClient.connect(uri);
  const db = client.db("data_collection_system");
  const cok = client.db("cok");

  const user_id = new ObjectId();
  await cok.collection("users").insertOne({ _id: user_id, full_name: "Follow Author", email: "author@test.rw", is_account_activated: true, access_control: { is_locked: false }, roles: { role_name: "system_admin", permissions: [] } });
  auth_headers = { Authorization: `Bearer ${jwt.sign({ userId: user_id.toString(), email: "author@test.rw" }, SECRET)}` };

  const project_id = new ObjectId();
  await db.collection("dcs_projects").insertOne({ _id: project_id, name: "Follow-up project", created_by: user_id.toString(), access_control_enabled: false, created_at: T0, updated_at: T0 });
  const form_of = (group, name) => ({ form_group_id: group, version: 1, is_active: true, form_name: name, project_id: project_id.toString(), schema: SCHEMA, ask_respondent: true, created_by: user_id.toString(), created_at: T0, updated_at: T0 });
  await db.collection("dcs_forms").insertMany([form_of(FORM, "Household survey"), form_of(OTHER_FORM, "Other survey")]);
  await db.collection("dcs_submissions").insertMany(seed_records(db, project_id.toString()));

  require("../main.js");
  await wait_for_server_ready();

  const state = {};
  try {
    await test_create_and_versions(state);
    await test_public_form_and_search(state);
    await test_submit(state);
    await test_table_and_edit(state);
    await test_upload(state);
    await test_media(state, db);
    await test_dashboards(state);
    await test_delete_records_and_version(state, db);
  } finally {
    await client.close();
    await server.stop();
  }
}

async function test_create_and_versions(state) {
  const none = await as_user("GET", `/forms/${FORM}/follow-up`);
  assert.strictEqual(none.status, 200);
  assert.strictEqual(none.body.data.follow_up, null, "no follow-up yet");
  assert.deepStrictEqual(none.body.data.versions, []);
  assert.strictEqual(none.body.data.can_edit, true, "the form's editor may create one");

  const created = await as_user("POST", `/forms/${FORM}/follow-up`);
  assert.strictEqual(created.status, 201, JSON.stringify(created.body));
  assert.strictEqual(created.body.data.form_name, "Household survey follow-up", "named after the form");
  assert.strictEqual(created.body.data.version, 1);
  assert.strictEqual(created.body.data.source_form_group_id, FORM);
  assert.deepStrictEqual(created.body.data.schema.fields.map((field) => field.id), SCHEMA.fields.map((field) => field.id), "the schema is copied");
  assert.strictEqual(created.body.data.created_by, undefined, "the author never travels");
  state.group = created.body.data.follow_up_group_id;
  assert.ok(state.group, "a follow_up_group_id is minted");

  const again = await as_user("POST", `/forms/${FORM}/follow-up`);
  assert.strictEqual(again.status, 409, "one follow-up per form");

  // A label change updates the active version in place.
  const relabelled = { fields: SCHEMA.fields.map((field) => (field.id === NAME ? Object.assign({}, field, { label: { en: "Full name" } }) : field)) };
  const in_place = await as_user("PUT", `/forms/${FORM}/follow-up`, { form_name: "Household follow-up", schema: relabelled, ask_respondent: false });
  assert.strictEqual(in_place.status, 200, JSON.stringify(in_place.body));
  assert.strictEqual(in_place.body.data.version, 1, "still version 1");
  assert.strictEqual(in_place.body.data.form_name, "Household follow-up");
  assert.strictEqual(in_place.body.data.ask_respondent, false);

  // Adding a data field mints version 2.
  const extended = { fields: relabelled.fields.concat([{ id: "visit_f", type: "text", label: { en: "Visit outcome" } }]) };
  const bumped = await as_user("PUT", `/forms/${FORM}/follow-up`, { schema: extended });
  assert.strictEqual(bumped.status, 201, JSON.stringify(bumped.body));
  assert.strictEqual(bumped.body.data.version, 2);
  assert.strictEqual(bumped.body.data.is_active, true);

  const listed = await as_user("GET", `/forms/${FORM}/follow-up`);
  assert.strictEqual(listed.body.data.follow_up.version, 2, "version 2 is active");
  assert.deepStrictEqual(listed.body.data.versions.map((entry) => entry.version), [2, 1], "newest first");

  const back = await as_user("PUT", `/forms/${FORM}/follow-up/active-version`, { version: 1 });
  assert.strictEqual(back.status, 200);
  assert.strictEqual(back.body.data.version, 1, "version 1 is active again");
  const missing = await as_user("PUT", `/forms/${FORM}/follow-up/active-version`, { version: 9 });
  assert.strictEqual(missing.status, 404);
  const forward = await as_user("PUT", `/forms/${FORM}/follow-up/active-version`, { version: 2 });
  assert.strictEqual(forward.body.data.version, 2);

  const other = await as_user("GET", `/forms/${OTHER_FORM}/follow-up/submissions`);
  assert.strictEqual(other.status, 404, "a form without a follow-up has no follow-up records");
}

async function test_public_form_and_search(state) {
  const form = await call("GET", `/public/follow-up-forms/${state.group}`);
  assert.strictEqual(form.status, 200, JSON.stringify(form.body));
  assert.strictEqual(form.body.data.version, 2, "the public link serves the active version");
  assert.strictEqual(form.body.data.source_form_group_id, FORM);
  assert.strictEqual(form.body.data.ask_respondent, false);
  assert.deepStrictEqual(form.body.data.searchable_field_ids, [NAME, AGE, NOTES], "text, number and long text fields present in both schemas");
  const unknown = await call("GET", `/public/follow-up-forms/no-such-group`);
  assert.strictEqual(unknown.status, 404);

  const page1 = await call("GET", `/public/follow-up-forms/${state.group}/search?field=${NAME}&q=jEaN&page=1`);
  assert.strictEqual(page1.status, 200, JSON.stringify(page1.body));
  assert.strictEqual(page1.body.data.total, JEAN_RECORDS, "contains, case-insensitive, the other form's Jean excluded");
  assert.strictEqual(page1.body.data.items.length, 20, "twenty per page");
  assert.strictEqual(page1.body.data.pages, 2);
  assert.deepStrictEqual(Object.keys(page1.body.data.items[0]).sort(), ["_id", "data", "submitted_at"]);
  const page2 = await call("GET", `/public/follow-up-forms/${state.group}/search?field=${NAME}&q=jean&page=2`);
  assert.strictEqual(page2.body.data.items.length, 1, "the twenty-first on page two");
  assert.strictEqual(page2.body.data.page, 2);

  const by_age = await call("GET", `/public/follow-up-forms/${state.group}/search?field=${AGE}&q=30`);
  assert.strictEqual(by_age.body.data.total, 2, "a number equals, stored as a number or as digits");
  const regex_safe = await call("GET", `/public/follow-up-forms/${state.group}/search?field=${NAME}&q=.*`);
  assert.strictEqual(regex_safe.body.data.total, 0, "the query is taken literally");
  const bad_field = await call("GET", `/public/follow-up-forms/${state.group}/search?field=${PHOTO}&q=x`);
  assert.strictEqual(bad_field.status, 400, "only a searchable field");

  // Newest first, so the oldest Jean is the one left on page two.
  assert.strictEqual(page2.body.data.items[0].data[NAME], "Jean Paul 0");
  state.source_id = page2.body.data.items[0]._id;
  const record = await call("GET", `/public/follow-up-forms/${state.group}/records/${state.source_id}`);
  assert.strictEqual(record.status, 200);
  assert.strictEqual(record.body.data.data[NAME], "Jean Paul 0");
  assert.ok(record.body.data.submitted_at);
  const other_id = (await call("GET", `/public/follow-up-forms/${state.group}/search?field=${NAME}&q=Jean`)).body.data.items[0]._id;
  assert.ok(other_id);
  const foreign = await call("GET", `/public/follow-up-forms/${state.group}/records/${new ObjectId().toString()}`);
  assert.strictEqual(foreign.status, 404);
}

async function test_submit(state) {
  const invalid = await call("POST", `/public/follow-up-forms/${state.group}/submit`, { version: 2, data: { [AGE]: 31 }, source_submission_id: state.source_id });
  assert.strictEqual(invalid.status, 422, "a missing mandatory answer is refused");
  assert.ok(invalid.body.field_errors[NAME]);

  const payload = { version: 2, data: { [NAME]: "Jean Paul 0", [AGE]: 31, visit_f: "visited" }, source_submission_id: state.source_id, client_submission_id: "fu-client-1", respondent: { name: "Agent A" } };
  const first = await call("POST", `/public/follow-up-forms/${state.group}/submit`, payload);
  assert.strictEqual(first.status, 201, JSON.stringify(first.body));
  assert.strictEqual(first.body.data.source_submission_id, state.source_id, "remembers the actual record");
  assert.strictEqual(first.body.data.follow_up_group_id, state.group);
  assert.strictEqual(first.body.data.version, 2);
  assert.strictEqual(first.body.data.source_form_group_id, FORM);
  assert.strictEqual(first.body.data.data[AGE], 31);
  assert.strictEqual(first.body.data.respondent.name, "Agent A");
  state.record_id = first.body.data._id;

  const retry = await call("POST", `/public/follow-up-forms/${state.group}/submit`, payload);
  assert.strictEqual(retry.status, 200, "an offline retry is idempotent");
  assert.strictEqual(retry.body.data._id, state.record_id);

  const standalone = await call("POST", `/public/follow-up-forms/${state.group}/submit`, { version: 2, data: { [NAME]: "Fresh", [PHOTO]: { name: "fresh.png", type: "image/png", size: 5, url: "/dcs/api/uploads/submissions/fresh.png" } } });
  assert.strictEqual(standalone.status, 201);
  assert.strictEqual(standalone.body.data.source_submission_id, null, "a record filled in from scratch");
  state.standalone_id = standalone.body.data._id;

  const on_v1 = await call("POST", `/public/follow-up-forms/${state.group}/submit`, { version: 1, data: { [NAME]: "Old version" } });
  assert.strictEqual(on_v1.status, 201, "any existing version may still be submitted against");
  const wrong_source = await call("POST", `/public/follow-up-forms/${state.group}/submit`, { version: 2, data: { [NAME]: "x" }, source_submission_id: new ObjectId().toString() });
  assert.strictEqual(wrong_source.status, 404, "the actual record has to exist");

  const original = await call("GET", `/public/follow-up-forms/${state.group}/records/${state.source_id}`);
  assert.strictEqual(original.body.data.data[AGE], 30, "the actual record never changes");
}

async function test_table_and_edit(state) {
  const all = await as_user("GET", `/forms/${FORM}/follow-up/submissions`);
  assert.strictEqual(all.status, 200);
  assert.strictEqual(all.body.total, 3, "every follow-up record");
  assert.strictEqual(all.body.data.length, 3);
  const v1 = await as_user("GET", `/forms/${FORM}/follow-up/submissions?version=1&page=1&limit=1`);
  assert.strictEqual(v1.body.total, 1, "?version counts one version's records");
  const searched = await as_user("GET", `/forms/${FORM}/follow-up/submissions?search=visited`);
  assert.strictEqual(searched.body.total, 1, "search reaches the answers");
  assert.strictEqual(searched.body.data[0]._id, state.record_id);
  const pinned = await as_user("GET", `/forms/${FORM}/follow-up/submissions?record=${state.standalone_id}`);
  assert.strictEqual(pinned.body.total, 1, "a pinned record answers for itself");
  assert.strictEqual(pinned.body.data[0]._id, state.standalone_id);

  const one = await as_user("GET", `/forms/${FORM}/follow-up/submissions/${state.record_id}`);
  assert.strictEqual(one.status, 200);
  assert.strictEqual(one.body.data.source_submission_id, state.source_id);

  const bad = await as_user("PUT", `/forms/${FORM}/follow-up/submissions/${state.record_id}`, { data: { [NAME]: "" } });
  assert.strictEqual(bad.status, 422, "an edit is validated like a submission");
  const edited = await as_user("PUT", `/forms/${FORM}/follow-up/submissions/${state.record_id}`, { data: { [AGE]: 32 } });
  assert.strictEqual(edited.status, 200, JSON.stringify(edited.body));
  assert.strictEqual(edited.body.data.data[AGE], 32);
  assert.strictEqual(edited.body.data.data[NAME], "Jean Paul 0", "untouched answers stay");
  assert.ok(edited.body.data.updated_at, "stamped updated_at");

  const page = await call("GET", `/public/follow-up-records/${state.record_id}`);
  assert.strictEqual(page.status, 200);
  assert.strictEqual(page.body.data.form.version, 2, "the record's own version");
  assert.strictEqual(page.body.data.record.data[AGE], 32);
  const saved = await call("PUT", `/public/follow-up-records/${state.record_id}`, { data: { visit_f: "re-visited" }, respondent: { name: "Agent B" } });
  assert.strictEqual(saved.status, 200, JSON.stringify(saved.body));
  assert.strictEqual(saved.body.data.data.visit_f, "re-visited");
  assert.strictEqual(saved.body.data.respondent.name, "Agent B");
}

async function test_upload(state) {
  const form_data = new FormData();
  form_data.append("version", "2");
  form_data.append("field_id", PHOTO);
  form_data.append("file", new Blob([Buffer.from("89504e47", "hex")], { type: "image/png" }), "shot.png");
  const response = await fetch(`${BASE_URL}/public/follow-up-forms/${state.group}/upload`, { method: "POST", body: form_data });
  const body = await response.json();
  assert.strictEqual(response.status, 201, JSON.stringify(body));
  assert.strictEqual(body.data.name, "shot.png");
  assert.ok(body.data.url.startsWith("/dcs/api/uploads/submissions/"), "stored where the form uploads are");

  const wrong_field = new FormData();
  wrong_field.append("version", "2");
  wrong_field.append("field_id", "nope_f");
  wrong_field.append("file", new Blob(["x"], { type: "image/png" }), "x.png");
  const refused = await fetch(`${BASE_URL}/public/follow-up-forms/${state.group}/upload`, { method: "POST", body: wrong_field });
  assert.strictEqual(refused.status, 400, "the field has to exist on the follow-up version");

  const removed = await call("DELETE", `/public/follow-up-forms/${state.group}/upload`, { url: body.data.url });
  assert.strictEqual(removed.status, 200, "the follow-up delete route removes it");
  const removed_again = await call("DELETE", `/public/forms/${FORM}/upload`, { url: body.data.url });
  assert.strictEqual(removed_again.status, 200, "and so does the form's delete route");
}

async function test_media(state) {
  const own = await as_user("GET", `/submissions/${FORM}/media`);
  assert.strictEqual(own.status, 200, JSON.stringify(own.body));
  assert.strictEqual(own.body.total, 1, "the form's gallery shows the form's pictures only");
  assert.strictEqual(own.body.data[0].name, "alice.jpg");

  const all = await as_user("GET", `/submissions/${FORM}/media?scope=all`);
  assert.strictEqual(all.body.total, 2, "scope=all adds the follow-up's pictures");
  const by_name = new Map(all.body.data.map((item) => [item.name, item]));
  assert.strictEqual(by_name.get("alice.jpg").source, "form");
  assert.strictEqual(by_name.get("alice.jpg").follow_up_group_id, null);
  assert.strictEqual(by_name.get("fresh.png").source, "follow_up");
  assert.strictEqual(by_name.get("fresh.png").follow_up_group_id, state.group);
  assert.strictEqual(by_name.get("fresh.png").submission_id, state.standalone_id);
  assert.strictEqual(all.body.data[0].name, "fresh.png", "ordered together, newest first");
  assert.strictEqual(by_name.get("fresh.png").field_label, "Photo");

  const follow_up_only = await as_user("GET", `/forms/${FORM}/follow-up/media`);
  assert.strictEqual(follow_up_only.body.total, 1);
  assert.strictEqual(follow_up_only.body.data[0].source, "follow_up");
  assert.strictEqual(follow_up_only.body.data[0].follow_up_group_id, state.group);
}

const kpi = (id) => ({ id, title: "Records", chart_type: "kpi", metric: { aggregation: "count", field_id: null }, filters: [], period: { preset: "all" } });

async function test_dashboards(state) {
  const refused = await as_user("POST", `/forms/${OTHER_FORM}/dashboards`, { name: "No follow-up", source: "follow_up" });
  assert.strictEqual(refused.status, 422, "a follow-up board needs a follow-up form");

  const fu_board = await as_user("POST", `/forms/${FORM}/dashboards`, { name: "Follow-up board", source: "follow_up" });
  assert.strictEqual(fu_board.status, 201, JSON.stringify(fu_board.body));
  assert.strictEqual(fu_board.body.data.dashboard.source, "follow_up");
  assert.strictEqual(fu_board.body.data.dashboard.follow_up_group_id, state.group);
  const form_board = await as_user("POST", `/forms/${FORM}/dashboards`, { name: "Form board" });
  assert.strictEqual(form_board.body.data.dashboard.source, "form", "form is the default source");
  state.fu_dashboard_id = fu_board.body.data.dashboard.id;

  const listed = await as_user("GET", `/forms/${FORM}/dashboards`);
  assert.deepStrictEqual(listed.body.data.dashboards.map((entry) => entry.source).sort(), ["follow_up", "form"], "items carry their source");
  const opened = await as_user("GET", `/forms/${FORM}/dashboards/${state.fu_dashboard_id}`);
  assert.strictEqual(opened.body.data.source, "follow_up");

  const saved = await as_user("PUT", `/forms/${FORM}/dashboards/${state.fu_dashboard_id}`, { widgets: [Object.assign(kpi("k1"), { metric: { aggregation: "sum", field_id: AGE } })] });
  assert.strictEqual(saved.status, 200, "a widget validates against the follow-up schema: " + JSON.stringify(saved.body));

  const by_source = await as_user("POST", `/forms/${FORM}/dashboard/data`, { widgets: [kpi("k1")], source: "follow_up" });
  assert.strictEqual(by_source.status, 200, JSON.stringify(by_source.body));
  assert.strictEqual(by_source.body.data.results[0].value, 3, "a follow-up board counts the follow-up records");
  const by_dashboard = await as_user("POST", `/forms/${FORM}/dashboard/data`, { widgets: [kpi("k1")], dashboard_id: state.fu_dashboard_id });
  assert.strictEqual(by_dashboard.body.data.results[0].value, 3, "naming the dashboard works too");
  const plain = await as_user("POST", `/forms/${FORM}/dashboard/data`, { widgets: [kpi("k1")] });
  assert.strictEqual(plain.body.data.results[0].value, FORM_RECORDS, "a form board still counts the actual records");
  const filter_values = await as_user("POST", `/forms/${FORM}/dashboard/filter-values`, { field_id: DISTRICT, source: "follow_up" });
  assert.strictEqual(filter_values.status, 200);
  const records = await as_user("POST", `/forms/${FORM}/dashboard/records`, { widget: kpi("k1"), source: "follow_up" });
  assert.strictEqual(records.status, 200, JSON.stringify(records.body));
  assert.strictEqual(records.body.data.total, 3, "the records behind a follow-up widget are follow-up records");
  assert.ok(records.body.data.columns.some((column) => column.id === "visit_f"), "with the follow-up's own columns");

  const link = await as_user("POST", `/forms/${FORM}/dashboard/links`, { title: "Shared", dashboard_id: state.fu_dashboard_id, never_expires: true });
  assert.strictEqual(link.status, 201, JSON.stringify(link.body));
  const shared = await call("GET", `/public/dashboard/${link.body.data.link.token}`);
  assert.strictEqual(shared.status, 200);
  assert.strictEqual(shared.body.data.source, "follow_up", "the public page knows the source");
  const shared_data = await call("POST", `/public/dashboard/${link.body.data.link.token}/data`, { widgets: [kpi("k1")] });
  assert.strictEqual(shared_data.body.data.results[0].value, 3, "the shared board reads the follow-up records");
}

async function test_delete_records_and_version(state, db) {
  const deleted = await as_user("POST", `/forms/${FORM}/follow-up/submissions/delete-selected`, { submission_ids: [state.standalone_id, state.source_id] });
  assert.strictEqual(deleted.status, 200, JSON.stringify(deleted.body));
  assert.strictEqual(deleted.body.data.deleted_count, 1, "only follow-up records of this form go");
  assert.strictEqual(await db.collection("dcs_submissions").countDocuments({ form_group_id: FORM }), FORM_RECORDS, "the actual records are untouched");

  const active = await as_user("DELETE", `/forms/${FORM}/follow-up/versions/2`, { delete_data: true });
  assert.strictEqual(active.status, 400, "the active version stays while another exists");
  const gone = await as_user("DELETE", `/forms/${FORM}/follow-up/versions/1`, { delete_data: true });
  assert.strictEqual(gone.status, 200, JSON.stringify(gone.body));
  assert.strictEqual(gone.body.data.deleted_submission_count, 1, "the record collected on version 1 went with it");
  const left = await as_user("GET", `/forms/${FORM}/follow-up`);
  assert.deepStrictEqual(left.body.data.versions.map((entry) => entry.version), [2]);
  assert.strictEqual((await as_user("GET", `/forms/${FORM}/follow-up/submissions`)).body.total, 1);
  const board_still = await as_user("GET", `/forms/${FORM}/dashboards/${state.fu_dashboard_id}`);
  assert.strictEqual(board_still.status, 200, "the follow-up board stays while the follow-up exists");
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
