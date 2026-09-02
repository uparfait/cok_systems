const Router = require("express").Router();

const get_my_approvals = require("../../controllers/approvals/get_my_approvals.js");

// Authenticated approver dashboard: everything waiting for (or acted on by) the logged-in user.
Router.get("/my", get_my_approvals);

module.exports = Router;
