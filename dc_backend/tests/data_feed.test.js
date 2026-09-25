const assert = require("assert");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { MongoClient, ObjectId } = require("mongodb");

/**
 * The data feed an external tool such as Power BI reads a form through,
 * exercised over HTTP against the real server: /public/data-feed/:token
 * (JSON pages and a CSV stream) and its /schema.
 *
 * What matters here is what a BI dataset ends up holding for a TRACKED
 * form. The feed sends one line per record - never a stage-by-stage
 * history, which would read as duplicated data - but a record whose value
 * was corrected afterwards has to be delivered AGAIN on the next ?since
 * pull, or the dataset keeps the first value forever. That re-delivery is
 * only safe because every row carries record_id for the reader to match
 * on, so the corrected line replaces the old one instead of being appended
 * as a second car.
 */

const TEST_PORT = 18766;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}/dcs/api`;

const FORM = "feed-parking-form";
const PLATE = "plate_field";
const STATUS = "status_field";
const TRACKING = { enabled: true, key_field_id: PLATE, key_unique: false, editable_field_ids: [STATUS] };

const T12 = new Date("2026-09-25T12:00:00Z");
const T13 = new Date("2026-09-25T13:00:00Z");

const SCHEMA = {
  fields: [
    { id: PLATE, type: "text", label: { en: "Plate", kn: "Nimero", fr: "Plaque" } },
    { id: STATUS, type: "single_select", label: { en: "Status", kn: "Uko bimeze", fr: "Statut" }, options: [] },
  ],
};

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

function parse_csv(text) {
  const body = text.replace(new RegExp("^" + String.fromCharCode(65279)), "").trim();
  return body.split("\r\n").map((line) => {
    const cells = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') { cell += '"'; i += 1; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") { cells.push(cell); cell = ""; }
      else cell += ch;
    }
    cells.push(cell);
    return cells;
  });
}

async function run_all_tests() {
  const server = await MongoMemoryServer.create();
  const uri = server.getUri();

  // The database name has to ride on the URI: db_connection takes its
  // handle straight off the connection string.
  process.env.conne_string = `${uri}data_collection_system`;
  process.env.COK_DB_NAME = "cok";
  process.env.DC_PORT = String(TEST_PORT);
  process.env.JWT_SECRET = "dcs-feed-test-secret";
  process.env.NODE_ENV = "test";

  const client = await MongoClient.connect(uri);
  const db = client.db("data_collection_system");

  // One tracked form, one car that arrived at 12:00 and left at 13:00.
  await db.collection("dcs_forms").insertOne({
    form_group_id: FORM,
    version: 1,
    is_active: true,
    form_name: "Parking",
    project_id: new ObjectId(),
    schema: SCHEMA,
    tracking: TRACKING,
    created_at: T12,
    updated_at: T13,
  });
  await db.collection("dcs_submissions").insertOne({
    _id: new ObjectId("0000000000000000000000aa"),
    form_group_id: FORM,
    version: 1,
    submitted_at: T12,
    updated_at: T13,
    record_key: "rab 001",
    data: { [PLATE]: "RAB 001", [STATUS]: "out" },
    tracking_periods: { [STATUS]: [{ value: "in", from: T12, to: T13 }, { value: "out", from: T13, to: null }] },
    history: [{ at: T12, kind: "created" }, { at: T13, kind: "updated" }],
  });
  // A second car that arrived at 12:00 and has not moved since.
  await db.collection("dcs_submissions").insertOne({
    _id: new ObjectId("0000000000000000000000bb"),
    form_group_id: FORM,
    version: 1,
    submitted_at: T12,
    record_key: "rab 002",
    data: { [PLATE]: "RAB 002", [STATUS]: "in" },
    tracking_periods: { [STATUS]: [{ value: "in", from: T12, to: null }] },
    history: [{ at: T12, kind: "created" }],
  });

  const TOKEN = "feedtesttoken0000000000000000";
  await db.collection("dcs_data_feed_tokens").insertOne({
    token: TOKEN,
    form_group_id: FORM,
    name: "Power BI",
    scope: { version: null, from: null, to: null },
    revoked_at: null,
    expires_at: null,
    created_at: T12,
  });

  require("../main.js");
  await wait_for_server_ready();

  try {
    await test_schema_leads_with_record_id(TOKEN);
    await test_schema_is_english_by_default(TOKEN);
    await test_schema_follows_an_asked_language(TOKEN);
    await test_json_page_sends_one_row_per_car(TOKEN);
    await test_csv_matches_the_json(TOKEN);
    await test_since_redelivers_the_corrected_car(TOKEN);
    await test_a_window_reads_as_of_its_end(TOKEN);
    await test_a_bad_token_is_refused();
  } finally {
    await client.close();
    await server.stop();
  }
}

const get_json = async (url) => {
  const response = await fetch(url);
  return { status: response.status, body: await response.json() };
};

/** The reader's upsert key has to be there, and first. */
async function test_schema_leads_with_record_id(token) {
  const { status, body } = await get_json(`${BASE_URL}/public/data-feed/${token}/schema`);
  assert.strictEqual(status, 200, "the schema endpoint answers");
  const columns = body.data.columns;
  assert.strictEqual(columns[0].field_id, "record_id", "record_id leads the columns");
  assert.strictEqual(columns[0].type, "id", "and is described as an id");
  const field_ids = columns.map((column) => column.field_id);
  assert.strictEqual(new Set(field_ids).size, field_ids.length, "no column is described twice");
  assert.strictEqual(field_ids.includes("_id"), false, "the old ad-hoc id column is gone, so there is exactly one key column");
}

/** A BI tool sends no language header, and must not get Kinyarwanda labels. */
async function test_schema_is_english_by_default(token) {
  const { body } = await get_json(`${BASE_URL}/public/data-feed/${token}/schema`);
  const by_field = new Map(body.data.columns.map((column) => [column.field_id, column.label]));
  assert.strictEqual(by_field.get("record_id"), "Record ID", "the key column is English by default");
  assert.strictEqual(by_field.get(PLATE), "Plate", "a form field is labelled in English by default");
  assert.strictEqual(by_field.get("submitted_at"), "Submitted at", "and so are the built-in columns");
}

/** The reader can still ask for another language explicitly. */
async function test_schema_follows_an_asked_language(token) {
  const { body } = await get_json(`${BASE_URL}/public/data-feed/${token}/schema?language=fr`);
  const by_field = new Map(body.data.columns.map((column) => [column.field_id, column.label]));
  assert.strictEqual(by_field.get(PLATE), "Plaque", "?language=fr renames the columns");
  assert.strictEqual(by_field.get("submitted_at"), "Soumis le", "including the built-in ones");
}

/** One line per car, with no range asked: the value is today's. */
async function test_json_page_sends_one_row_per_car(token) {
  const { body } = await get_json(`${BASE_URL}/public/data-feed/${token}?keys=id`);
  assert.strictEqual(body.count, 2, "two cars, two rows - not three rows for three movements");
  assert.strictEqual(body.results.length, 2);
  const by_plate = new Map(body.results.map((row) => [row[PLATE], row]));
  assert.strictEqual(by_plate.get("RAB 001")[STATUS], "out", "the car that left reads out");
  assert.strictEqual(by_plate.get("RAB 002")[STATUS], "in", "the car still parked reads in");
  assert.strictEqual(by_plate.get("RAB 001").record_id, "0000000000000000000000aa", "every row carries its record_id");
  const ids = body.results.map((row) => row.record_id);
  assert.strictEqual(new Set(ids).size, 2, "each car appears once");
}

/** The CSV stream and the JSON page must not disagree. */
async function test_csv_matches_the_json(token) {
  const response = await fetch(`${BASE_URL}/public/data-feed/${token}?format=csv&keys=id`);
  assert.strictEqual(response.status, 200);
  assert.strictEqual(
    (response.headers.get("content-type") || "").includes("text/csv"),
    true,
    "served as CSV",
  );
  const rows = parse_csv(await response.text());
  assert.strictEqual(rows[0][0], "record_id", "the CSV header leads with record_id");
  assert.strictEqual(rows.length, 3, "a header and two car lines");

  const { body } = await get_json(`${BASE_URL}/public/data-feed/${token}?keys=id`);
  const header = rows[0];
  const csv_by_id = new Map(rows.slice(1).map((row) => [row[0], row]));
  body.results.forEach((json_row) => {
    const csv_row = csv_by_id.get(json_row.record_id);
    assert.ok(csv_row, `the CSV holds the same car ${json_row.record_id}`);
    header.forEach((key, index) => {
      assert.strictEqual(String(csv_row[index]), String(json_row[key] === undefined ? "" : json_row[key]), `${key} agrees between CSV and JSON`);
    });
  });
}

/**
 * The point of the whole exercise: a tool that last pulled at 12:30 must be
 * handed RAB 001 again, because it left at 13:00 and the dataset still
 * thinks it is parked.
 */
async function test_since_redelivers_the_corrected_car(token) {
  const { body } = await get_json(`${BASE_URL}/public/data-feed/${token}?keys=id&since=2026-09-25T12:30:00.000Z`);
  assert.strictEqual(body.count, 1, "only the car that moved since 12:30 is re-sent");
  assert.strictEqual(body.results[0][PLATE], "RAB 001", "and it is the one that left");
  assert.strictEqual(body.results[0][STATUS], "out", "carrying its corrected value");
  assert.strictEqual(body.results[0].record_id, "0000000000000000000000aa", "keyed so the reader replaces its old line");
}

/** A window reads as of its end, so a past pull is reproducible. */
async function test_a_window_reads_as_of_its_end(token) {
  const { body } = await get_json(
    `${BASE_URL}/public/data-feed/${token}?keys=id&from=2026-09-25T00:00:00.000Z&to=2026-09-25T12:59:59.999Z`,
  );
  const by_plate = new Map(body.results.map((row) => [row[PLATE], row]));
  assert.strictEqual(by_plate.size, 2, "both cars arrived inside the window");
  assert.strictEqual(
    by_plate.get("RAB 001")[STATUS],
    "in",
    "asked for the 12:00 hour, the feed says the car was IN - it had not left yet at the end of that window",
  );
}

async function test_a_bad_token_is_refused() {
  const response = await fetch(`${BASE_URL}/public/data-feed/nosuchtoken`);
  assert.strictEqual(response.status, 401, "an unknown token is refused");
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
