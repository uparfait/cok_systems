const { get_db } = require("../db_connection/db.js");

const COLLECTION_NAME = "dcs_locations";

// Rwanda administrative levels, ordered bottom-up - the approval flow walks this exact order.
const LOCATION_TYPES = ["VILLAGE", "CELL", "SECTOR", "DISTRICT", "PROVINCE"];

/** Escapes a string so it can be used as a literal inside a regex. */
function escape_regex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Both lookups the app makes: children of a parent for cascading dropdowns, and name resolution per level. */
async function ensure_location_indexes() {
  const collection = get_db().collection(COLLECTION_NAME);
  await collection.createIndex({ location_id: 1 }, { name: "location_id", unique: true });
  await collection.createIndex({ type: 1, parent_id: 1, name: 1 }, { name: "type_parent_name" });
}

/** Children of one parent (or all of a type when parent_id is null), sorted for dropdowns. */
async function list_locations(type, parent_id) {
  const filter = { type, status: "ACTIVE" };
  if (parent_id !== undefined && parent_id !== null) filter.parent_id = Number(parent_id);
  return get_db()
    .collection(COLLECTION_NAME)
    .find(filter, { projection: { _id: 0, location_id: 1, type: 1, name: 1, parent_id: 1 } })
    .sort({ name: 1 })
    .toArray();
}

/** Case-insensitive exact-name matches at one level, optionally constrained to a parent - used to route submissions. */
async function find_locations_by_name(type, name, parent_id) {
  const filter = { type, status: "ACTIVE", name: new RegExp(`^${escape_regex(String(name).trim())}$`, "i") };
  if (parent_id !== undefined && parent_id !== null) filter.parent_id = Number(parent_id);
  return get_db()
    .collection(COLLECTION_NAME)
    .find(filter, { projection: { _id: 0, location_id: 1, type: 1, name: 1, parent_id: 1 } })
    .toArray();
}

/** Wipes and re-inserts the whole location set - only ever called by the seed script. */
async function replace_all_locations(documents) {
  const collection = get_db().collection(COLLECTION_NAME);
  await collection.deleteMany({});
  if (documents.length > 0) await collection.insertMany(documents);
  return documents.length;
}

async function count_locations() {
  return get_db().collection(COLLECTION_NAME).countDocuments({});
}

module.exports = {
  LOCATION_TYPES,
  ensure_location_indexes,
  list_locations,
  find_locations_by_name,
  replace_all_locations,
  count_locations,
};
