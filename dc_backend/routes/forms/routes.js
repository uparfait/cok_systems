const Router = require("express").Router();

const create_form = require("../../controllers/forms/create_form.js");
const update_form = require("../../controllers/forms/update_form.js");
const get_forms_by_project = require("../../controllers/forms/get_forms_by_project.js");
const get_form_versions = require("../../controllers/forms/get_form_versions.js");
const get_form_by_id = require("../../controllers/forms/get_form_by_id.js");
const set_active_version = require("../../controllers/forms/set_active_version.js");
const delete_form_version = require("../../controllers/forms/delete_form_version.js");

/**
 * @swagger
 * /dcs/api/forms/project/{project_id}:
 *   get:
 *     summary: List the forms belonging to a project (latest version each)
 *     tags: [Forms]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Forms fetched successfully
 */
Router.get("/project/:project_id", get_forms_by_project);

/**
 * @swagger
 * /dcs/api/forms/project/{project_id}:
 *   post:
 *     summary: Create a new form (version 1) under a project
 *     tags: [Forms]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Form created successfully
 */
Router.post("/project/:project_id", create_form);

/**
 * @swagger
 * /dcs/api/forms/{form_group_id}:
 *   get:
 *     summary: Get the currently active version of a form
 *     tags: [Forms]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Form fetched successfully
 */
Router.get("/:form_group_id", get_form_by_id);

/**
 * @swagger
 * /dcs/api/forms/{form_group_id}:
 *   put:
 *     summary: Publish a change as a brand new form version
 *     tags: [Forms]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: A new form version was created
 */
Router.put("/:form_group_id", update_form);

/**
 * @swagger
 * /dcs/api/forms/{form_group_id}/versions:
 *   get:
 *     summary: List every version of a form
 *     tags: [Forms]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Form versions fetched successfully
 */
Router.get("/:form_group_id/versions", get_form_versions);

/**
 * @swagger
 * /dcs/api/forms/{form_group_id}/active-version:
 *   put:
 *     summary: Set which version is currently active
 *     tags: [Forms]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Active version updated successfully
 */
Router.put("/:form_group_id/active-version", set_active_version);

/**
 * @swagger
 * /dcs/api/forms/{form_group_id}/versions/{version}:
 *   delete:
 *     summary: Permanently delete one specific, non-active version of a form
 *     tags: [Forms]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Version deleted successfully
 */
Router.delete("/:form_group_id/versions/:version", delete_form_version);

module.exports = Router;
