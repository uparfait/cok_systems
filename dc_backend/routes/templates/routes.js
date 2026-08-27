const Router = require("express").Router();

const create_template = require("../../controllers/templates/create_template.js");
const get_templates = require("../../controllers/templates/get_templates.js");
const get_template_by_id = require("../../controllers/templates/get_template_by_id.js");
const get_template_field_options = require("../../controllers/templates/get_template_field_options.js");
const update_template = require("../../controllers/templates/update_template.js");
const delete_template = require("../../controllers/templates/delete_template.js");

/**
 * @swagger
 * /dcs/api/templates:
 *   get:
 *     summary: List every field template (name and description only)
 *     tags: [Templates]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Templates fetched successfully
 */
Router.get("/", get_templates);

/**
 * @swagger
 * /dcs/api/templates:
 *   post:
 *     summary: Create a new field template
 *     tags: [Templates]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Template created successfully
 */
Router.post("/", create_template);

/**
 * @swagger
 * /dcs/api/templates/{template_id}:
 *   get:
 *     summary: Get one template's full document, including its fields
 *     tags: [Templates]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Template fetched successfully
 */
Router.get("/:template_id", get_template_by_id);

/**
 * @swagger
 * /dcs/api/templates/{template_id}/field-options/{field_id}:
 *   get:
 *     summary: Resolve the real option content for one lazily-loaded select_group/cascading_select field (optionally filtered by a parent answer)
 *     tags: [Templates]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Template fetched successfully
 */
Router.get("/:template_id/field-options/:field_id", get_template_field_options);

/**
 * @swagger
 * /dcs/api/templates/{template_id}:
 *   put:
 *     summary: Update a template's name, description and/or fields
 *     tags: [Templates]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Template updated successfully
 */
Router.put("/:template_id", update_template);

/**
 * @swagger
 * /dcs/api/templates/{template_id}:
 *   delete:
 *     summary: Permanently delete a template
 *     tags: [Templates]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Template deleted successfully
 */
Router.delete("/:template_id", delete_template);

module.exports = Router;
