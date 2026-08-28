const Router = require("express").Router();

const get_submissions = require("../../controllers/submissions/get_submissions.js");
const delete_submission = require("../../controllers/submissions/delete_submission.js");
const export_submissions = require("../../controllers/submissions/export_submissions.js");

Router.get("/export/:form_group_id", export_submissions);

/**
 * @swagger
 * /dcs/api/submissions/{form_group_id}:
 *   get:
 *     summary: Paginated list of collected submissions for a form
 *     tags: [Submissions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: version
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Submissions fetched successfully
 */
Router.get("/:form_group_id", get_submissions);

/**
 * @swagger
 * /dcs/api/submissions/record/{submission_id}:
 *   delete:
 *     summary: Permanently delete one specific collected response
 *     tags: [Submissions]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Submission deleted successfully
 */
Router.delete("/record/:submission_id", delete_submission);

module.exports = Router;
