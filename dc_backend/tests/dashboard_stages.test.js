const assert = require("assert");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { MongoClient, ObjectId } = require("mongodb");
const { set_db_handles } = require("../db_connection/db.js");

/**
 * The dashboard side of the current-state reading, computed through the
 * real dashboard code (util-dashboard/widget_data.js) rather than
 * hand-built pipelines.
 *
 * The scenario is the smart-parking one. A car is recorded on arrival
 * with status "in" and the SAME record is labelled "out" when it leaves.
 * A dashboard reads every record ONCE, with the status it holds now,
 * dated by the moment it last moved - so over 12:00-14:00:
 *
 *   KPI "cars in"   ->  the cars that last moved in the window and are in now
 *   KPI "cars out"  ->  the cars that last moved in the window and are out now
 *
 * and an OVER TIME chart puts each car in the hour of its last move.
 */

const FORM = "dash-parking";
const PLATE = "plate_f";
const STATUS = "status_f";
const TRACKING = { enabled: true, key_field_ids: [PLATE], key_field_id: PLATE, key_unique: false, editable_field_ids: [STATUS] };

const T12 = new Date("2026-09-25T12:00:00Z");
const T13 = new Date("2026-09-25T13:00:00Z");
const YESTERDAY = new Date("2026-09-24T08:00:00Z");

// 12:00 up to (not including) 14:00, stated to the millisecond.
const WINDOW = { from: "2026-09-25T12:00:00.000Z", to: "2026-09-25T13:59:59.999Z" };
const HOUR_13 = { from: "2026-09-25T13:00:00.000Z", to: "2026-09-25T13:59:59.999Z" };

const FORM_VERSION = {
  form_group_id: FORM,
  version: 1,
  is_active: true,
  tracking: TRACKING,
  schema: {
    fields: [
      { id: PLATE, type: "text", label: { en: "Plate" } },
      {
        id: STATUS,
        type: "single_select",
        label: { en: "Status" },
        options: [
          { id: "o1", value: "in", label: { en: "In" } },
          { id: "o2", value: "out", label: { en: "Out" } },
        ],
      },
    ],
  },
};

function periods(spec) {
  const out = {};
  Object.keys(spec).forEach((field_id) => {
    out[field_id] = spec[field_id].map(([value, from, to]) => ({ value, from, to: to || null }));
  });
  return out;
}

const CARS = [
  // Arrived 12:00, left 13:00 - last moved at 13:00, out now.
  {
    _id: new ObjectId("00000000000000000000ab01"),
    form_group_id: FORM,
    version: 1,
    submitted_at: T12,
    updated_at: T13,
    data: { [PLATE]: "RAB 001", [STATUS]: "out" },
    tracking_periods: periods({ [STATUS]: [["in", T12, T13], ["out", T13, null]] }),
  },
  // Arrived 12:00, still parked - never updated, dated by its arrival.
  {
    _id: new ObjectId("00000000000000000000ab02"),
    form_group_id: FORM,
    version: 1,
    submitted_at: T12,
    data: { [PLATE]: "RAB 002", [STATUS]: "in" },
    tracking_periods: periods({ [STATUS]: [["in", T12, null]] }),
  },
  // Arrived YESTERDAY, left 13:00 today. Its last move puts it in the
  // window even though it arrived long before it began.
  {
    _id: new ObjectId("00000000000000000000ab03"),
    form_group_id: FORM,
    version: 1,
    submitted_at: YESTERDAY,
    updated_at: T13,
    data: { [PLATE]: "RAB 003", [STATUS]: "out" },
    tracking_periods: periods({ [STATUS]: [["in", YESTERDAY, T13], ["out", T13, null]] }),
  },
];

const period = { preset: "custom", from: WINDOW.from, to: WINDOW.to };

/** A KPI card counting the records whose status is one value. */
function kpi_widget(status_value) {
  return {
    form_group_id: FORM,
    chart_type: "kpi",
    metric: { aggregation: "count" },
    filters: [{ field_id: STATUS, operator: "eq", value: status_value }],
    period,
  };
}

/** The same form read over time, hour by hour, split by status. */
function over_time_widget() {
  return {
    form_group_id: FORM,
    chart_type: "bar",
    metric: { aggregation: "count" },
    group_by: { field_id: STATUS },
    over_time: { enabled: true, field_id: "submitted_at", granularity: "hour" },
    split_by: { field_id: STATUS },
    filters: [],
    period,
  };
}

/** The records table widget over the window. */
function table_widget() {
  return {
    form_group_id: FORM,
    chart_type: "table",
    metric: { aggregation: "count" },
    table: { mode: "records", fields: [PLATE, STATUS], page_size: 10 },
    filters: [],
    period,
  };
}

let client = null;
let server = null;

async function run_all_tests() {
  server = await MongoMemoryServer.create();
  const uri = server.getUri();
  client = await MongoClient.connect(uri);
  const db = client.db("data_collection_system");
  await db.collection("dcs_submissions").insertMany(CARS);
  await db.collection("dcs_submissions").createIndex({ form_group_id: 1, submitted_at: -1 });
  // The dashboard code reads through db_connection; hand it this database
  // directly rather than booting the whole server for it.
  set_db_handles(db, client.db("cok"));

  try {
    await test_two_kpi_cards_read_the_same_hours();
    await test_a_kpi_card_counts_each_record_once_by_its_last_move();
    await test_the_previous_period_reads_its_own_window();
    await test_over_time_puts_each_record_in_the_hour_of_its_last_move();
    await test_kpi_totals_match_the_over_time_columns();
    await test_the_records_table_lists_each_record_once();
    await test_an_unbounded_period_reads_today();
  } finally {
    await client.close();
    await server.stop();
  }
}

