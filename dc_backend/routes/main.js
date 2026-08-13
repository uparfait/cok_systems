const Router = require("express").Router();
const ALL_ROUTES = require("./routes.js");

Router.use(ALL_ROUTES);

module.exports = Router;
