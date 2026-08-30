const locations_model = require("../../models/locations_model.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Cascading-dropdown feed for the approval builder: all locations of one
 * administrative level, optionally narrowed to one parent (e.g. the sectors
 * of one district). Data comes from dcs_locations, seeded from the repo's
 * locations CSV by scripts/seed_locations.js.
 */
async function get_locations(req, res) {
  try {
    const { type, parent_id } = req.query || {};
    const normalized_type = (type || "").toString().trim().toUpperCase();
    if (!locations_model.LOCATION_TYPES.includes(normalized_type)) {
      return res.status(400).json(warning_response(req, "LOCATION_TYPE_INVALID"));
    }
    const parent = parent_id !== undefined && parent_id !== null && `${parent_id}` !== "" ? Number(parent_id) : null;
    if (parent !== null && !Number.isFinite(parent)) {
      return res.status(400).json(warning_response(req, "LOCATION_TYPE_INVALID"));
    }
    const locations = await locations_model.list_locations(normalized_type, parent);
    return res.status(200).json(success_response(req, "LOCATIONS_FETCHED", locations));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_locations;