const { compute_widget_data } = require("../util-dashboard/widget_data.js");

/** A KPI card returns { kind: "kpi", value, previous, change_pct, skipped }. */
const kpi_of = async (widget) => {
  const data = await compute_widget_data(widget, FORM_VERSION, null);
  assert.strictEqual(data.kind, "kpi", "a kpi widget computes as a kpi");
  return data;
};

const kpi_value = async (status_value) => (await kpi_of(kpi_widget(status_value))).value;

/** The two cards the whole scenario is about. */
async function test_two_kpi_cards_read_the_same_hours() {
  const cars_in = await kpi_value("in");
  const cars_out = await kpi_value("out");
  assert.strictEqual(cars_in, 1, 'one car that last moved between 12:00 and 14:00 is in now ("cars in")');
  assert.strictEqual(cars_out, 2, 'two cars that last moved between 12:00 and 14:00 are out now ("cars out")');
}

/**
 * RAB 001 both arrived and left inside the window, but it is ONE record
 * with one current status, so it is on exactly one of the two cards.
 */
async function test_a_kpi_card_counts_each_record_once_by_its_last_move() {
  const cars_in = await kpi_value("in");
  const cars_out = await kpi_value("out");
  assert.strictEqual(cars_in + cars_out, 3, "three records last moved in the window, and each is counted once");
  const only_out = await kpi_of(Object.assign(kpi_widget("out"), { period: { preset: "custom", from: HOUR_13.from, to: HOUR_13.to } }));
  assert.strictEqual(only_out.value, 2, "the 13:00 hour holds exactly the two cars whose last move was then");
  const none_in = await kpi_of(Object.assign(kpi_widget("in"), { period: { preset: "custom", from: HOUR_13.from, to: HOUR_13.to } }));
  assert.strictEqual(none_in.value, 0, "RAB 002 last moved at 12:00, so it is not in the 13:00 hour");
}

/** The comparison figure reads the previous window's own records. */
async function test_the_previous_period_reads_its_own_window() {
  const card = await kpi_of(Object.assign(kpi_widget("in"), { period: { preset: "custom", from: HOUR_13.from, to: HOUR_13.to } }));
  assert.strictEqual(card.value, 0, "no car that last moved in the 13:00 hour is in");
  assert.strictEqual(card.previous, 1, "the previous hour (12:00) holds RAB 002, which is in");
}

/** Each record lands in the hour of its last move. */
async function test_over_time_puts_each_record_in_the_hour_of_its_last_move() {
  const data = await compute_widget_data(over_time_widget(), FORM_VERSION, null);
  assert.ok(Array.isArray(data.rows), "an over-time widget returns rows");
  // Flatten to "<bucket label> <series>=<value>" so the shape is readable
  // whatever the chart formatter wraps it in.
  const flat = [];
  data.rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (key === "label" || key === "key") return;
      if (typeof row[key] === "number" && row[key] !== 0) flat.push(`${row.label} ${key}=${row[key]}`);
    });
  });
  const joined = flat.join(" | ");
  assert.strictEqual(flat.length > 0, true, `the chart produced no values: ${JSON.stringify(data.rows)}`);
  assert.strictEqual(/in=1/.test(joined), true, `the 12:00 column must hold the one car that last moved then (in), got: ${joined}`);
  assert.strictEqual(/out=2/.test(joined), true, `the 13:00 column must hold the two cars that last moved then (out), got: ${joined}`);
  assert.strictEqual(/in=2/.test(joined), false, `RAB 001 must not be counted as an arrival any more, got: ${joined}`);
}

/** The cards and the chart are two readings of one set of records. */
async function test_kpi_totals_match_the_over_time_columns() {
  const cars_in = await kpi_value("in");
  const cars_out = await kpi_value("out");
  const data = await compute_widget_data(over_time_widget(), FORM_VERSION, null);
  let charted = 0;
  data.rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (key !== "label" && key !== "key" && typeof row[key] === "number") charted += row[key];
    });
  });
  assert.strictEqual(charted, cars_in + cars_out, "the chart's columns add up to exactly what the two cards count between them");
}

/** The records table shows one row per record, with its current answers. */
async function test_the_records_table_lists_each_record_once() {
  const data = await compute_widget_data(table_widget(), FORM_VERSION, null);
  assert.strictEqual(data.kind, "table", "a table widget computes as a table");
  assert.strictEqual(data.total, 3, "three records last moved in the window");
  const rows = data.items.map((item) => `${item.data[PLATE]}=${item.data[STATUS]}`).sort();
  assert.deepStrictEqual(rows, ["RAB 001=out", "RAB 002=in", "RAB 003=out"], "one row per car, each with the status it holds now");
}

/** With no period at all, a register reads as it stands right now. */
async function test_an_unbounded_period_reads_today() {
  const all_out = await kpi_of(Object.assign(kpi_widget("out"), { period: { preset: "all" } }));
  const all_in = await kpi_of(Object.assign(kpi_widget("in"), { period: { preset: "all" } }));
  assert.strictEqual(all_in.value, 1, "one car is in right now");
  assert.strictEqual(all_out.value, 2, "two cars are out right now");
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
