const Router = require("express").Router();

const { get_locations, get_all_locations } = require("../../controllers/locations/get_locations.js");

/**
 * GET /dcs/api/locations
 * Returns locations based on query parameters (cascading filter).
 * No authentication required.
 * Query params: country, province, district, sector, cell
 */
Router.get("/", get_locations);

/**
 * GET /dcs/api/locations/all
 * Returns the full location tree.
 * No authentication required.
 */
Router.get("/all", get_all_locations);

module.exports = Router;
