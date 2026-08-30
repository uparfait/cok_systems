const Router = require("express").Router();

const get_locations = require("../../controllers/locations/get_locations.js");

Router.get("/", get_locations);

module.exports = Router;
