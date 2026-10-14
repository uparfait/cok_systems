const assert = require("assert");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { MongoClient, ObjectId } = require("mongodb");
const { set_db_handles } = require("../db_connection/db.js");

/**
 * The dashboard side of the as-of reading, computed through the real
 * dashboard code (util-dashboard/widget_data.js) rather than hand-built
 * pipelines.
 *
 * The scenario is the smart-parking one. A car is recorded on arrival
 * with status "in" and the SAME record is labelled "out" when it leaves.
 * A dashboard period shows the register AS IT WAS at the period's end:
 * the cars created or moved inside the period, each with the status it
 * held at the end - so a period ending 12:30 says a car that left at
 * 13:00 was in. The over-time chart alone reads the state DURING each
 * hour: one row per movement, "in" in the 12:00 column and "out" in the
 * 13:00 one for the same car.
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
const HALF_PAST_12 = { from: "2026-09-25T12:00:00.000Z", to: "2026-09-25T12:30:00.000Z" };

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
  // Arrived 12:00, left 13:00.
  {
    _id: new ObjectId("00000000000000000000ab01"),
    form_group_id: FORM,
    version: 1,
    submitted_at: T12,
    updated_at: T13,
    data: { [PLATE]: "RAB 001", [STATUS]: "out" },
    tracking_periods: periods({ [STATUS]: [["in", T12, T13], ["out", T13, null]] }),
  },
  // Arrived 12:00, still parked.
  {
    _id: new ObjectId("00000000000000000000ab02"),
    form_group_id: FORM,
    version: 1,
    submitted_at: T12,
    data: { [PLATE]: "RAB 002", [STATUS]: "in" },
    tracking_periods: periods({ [STATUS]: [["in", T12, null]] }),
  },
  // Arrived YESTERDAY, left 13:00 today.
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

const period_of = (window) => ({ preset: "custom", from: window.from, to: window.to });

/** A KPI card counting the records whose status is one value. */
function kpi_widget(status_value, window) {
  return {
    form_group_id: FORM,
    chart_type: "kpi",
    metric: { aggregation: "count" },
    filters: [{ field_id: STATUS, operator: "eq", value: status_value }],
    period: period_of(window || WINDOW),
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
    period: period_of(WINDOW),
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
    period: period_of(WINDOW),
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
    await test_a_period_ending_before_a_departure_reads_the_car_as_in();
    await test_the_previous_period_reads_its_own_state();
    await test_over_time_splits_the_movements_across_hours();
    await test_the_records_table_lists_each_record_as_of_the_end();
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

const kpi_value = async (status_value, window) => (await kpi_of(kpi_widget(status_value, window))).value;

/** The two cards the whole scenario is about, as of 13:59. */
async function test_two_kpi_cards_read_the_same_hours() {
  assert.strictEqual(await kpi_value("in"), 1, 'at 13:59 one car that arrived or moved between 12:00 and 14:00 is in ("cars in")');
  assert.strictEqual(await kpi_value("out"), 2, 'and two are out ("cars out")');
  assert.strictEqual((await kpi_value("in")) + (await kpi_value("out")), 3, "three records are in the window, each counted once");
  assert.strictEqual(await kpi_value("out", HOUR_13), 2, "the 13:00 hour holds the two cars that left then, out at 13:59");
  assert.strictEqual(await kpi_value("in", HOUR_13), 0, "and none of them was in at 13:59");
}

/** The whole point: a period that ends before the car left still says it was in. */
async function test_a_period_ending_before_a_departure_reads_the_car_as_in() {
  assert.strictEqual(await kpi_value("in", HALF_PAST_12), 2, "at 12:30 both cars that arrived at 12:00 were in - RAB 001 had not left yet");
  assert.strictEqual(await kpi_value("out", HALF_PAST_12), 0, "nobody had left by 12:30");
}

/** The comparison figure reads the previous window as IT stood at its end. */
async function test_the_previous_period_reads_its_own_state() {
  const card = await kpi_of(kpi_widget("in", HOUR_13));
  assert.strictEqual(card.value, 0, "no car in the 13:00 hour was in at 13:59");
  assert.strictEqual(card.previous, 2, "in the previous hour (12:00) both arrivals were in at 12:59");
}

/** Each movement lands in the hour it happened, with the value it set. */
async function test_over_time_splits_the_movements_across_hours() {
  const data = await compute_widget_data(over_time_widget(), FORM_VERSION, null);
  assert.ok(Array.isArray(data.rows) && data.rows.length === 2, `two hourly columns, got ${JSON.stringify(data.rows)}`);
  assert.strictEqual(data.rows[0].in, 2, "the 12:00 column holds the two arrivals");
  assert.strictEqual(data.rows[0].out || 0, 0, "and no departure");
  assert.strictEqual(data.rows[1].out, 2, "the 13:00 column holds the two departures");
  assert.strictEqual(data.rows[1].in || 0, 0, "and no arrival");
  let charted = 0;
  data.rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (key !== "label" && key !== "key" && typeof row[key] === "number") charted += row[key];
    });
  });
  assert.strictEqual(charted, 4, "four movements over three cars: the chart counts movements, the cards count cars");
}

/** The records table shows one row per record, with the answers it held at the end. */
async function test_the_records_table_lists_each_record_as_of_the_end() {
  const data = await compute_widget_data(table_widget(), FORM_VERSION, null);
  assert.strictEqual(data.kind, "table", "a table widget computes as a table");
  assert.strictEqual(data.total, 3, "three records were created or moved in the window");
  const rows = data.items.map((item) => `${item.data[PLATE]}=${item.data[STATUS]}`).sort();
  assert.deepStrictEqual(rows, ["RAB 001=out", "RAB 002=in", "RAB 003=out"], "one row per car, as of 13:59");
  assert.strictEqual(new Date(data.as_of).getTime(), new Date(WINDOW.to).getTime(), "the table says what moment it reads as of");
  const earlier = await compute_widget_data(Object.assign(table_widget(), { period: period_of(HALF_PAST_12) }), FORM_VERSION, null);
  assert.deepStrictEqual(earlier.items.map((item) => `${item.data[PLATE]}=${item.data[STATUS]}`).sort(), ["RAB 001=in", "RAB 002=in"], "as of 12:30 both arrivals were in");
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
