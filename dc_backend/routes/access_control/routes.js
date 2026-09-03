const Router = require("express").Router();

const get_project_access = require("../../controllers/access_control/get_project_access.js");
const save_project_access = require("../../controllers/access_control/save_project_access.js");
const check_access_email = require("../../controllers/access_control/check_access_email.js");
const suggest_access_users = require("../../controllers/access_control/suggest_access_users.js");

/**
 * @swagger
 * /dcs/api/access-control/project/{project_id}:
 *   get:
 *     summary: Get a project's access rules (empty default when never saved)
 *     tags: [Access control]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Access rules fetched successfully
 */
Router.get("/project/:project_id", get_project_access);

/**
 * @swagger
 * /dcs/api/access-control/project/{project_id}:
 *   put:
 *     summary: Save who may view a project and which of its forms
 *     tags: [Access control]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Access rules saved successfully
 */
Router.put("/project/:project_id", save_project_access);

/**
 * @swagger
 * /dcs/api/access-control/check-email:
 *   post:
 *     summary: Check that an email belongs to a user of the main system
 *     tags: [Access control]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: A matching user was found
 *       404:
 *         description: No user has this email
 */
Router.post("/check-email", check_access_email);

/**
 * @swagger
 * /dcs/api/access-control/suggest-users:
 *   get:
 *     summary: Suggest existing accounts matching a typed name or email
 *     tags: [Access control]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Matching users fetched successfully
 */
Router.get("/suggest-users", suggest_access_users);

module.exports = Router;
