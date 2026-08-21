const Router = require("express").Router();

const get_public_form = require("../../controllers/forms/get_public_form.js");
const submit_response = require("../../controllers/submissions/submit_response.js");
const upload_file = require("../../controllers/public/upload_file.js");
const delete_uploaded_file = require("../../controllers/public/delete_uploaded_file.js");
const { upload_submission_file } = require("../../utilities/upload.js");

/**
 * @swagger
 * /dcs/api/public/forms/{form_group_id}:
 *   get:
 *     summary: Fetch the active version of a form for data collection (no auth)
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: Form fetched successfully
 *       409:
 *         description: Form has no active version
 *       404:
 *         description: Form link does not exist
 */
Router.get("/forms/:form_group_id", get_public_form);

/**
 * @swagger
 * /dcs/api/public/forms/{form_group_id}/submit:
 *   post:
 *     summary: Submit a response to a form (no auth, server re-validates everything)
 *     tags: [Public]
 *     responses:
 *       201:
 *         description: Response submitted successfully
 *       422:
 *         description: Response failed validation
 */
Router.post("/forms/:form_group_id/submit", submit_response);

/**
 * @swagger
 * /dcs/api/public/forms/{form_group_id}/upload:
 *   post:
 *     summary: Upload one respondent-provided file for a media field (no auth) - saved to disk, only its URL is ever stored
 *     tags: [Public]
 *     responses:
 *       201:
 *         description: File uploaded successfully
 *       422:
 *         description: File type or size not allowed for this field
 */
Router.post("/forms/:form_group_id/upload", upload_submission_file.single("file"), upload_file);

/**
 * @swagger
 * /dcs/api/public/forms/{form_group_id}/upload:
 *   delete:
 *     summary: Delete a respondent-uploaded file no longer referenced (replaced or removed) - no auth
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: File deleted (or was already gone)
 */
Router.delete("/forms/:form_group_id/upload", delete_uploaded_file);

module.exports = Router;
