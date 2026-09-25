const assert = require("assert");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { MongoClient, ObjectId } = require("mongodb");
const { set_db_handles } = require("../db_connection/db.js");

/**
 * The dashboard side of the stage reading, computed through the real
 * dashboard code (util-dashboard/widget_data.js) rather than hand-built
 * pipelines.
 *
 * The scenario is the smart-parking one this exists for. A car is recorded
 * on arrival with status "in" and the SAME record is labelled "out" when it
 * leaves, so the two things a dashboard must be able to say are:
 *
 *   KPI "cars in"   over 12:00-14:00  ->  the arrivals in that window
 *   KPI "cars out"  over 12:00-14:00  ->  the departures in that window
 *
 * both over the very same hours, and an OVER TIME chart that puts each
 * movement in the hour it happened rather than piling everything onto the
 * hour each record first arrived.
 */

const FORM = "dash-parking";
const PLATE = "plate_f";
const STATUS = "status_f";
const TRACKING = { enabled: true, key_field_id: PLATE, key_unique: false, editable_field_ids: [STATUS] };

const T12 = new Date("2026-09-25T12:00:00Z");
const T13 = new Date("2026-09-25T13:00:00Z");
const YESTERDAY = new Date("2026-09-24T08:00:00Z");

// 12:00 up to (not including) 14:00, stated to the millisecond.
const WINDOW = { from: "2026-09-25T12:00:00.000Z", to: "2026-09-25T13:59:59.999Z" };

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
  // Arrived 12:00, left 13:00 - both inside the window.
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
  // Arrived YESTERDAY, left 13:00 today. Its departure belongs to the
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
    await test_a_kpi_card_counts_the_stage_not_the_record();
    await test_over_time_splits_the_movements_across_hours();
    await test_kpi_totals_match_the_over_time_columns();
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
  assert.strictEqual(cars_in, 2, 'two cars arrived between 12:00 and 14:00 ("cars in")');
  assert.strictEqual(cars_out, 2, 'two cars left between 12:00 and 14:00 ("cars out")');
}

/**
 * RAB 001 is a single record that was BOTH an arrival and a departure in
 * this window. If the cards counted records rather than stages, it could
 * only ever be on one of them.
 */
async function test_a_kpi_card_counts_the_stage_not_the_record() {
  const cars_in = await kpi_value("in");
  const cars_out = await kpi_value("out");
  assert.strictEqual(
    cars_in + cars_out,
    4,
    "three records produced four movements in the window, and both cards see their own",
  );
  // And the record that arrived yesterday is counted as a departure only.
  const only_out = await kpi_of(
    Object.assign(kpi_widget("out"), { period: { preset: "custom", from: "2026-09-25T13:00:00.000Z", to: "2026-09-25T13:59:59.999Z" } }),
  );
  assert.strictEqual(only_out.value, 2, "the 13:00 hour holds exactly the two departures");
}

/** Each movement lands in the hour it happened. */
async function test_over_time_splits_the_movements_across_hours() {
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
  assert.strictEqual(
    /in=2/.test(joined),
    true,
    `the 12:00 column must hold the two arrivals, got: ${joined}`,
  );
  assert.strictEqual(
    /out=2/.test(joined),
    true,
    `the 13:00 column must hold the two departures, got: ${joined}`,
  );
}

/** The cards and the chart are two readings of one set of stages. */
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
  assert.strictEqual(
    charted,
    cars_in + cars_out,
    "the chart's columns add up to exactly what the two cards count between them",
  );
}

/** With no period at all, a register reads as it stands right now. */
async function test_an_unbounded_period_reads_today() {
  const all_out = await kpi_of(Object.assign(kpi_widget("out"), { period: { preset: "all" } }));
  const all_in = await kpi_of(Object.assign(kpi_widget("in"), { period: { preset: "all" } }));
  // Unbounded means every stage the register holds, which is every
  // movement ever recorded: three arrivals and two departures.
  assert.strictEqual(all_in.value, 3, "every car ever recorded arrived once");
  assert.strictEqual(all_out.value, 2, "two of them have left");
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
