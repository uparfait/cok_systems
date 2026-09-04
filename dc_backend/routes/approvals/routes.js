const Router = require("express").Router();

const get_my_approvals = require("../../controllers/approvals/get_my_approvals.js");
const get_approval_schedule = require("../../controllers/approvals/get_approval_schedule.js");
const save_approval_schedule = require("../../controllers/approvals/save_approval_schedule.js");
const cancel_approval_schedule = require("../../controllers/approvals/cancel_approval_schedule.js");
const send_approval_links_now = require("../../controllers/approvals/send_approval_links_now.js");
const get_submission_approval_details = require("../../controllers/approvals/get_submission_approval_details.js");

// Authenticated approver dashboard: everything waiting for (or acted on by) the logged-in user.
Router.get("/my", get_my_approvals);

// The data page's scheduling dialog: read, save or cancel a form's approval schedule, or send the links right now.
Router.get("/schedule/:form_group_id", get_approval_schedule);
Router.put("/schedule/:form_group_id", save_approval_schedule);
Router.delete("/schedule/:form_group_id", cancel_approval_schedule);
Router.post("/schedule/:form_group_id/send-now", send_approval_links_now);

// The data table's row-click details: who approved, their message and time, who is still pending.
Router.get("/submission/:submission_id", get_submission_approval_details);

module.exports = Router;
