const Router = require("express").Router();

const get_submissions = require("../../controllers/submissions/get_submissions.js");
const delete_submission = require("../../controllers/submissions/delete_submission.js");
const export_submissions = require("../../controllers/submissions/export_submissions.js");
const start_export = require("../../controllers/submissions/start_export.js");
const { get_export_job, download_export, cancel_export } = require("../../controllers/submissions/export_job.js");

Router.get("/export/:form_group_id", export_submissions);

/**
 * @swagger
 * /dcs/api/submissions/export/{form_group_id}/start:
 *   post:
 *     summary: Start a background Excel export of a form's responses (period, from, to, title, language in the body); answers with a job id
 *     tags: [Submissions]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       202:
 *         description: Export started
 * /dcs/api/submissions/export-jobs/{job_id}:
 *   get:
 *     summary: Long-poll progress of an export job (known_percent holds the answer until it moves)
 *     tags: [Submissions]
 * /dcs/api/submissions/export-jobs/{job_id}/download:
 *   get:
 *     summary: Download the finished spreadsheet of an export job
 *     tags: [Submissions]
 * /dcs/api/submissions/export-jobs/{job_id}/cancel:
 *   post:
 *     summary: Stop a running export job
 *     tags: [Submissions]
 */
Router.post("/export/:form_group_id/start", start_export);
Router.get("/export-jobs/:job_id", get_export_job);
Router.get("/export-jobs/:job_id/download", download_export);
Router.post("/export-jobs/:job_id/cancel", cancel_export);

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
