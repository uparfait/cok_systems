require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

// Seeds dcs_locations from the CSV at the repo root ("locations .csv" - note the space in the filename).
// The location_id itself encodes the hierarchy: province 1 digit, district 2, sector 4, cell 6, village 8,
// so each row's parent is just its id with the last digits cut off.
const CSV_PATH = path.resolve(__dirname, "../../locations .csv");
const ROW_REGEX = /^(-?\d+),"([^"]*)","(.*)","([^"]*)"\s*$/;

const PARENT_DIVISOR = { VILLAGE: 100, CELL: 100, SECTOR: 100, DISTRICT: 10 };
const SEEDED_TYPES = new Set(["PROVINCE", "DISTRICT", "SECTOR", "CELL", "VILLAGE"]);

function parse_csv(raw) {
  const documents = [];
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(ROW_REGEX);
    if (!match) continue;
    const [, id_raw, type, name, status] = match;
    if (!SEEDED_TYPES.has(type)) continue;
    const location_id = Number(id_raw);
    const parent_id = type === "PROVINCE" ? null : Math.floor(location_id / PARENT_DIVISOR[type]);
    documents.push({ location_id, type, name: name.trim(), parent_id, status });
  }
  return documents;
}

(async () => {
  const raw = fs.readFileSync(CSV_PATH, "utf8");
  const documents = parse_csv(raw);
  if (documents.length === 0) throw new Error("No location rows parsed from " + CSV_PATH);

  const counts = documents.reduce((acc, doc) => Object.assign(acc, { [doc.type]: (acc[doc.type] || 0) + 1 }), {});
  const client = new MongoClient(process.env.conne_string);
  await client.connect();
  const db = client.db("data_collection_system");
  const collection = db.collection("dcs_locations");

  await collection.deleteMany({});
  await collection.insertMany(documents);
  await collection.createIndex({ location_id: 1 }, { name: "location_id", unique: true });
  await collection.createIndex({ type: 1, parent_id: 1, name: 1 }, { name: "type_parent_name" });

  console.log("Seeded dcs_locations:", counts, "total:", documents.length);
  await client.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
