/**
 * Proves every widget of every disaster board COMPUTES: an in-memory
 * MongoDB is seeded with DMIS-shaped submissions (the same fields the
 * boards read, spread over the three districts, the five purposes and the
 * months of the year), then every board's widgets are run through
 * compute_dashboard_results - the very function the dashboard endpoint
 * calls - with no filters, with a district filter, and with a period.
 *
 *   node compute_boards.js             (from this folder; needs
 *                                       dc_backend's dev dependency
 *                                       mongodb-memory-server)
 *
 * Writes logs/compute_boards.log: one line per widget with its kind and
 * what came back, and fails loudly on any INVALID or FAILED result, on a
 * text block that carries data, or on a table without its totals.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const BACKEND = path.join(ROOT, "dc_backend");
const { MongoMemoryServer } = require(path.join(BACKEND, "node_modules", "mongodb-memory-server"));
const { MongoClient } = require(path.join(BACKEND, "node_modules", "mongodb"));
const { set_db_handles } = require(path.join(BACKEND, "db_connection", "db.js"));
const { compute_dashboard_results } = require(path.join(BACKEND, "util-dashboard", "compute_results.js"));

const FORM = "ef2401f3-f5ab-4e0e-a02a-ec28e2e76ebd";
const PROJECT = "6aa1be687372ebbcef6e11f2";
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "DMIS_Assessment_Form.json"), "utf8"));
const form_version = { form_group_id: FORM, project_id: PROJECT, version: 1, is_active: true, tracking: null, schema };

const F = {
  DISTRICT: "cascading_select_8dz9o8",
  SECTOR: "cascading_select_v0mxca",
  PURPOSE: "single_select_4d066b",
  INCIDENT_TIME: "date_time_07fa41",
  HOT_CAT: "single_select_101af2",
  HOT_TYPE: "cascading_select_b49b76",
  EXPOSED: "number_b20f56",
  RISK: "single_select_f42575",
  FAC_CAT: "select_group_0756c5",
  FAC_TYPE: "cascading_select_3ec652",
  FAC_STATUS: "single_select_7b7b58",
  HH_NAME: "text_d8f416",
  DEATHS: "number_ca002e",
  INJURED: "number_271ca1",
  TRAUMA: "number_9a0824",
  MISSING: "number_07a4a8",
  DRIVER: "single_select_7c5216",
  HOUSE_DAMAGED: "single_select_998282",
  HOUSE_HOW: "single_select_8c0eb4",
  STRUCTURES: "multi_select_b293aa",
};

// A small deterministic generator, so the log reads the same every run.
let seed = 7;
const rand = () => {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
};
const pick = (list) => list[Math.floor(rand() * list.length)];
const int = (least, most) => least + Math.floor(rand() * (most - least + 1));

const DISTRICTS = ["Gasabo", "Kicukiro", "Nyarugenge"];
const DRIVERS = ["rain_wind", "heavy_rain", "fire", "lightning", "wind"];
const HOUSE_HOW = ["lightly_damaged", "roof_blown_off_d", "walls_damaged", "completely_destroyed", "flooded_water_entered", "high_risk_zone"];
const STRUCTURES = ["latrine", "bathroom", "annex_extension", "kitchen_struct", "fence_enclosure", "retaining_wall_struct"];
const HOT_TYPES = ["riverine_flood", "flash_flood", "ravines", "steep_fragile_slope", "retaining_walls_at_risk", "old_poorly_built_housing", "windstorm", "hailstorm"];
const RISKS = ["high", "high", "moderate", "low", "no_risk"];
const FAC_TYPES = ["irrigation_scheme", "grain_storage_warehouse", "livestock_market", "abattoir", "terraces"];

function record(index) {
  const purpose = pick(["household_loss", "household_loss", "household_loss", "infrastructure", "hotspot", "hotspot", "emergency_response", "preparedness_readiness"]);
  const district = pick(DISTRICTS);
  const when = new Date(Date.UTC(2026, int(0, 7), int(1, 28), int(6, 18)));
  const data = { [F.DISTRICT]: district, [F.SECTOR]: `${district} sector ${int(1, 3)}`, [F.PURPOSE]: purpose, [F.INCIDENT_TIME]: when.toISOString() };
  if (purpose === "household_loss") {
    Object.assign(data, {
      [F.HH_NAME]: `Household ${index}`,
      [F.DEATHS]: rand() < 0.2 ? int(1, 2) : 0,
      [F.INJURED]: rand() < 0.4 ? int(1, 3) : 0,
      [F.TRAUMA]: rand() < 0.2 ? 1 : 0,
      [F.MISSING]: rand() < 0.1 ? 1 : 0,
      [F.DRIVER]: pick(DRIVERS),
      [F.HOUSE_DAMAGED]: rand() < 0.8 ? "yes" : "no",
      [F.HOUSE_HOW]: pick(HOUSE_HOW),
      [F.STRUCTURES]: [pick(STRUCTURES)].concat(rand() < 0.5 ? [pick(STRUCTURES)] : []),
    });
  } else if (purpose === "infrastructure") {
    Object.assign(data, { [F.FAC_CAT]: "agriculture", [F.FAC_TYPE]: pick(FAC_TYPES), [F.FAC_STATUS]: "partially_damaged", [F.DRIVER]: pick(DRIVERS), [F.DEATHS]: 0, [F.INJURED]: int(0, 1) });
  } else if (purpose === "hotspot") {
    Object.assign(data, { [F.HOT_CAT]: "met_hydro", [F.HOT_TYPE]: pick(HOT_TYPES), [F.EXPOSED]: int(1, 60), [F.RISK]: pick(RISKS) });
  }
  return { form_group_id: FORM, version: 1, submitted_at: when, data };
}

const lines = [];
const say = (text) => {
  lines.push(text);
  console.log(text);
};

/** What one result holds, in a few words. */
function describe(result) {
  if (result.error) return `${result.error}: ${(result.messages || []).join("; ")}`;
  if (result.kind === "kpi") return `kpi value=${result.value}${result.legend ? ` legend=${result.legend.length}` : ""}`;
  if (result.kind === "canvas" || result.kind === "text") return result.kind;
  if (result.kind === "table") {
    if (result.mode === "records") return `table/records total=${result.total} page=${result.page}/${result.pages} rows=${(result.items || []).length}`;
    const totals = result.table_totals || {};
    return `table/summary rows=${(result.rows || []).length} columns=${(result.columns || []).length} total_row=${totals.row ? "yes" : "no"} total_column=${totals.column ? "yes" : "no"}`;
  }
  if (result.kind === "tree") return `treemap nodes=${(result.nodes || []).length}`;
  if (result.kind === "time") return `time rows=${(result.rows || []).length} series=${(result.series || []).length} granularity=${result.granularity}`;
  return `${result.kind} rows=${(result.rows || []).length} series=${(result.series || []).length}`;
}

