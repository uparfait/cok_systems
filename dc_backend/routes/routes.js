const Router = require("express").Router();

const authenticate = require("../middlewares/authenticate.js");
const { authorize_dcs, except } = require("../middlewares/authorize_dcs.js");
const projects_routes = require("./projects/routes.js");
const departments_routes = require("./departments/routes.js");
const forms_routes = require("./forms/routes.js");
const submissions_routes = require("./submissions/routes.js");
const access_control_routes = require("./access_control/routes.js");
const templates_routes = require("./templates/routes.js");
const public_routes = require("./public/routes.js");
const approvals_routes = require("./approvals/routes.js");
const test_data_routes = require("./test_data/routes.js");
const dashboard_routes = require("../util-dashboard/routes.js");

// Every authenticated route also requires the caller's role to carry the
// DCS link (see middlewares/authorize_dcs.js). The approver dashboard
// (/approvals/my) is the one exception: an approver is a designated
// person, not necessarily a DCS user, so being signed in is enough there.
Router.use("/public", public_routes);
Router.use("/projects", authenticate, authorize_dcs, projects_routes);
Router.use("/forms", authenticate, authorize_dcs, dashboard_routes);
Router.use("/departments", authenticate, authorize_dcs, departments_routes);
Router.use("/forms", authenticate, authorize_dcs, forms_routes);
Router.use("/submissions", authenticate, authorize_dcs, submissions_routes);
Router.use("/access-control", authenticate, authorize_dcs, access_control_routes);
Router.use("/templates", authenticate, authorize_dcs, templates_routes);
Router.use("/approvals", authenticate, except(["/my"], authorize_dcs), approvals_routes);
Router.use("/test-data", authenticate, authorize_dcs, test_data_routes);

module.exports = Router;
