const locations_model = require("../models/locations_model.js");

// The five location template fields keep these exact ids in every form built from the
// location template (scripts/rebuild_location_template.js), so a submission's answers
// for them are where its administrative location lives. Values are location names.
const LOCATION_FIELD_IDS = {
  PROVINCE: "select_group_prvnce",
  DISTRICT: "select_group_dstrct",
  SECTOR: "select_group_sctr",
  CELL: "select_group_cell",
  VILLAGE: "select_group_vllge",
};

// Top-down so each level can be disambiguated by the parent resolved just above it.
const LEVELS_TOP_DOWN = ["PROVINCE", "DISTRICT", "SECTOR", "CELL", "VILLAGE"];

// location_id encodes the hierarchy (province 1 digit, district 2, sector 4, cell 6,
// village 8), so every ancestor id is the id with trailing digits cut off.
const PARENT_DIVISOR = { VILLAGE: 100, CELL: 100, SECTOR: 100, DISTRICT: 10 };
const PARENT_TYPE = { VILLAGE: "CELL", CELL: "SECTOR", SECTOR: "DISTRICT", DISTRICT: "PROVINCE" };

/** All ancestor ids of one location, derived purely from its id digits. */
function ancestor_ids(location_id, type) {
  const ancestors = [];
  let id = Number(location_id);
  let current_type = type;
  while (PARENT_DIVISOR[current_type]) {
    id = Math.floor(id / PARENT_DIVISOR[current_type]);
    ancestors.push(id);
    current_type = PARENT_TYPE[current_type];
  }
  return ancestors;
}

/**
 * Resolves the submission's answered location names into the location_id chain it
 * belongs to (province id, district id, ... down to the deepest answered level).
 * Walks top-down; a level is constrained to its parent only when the level right
 * above it was answered and resolved, so forms collecting only some levels still
 * route as long as each answered name is unambiguous. An ambiguous name (same
 * sector/cell/village name existing in several places with no parent to pick by)
 * ends the walk, returning what resolved so far.
 */
async function resolve_location_chain(data) {
  const chain = new Set();
  let previous_id = null; // id of the level directly above, when that level resolved
  for (const level of LEVELS_TOP_DOWN) {
    const raw = data ? data[LOCATION_FIELD_IDS[level]] : null;
    if (!raw || typeof raw !== "string" || !raw.trim()) {
      previous_id = null;
      continue;
    }
    const matches = await locations_model.find_locations_by_name(level, raw, previous_id);
    if (matches.length !== 1) break;
    chain.add(matches[0].location_id);
    // Ancestors come along too, so an approver set at a higher level always matches.
    ancestor_ids(matches[0].location_id, level).forEach((id) => chain.add(id));
    previous_id = matches[0].location_id;
  }
  return Array.from(chain);
}

module.exports = { LOCATION_FIELD_IDS, resolve_location_chain };
