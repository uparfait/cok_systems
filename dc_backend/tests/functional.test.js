const assert = require("assert");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { MongoClient, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

const TEST_PORT = 18765;
const TEST_JWT_SECRET = "dcs-functional-test-secret";
const BASE_URL = `http://127.0.0.1:${TEST_PORT}/dcs/api`;

/**
 * Polls the server until it accepts connections, since boot is async.
 */
async function wait_for_server_ready() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      await fetch(`${BASE_URL}/docs`);
      return;
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("server_never_became_ready");
}

/**
 * Runs the full functional test against a real, in-memory MongoDB and the
 * actual Express app - no mocks.
 */
async function run_functional_test() {
  const mongod = await MongoMemoryServer.create();
  const base_uri = mongod.getUri();

  process.env.DC_PORT = String(TEST_PORT);
  process.env.conne_string = `${base_uri}data_collection_system`;
  process.env.COK_DB_NAME = "cok";
  process.env.JWT_SECRET = TEST_JWT_SECRET;

  const seed_client = new MongoClient(base_uri);
  await seed_client.connect();
  const cok_db = seed_client.db("cok");

  const department_id = new ObjectId();
  await cok_db.collection("departments").insertOne({
    _id: department_id,
    department_name: "Urban Planning",
    is_unit: false,
  });

  const user_id = new ObjectId();
  await cok_db.collection("users").insertOne({
    _id: user_id,
    full_name: "Test Author",
    email: "author@test.rw",
    is_account_activated: true,
    access_control: { is_locked: false },
    roles: { role_name: "system_admin", permissions: [] },
    department: department_id,
  });

  const access_token = jwt.sign({ userId: user_id.toString(), email: "author@test.rw" }, TEST_JWT_SECRET);
  const auth_headers = { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" };

  require("../main.js");
  await wait_for_server_ready();

  const departments_response = await fetch(`${BASE_URL}/departments`, { headers: auth_headers }).then((res) => res.json());
  assert.strictEqual(departments_response.success, true);
  assert.strictEqual(departments_response.data.length, 1);
  assert.strictEqual(departments_response.data[0].name, "Urban Planning");

  const project_response = await fetch(`${BASE_URL}/projects`, {
    method: "POST",
    headers: auth_headers,
    body: JSON.stringify({ name: "Household Survey", description: "Test project", department_id: department_id.toString(), department_name: "Urban Planning" }),
  }).then((res) => res.json());
  assert.strictEqual(project_response.success, true);
  const project_id = project_response.data._id;

  const initial_schema = {
    title: { en: "Household survey", kn: "Ubukurikirane" },
    fields: [
      { id: "header_1", type: "header", label: { en: "Household survey" }, level: 1 },
      { id: "full_name", type: "text", label: { en: "Full name", kn: "Amazina" }, mandatory: true, validation_rules: [] },
      {
        id: "household_size",
        type: "number",
        label: { en: "Household size" },
        mandatory: true,
        validation_rules: [
          { condition: { ">": [{ var: "household_size" }, 0] }, message: { en: "Must be greater than zero" }, severity: "error" },
        ],
      },
    ],
  };

  const create_form_response = await fetch(`${BASE_URL}/forms/project/${project_id}`, {
    method: "POST",
    headers: auth_headers,
    body: JSON.stringify({ schema: initial_schema, form_name: "Household Survey Form" }),
  }).then((res) => res.json());
  assert.strictEqual(create_form_response.success, true, JSON.stringify(create_form_response));
  const form_group_id = create_form_response.data.form_group_id;
  assert.strictEqual(create_form_response.data.version, 1);
  assert.strictEqual(create_form_response.data.form_name, "Household Survey Form");

  const duplicate_name_response = await fetch(`${BASE_URL}/forms/project/${project_id}`, {
    method: "POST",
    headers: auth_headers,
    body: JSON.stringify({ schema: initial_schema, form_name: "Household Survey Form" }),
  });
  assert.strictEqual(duplicate_name_response.status, 409);

  const public_form_response = await fetch(`${BASE_URL}/public/forms/${form_group_id}`).then((res) => res.json());
  assert.strictEqual(public_form_response.success, true);
  assert.strictEqual(public_form_response.data.version, 1);

  const invalid_submit_response = await fetch(`${BASE_URL}/public/forms/${form_group_id}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version: 1, data: { full_name: "Jean", household_size: -2 }, client_submission_id: "client_1" }),
  });
  assert.strictEqual(invalid_submit_response.status, 422);
  const invalid_submit_body = await invalid_submit_response.json();
  assert.ok(invalid_submit_body.field_errors.household_size);

  const valid_submit_response = await fetch(`${BASE_URL}/public/forms/${form_group_id}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version: 1, data: { full_name: "Jean", household_size: 4 }, client_submission_id: "client_2" }),
  });
  assert.strictEqual(valid_submit_response.status, 201);

  const submissions_response = await fetch(`${BASE_URL}/submissions/${form_group_id}`, { headers: auth_headers }).then((res) => res.json());
  assert.strictEqual(submissions_response.data.length, 1);
  assert.strictEqual(submissions_response.total, 1);

  const updated_schema = Object.assign({}, initial_schema, {
    fields: initial_schema.fields.concat([{ id: "notes", type: "text", label: { en: "Notes" }, mandatory: false }]),
  });
  const update_form_response = await fetch(`${BASE_URL}/forms/${form_group_id}`, {
    method: "PUT",
    headers: auth_headers,
    body: JSON.stringify({ schema: updated_schema }),
  }).then((res) => res.json());
  assert.strictEqual(update_form_response.success, true);
  assert.strictEqual(update_form_response.data.version, 2);
  assert.strictEqual(update_form_response.data.form_name, "Household Survey Form");

  const versions_response = await fetch(`${BASE_URL}/forms/${form_group_id}/versions`, { headers: auth_headers }).then((res) => res.json());
  assert.strictEqual(versions_response.data.length, 2);

  const public_form_after_edit = await fetch(`${BASE_URL}/public/forms/${form_group_id}`).then((res) => res.json());
  assert.strictEqual(public_form_after_edit.data.version, 2);

  const reactivate_response = await fetch(`${BASE_URL}/forms/${form_group_id}/active-version`, {
    method: "PUT",
    headers: auth_headers,
    body: JSON.stringify({ version: 1 }),
  }).then((res) => res.json());
  assert.strictEqual(reactivate_response.data.version, 1);

  const public_form_after_reactivate = await fetch(`${BASE_URL}/public/forms/${form_group_id}`).then((res) => res.json());
  assert.strictEqual(public_form_after_reactivate.data.version, 1);

  // The authenticated builder fetch must follow whichever version is
  // actually active, not just the newest one that happens to exist.
  const builder_form_after_reactivate = await fetch(`${BASE_URL}/forms/${form_group_id}`, { headers: auth_headers }).then((res) => res.json());
  assert.strictEqual(builder_form_after_reactivate.data.version, 1);

  // Editing only an existing field's validation rule - no data-collection
  // field added or removed - must update the active version (1) in place,
  // never mint a new version.
  const in_place_schema = Object.assign({}, initial_schema, {
    fields: initial_schema.fields.map((field) =>
      field.id === "full_name"
        ? Object.assign({}, field, {
            validation_rules: [{ condition: { min_length: [{ var: "full_name" }, 2] }, message: { en: "Too short" }, severity: "error" }],
          })
        : field,
    ),
  });
  const in_place_update_response = await fetch(`${BASE_URL}/forms/${form_group_id}`, {
    method: "PUT",
    headers: auth_headers,
    body: JSON.stringify({ schema: in_place_schema }),
  }).then((res) => res.json());
  assert.strictEqual(in_place_update_response.success, true, JSON.stringify(in_place_update_response));
  assert.strictEqual(in_place_update_response.data.version, 1);

  const versions_after_in_place_update = await fetch(`${BASE_URL}/forms/${form_group_id}/versions`, { headers: auth_headers }).then((res) => res.json());
  assert.strictEqual(versions_after_in_place_update.data.length, 2);

  // The active version (1) can never be deleted.
  const delete_active_response = await fetch(`${BASE_URL}/forms/${form_group_id}/versions/1`, {
    method: "DELETE",
    headers: auth_headers,
    body: JSON.stringify({ delete_data: false }),
  });
  assert.strictEqual(delete_active_response.status, 400);

  // A non-active version (2) can be deleted; it has no submissions of its
  // own, so delete_data is irrelevant to the resulting version count.
  const delete_inactive_response = await fetch(`${BASE_URL}/forms/${form_group_id}/versions/2`, {
    method: "DELETE",
    headers: auth_headers,
    body: JSON.stringify({ delete_data: false }),
  }).then((res) => res.json());
  assert.strictEqual(delete_inactive_response.success, true, JSON.stringify(delete_inactive_response));

  const versions_after_delete = await fetch(`${BASE_URL}/forms/${form_group_id}/versions`, { headers: auth_headers }).then((res) => res.json());
  assert.strictEqual(versions_after_delete.data.length, 1);

  // The submission collected earlier against version 1 must still be
  // there - deleting version 2 must never touch another version's data.
  const submissions_after_delete = await fetch(`${BASE_URL}/submissions/${form_group_id}`, { headers: auth_headers }).then((res) => res.json());
  assert.strictEqual(submissions_after_delete.total, 1);

  process.stdout.write("ALL_FUNCTIONAL_TESTS_PASSED\n");
  process.exit(0);
}

run_functional_test().catch((error) => {
  process.stderr.write(`FUNCTIONAL_TEST_FAILED: ${error.stack}\n`);
  process.exit(1);
});