async function main() {
  // A loaded machine can take longer than the library's ten seconds to
  // bring mongod up; a minute is patience, not a hang.
  const server = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  const client = await MongoClient.connect(server.getUri());
  try {
    const db = client.db("data_collection_system");
    const records = Array.from({ length: 240 }, (_, index) => record(index + 1));
    await db.collection("dcs_submissions").insertMany(records);
    await db.collection("dcs_submissions").createIndex({ form_group_id: 1, submitted_at: -1 });
    set_db_handles(db, client.db("cok"));
    say(`# disaster boards computation - ${new Date().toISOString()}`);
    say(`# ${records.length} DMIS-shaped submissions seeded in an in-memory MongoDB`);
    const scenarios = [
      { name: "no filters, all time", body: {} },
      { name: "district = Gasabo", body: { filters: [{ field_id: F.DISTRICT, value: "Gasabo" }] } },
      { name: "period = March 2026", body: { period: { preset: "custom", from: "2026-03-01", to: "2026-03-31" } } },
    ];
    let failures = 0;
    let computed = 0;
    const files = fs.readdirSync(__dirname).filter((name) => name.endsWith(".json")).sort();
    for (const file of files) {
      const document = JSON.parse(fs.readFileSync(path.join(__dirname, file), "utf8"));
      say(`\n== ${file} (${document.widgets.length} widgets)`);
      for (const scenario of scenarios) {
        const started = Date.now();
        const results = await compute_dashboard_results(Object.assign({ widgets: document.widgets }, scenario.body), FORM, form_version, PROJECT);
        say(`-- ${scenario.name} (${Date.now() - started} ms)`);
        results.forEach((result) => {
          const widget = document.widgets.find((entry) => entry.id === result.widget_id) || {};
          const line = `   ${result.widget_id} [${widget.chart_type}] ${describe(result)}${result.board_context && result.board_context.length > 0 ? ` context=${result.board_context.map((entry) => `${entry.role}:${entry.value}`).join(",")}` : ""}`;
          say(line);
          computed += 1;
          if (result.error) failures += 1;
          // A text result carries only its id, its kind and the board context - never data.
          if (result.kind === "text" && result.values && Object.keys(result.values).length > 0) say(`      figures: ${Object.entries(result.values).map(([token, value]) => `${token} = ${value}`).join("; ")}`);
          if (result.kind === "text" && ["rows", "items", "value", "nodes", "points", "legend"].some((key) => key in result)) {
            say("      !! a text block came back with data");
            failures += 1;
          }
          if (result.kind === "table" && result.mode === "summary" && widget.table && widget.table.totals && widget.table.totals.row && result.rows.length > 0 && !(result.table_totals && result.table_totals.row)) {
            say("      !! a summary table asked for a total row and got none");
            failures += 1;
          }
          // A pinned district widget must keep every district under a district filter.
          if (scenario.name === "district = Gasabo" && (widget.pinned_fields || []).includes(F.DISTRICT) && widget.chart_type === "kpi" && (result.board_context || []).some((entry) => entry.field_id === F.DISTRICT)) {
            say("      !! a pinned card followed the district filter");
            failures += 1;
          }
        });
      }
    }
    say(`\n# ${files.length} boards, ${computed} widget results over ${scenarios.length} scenarios, ${failures} failures`);
    fs.mkdirSync(path.join(__dirname, "logs"), { recursive: true });
    fs.writeFileSync(path.join(__dirname, "logs", "compute_boards.log"), lines.join("\n") + "\n");
    if (failures > 0) process.exitCode = 1;
  } finally {
    await client.close();
    await server.stop();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
