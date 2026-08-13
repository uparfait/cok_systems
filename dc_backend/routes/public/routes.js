const Router = require("express").Router();

const get_public_form = require("../../controllers/forms/get_public_form.js");
const submit_response = require("../../controllers/submissions/submit_response.js");

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

module.exports = Router;
