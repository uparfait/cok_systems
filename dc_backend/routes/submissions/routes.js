const Router = require("express").Router();

const get_submissions = require("../../controllers/submissions/get_submissions.js");

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

module.exports = Router;
