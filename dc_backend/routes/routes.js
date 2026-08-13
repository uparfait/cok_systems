const Router = require("express").Router();

const authenticate = require("../middlewares/authenticate.js");
const projects_routes = require("./projects/routes.js");
const departments_routes = require("./departments/routes.js");
const forms_routes = require("./forms/routes.js");
const submissions_routes = require("./submissions/routes.js");
const public_routes = require("./public/routes.js");

Router.use("/public", public_routes);
Router.use("/projects", authenticate, projects_routes);
Router.use("/departments", authenticate, departments_routes);
Router.use("/forms", authenticate, forms_routes);
Router.use("/submissions", authenticate, submissions_routes);

module.exports = Router;
