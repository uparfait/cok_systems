const Router = require("express").Router();

const generate_test_data = require("../../controllers/test_data/generate_test_data.js");
const get_test_job = require("../../controllers/test_data/get_test_job.js");
const delete_test_data = require("../../controllers/test_data/delete_test_data.js");
const generate_test_approvals = require("../../controllers/test_data/generate_test_approvals.js");
const clear_test_approvals = require("../../controllers/test_data/clear_test_approvals.js");
const get_test_fields = require("../../controllers/test_data/get_test_fields.js");

/**
 * @swagger
 * /dcs/api/test-data/jobs/{job_id}:
 *   get:
 *     summary: Long-poll the progress of a running test-data generation job (pass known_percent to hold until it moves)
 *     tags: [TestData]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Job status fetched successfully
 */
Router.get("/jobs/:job_id", get_test_job);

/**
 * @swagger
 * /dcs/api/test-data/{form_group_id}/generate:
 *   post:
 *     summary: Start generating random test submissions for one form version across a date window at a per-hour rate
 *     tags: [TestData]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       202:
 *         description: Generation job started
 */
Router.post("/:form_group_id/generate", generate_test_data);

/**
 * @swagger
 * /dcs/api/test-data/{form_group_id}/fields:
 *   get:
 *     summary: The number fields (with their ranges), GPS capture and cascades a test-data generation of one version draws from
 *     tags: [TestData]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Generation fields fetched
 */
Router.get("/:form_group_id/fields", get_test_fields);

/**
 * @swagger
 * /dcs/api/test-data/{form_group_id}:
 *   delete:
 *     summary: Delete generated test records of a form (optionally narrowed by a submitted_at range and/or version)
 *     tags: [TestData]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Test data deleted successfully
 */
Router.delete("/:form_group_id", delete_test_data);

/**
 * @swagger
 * /dcs/api/test-data/{form_group_id}/approvals:
 *   post:
 *     summary: Generate approval flows on every test record, one step per selected administrative level of its own location answers
 *     tags: [TestData]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Test approvals generated successfully
 */
Router.post("/:form_group_id/approvals", generate_test_approvals);

/**
 * @swagger
 * /dcs/api/test-data/{form_group_id}/approvals:
 *   delete:
 *     summary: Clear every generated test approval of a form
 *     tags: [TestData]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Test approvals cleared successfully
 */
Router.delete("/:form_group_id/approvals", clear_test_approvals);

module.exports = Router;
