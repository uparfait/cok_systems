const Router = require("express").Router();

const authenticate = require("../middlewares/authenticate.js");
const projects_routes = require("./projects/routes.js");
const departments_routes = require("./departments/routes.js");
const forms_routes = require("./forms/routes.js");
const submissions_routes = require("./submissions/routes.js");
const access_control_routes = require("./access_control/routes.js");
const templates_routes = require("./templates/routes.js");
const locations_routes = require("./locations/routes.js");
const public_routes = require("./public/routes.js");

Router.use("/public", public_routes);
Router.use("/projects", authenticate, projects_routes);
Router.use("/departments", authenticate, departments_routes);
Router.use("/forms", authenticate, forms_routes);
Router.use("/submissions", authenticate, submissions_routes);
Router.use("/access-control", authenticate, access_control_routes);
Router.use("/templates", authenticate, templates_routes);
Router.use("/locations", authenticate, locations_routes);

module.exports = Router;
