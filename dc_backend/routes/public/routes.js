const Router = require("express").Router();

const get_public_form = require("../../controllers/forms/get_public_form.js");
const submit_response = require("../../controllers/submissions/submit_response.js");
const upload_file = require("../../controllers/public/upload_file.js");
const delete_uploaded_file = require("../../controllers/public/delete_uploaded_file.js");
const get_approval_by_token = require("../../controllers/approvals/get_approval_by_token.js");
const submit_approval_decision = require("../../controllers/approvals/submit_approval_decision.js");
const upload_approval_file_controller = require("../../controllers/approvals/upload_approval_file.js");
const { upload_submission_file, upload_approval_file } = require("../../utilities/upload.js");

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

/**
 * @swagger
 * /dcs/api/public/approvals/{token}:
 *   get:
 *     summary: Fetch one approver's view of a submission awaiting approval (no auth - the token is the credential)
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: Approval fetched successfully
 *       404:
 *         description: Approval link does not exist
 */
Router.get("/approvals/:token", get_approval_by_token);

/**
 * @swagger
 * /dcs/api/public/approvals/{token}/decision:
 *   post:
 *     summary: Record one approver's approve/reject decision (approve requires a signature or digital certificate)
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: Decision recorded successfully
 *       409:
 *         description: Already decided or not this approver's turn
 *       422:
 *         description: Signature missing for an approval
 */
Router.post("/approvals/:token/decision", submit_approval_decision);

/**
 * @swagger
 * /dcs/api/public/approvals/{token}/upload:
 *   post:
 *     summary: Upload one approver's drawn signature PNG or digital certificate file (no auth - the token is the credential)
 *     tags: [Public]
 *     responses:
 *       201:
 *         description: File uploaded successfully
 *       422:
 *         description: File type or size not allowed
 */
Router.post("/approvals/:token/upload", upload_approval_file.single("file"), upload_approval_file_controller);

module.exports = Router;
