const Router = require("express").Router();

const create_project = require("../../controllers/projects/create_project.js");
const get_projects = require("../../controllers/projects/get_projects.js");
const get_project_by_id = require("../../controllers/projects/get_project_by_id.js");
const update_project = require("../../controllers/projects/update_project.js");
const delete_project = require("../../controllers/projects/delete_project.js");

/**
 * @swagger
 * /dcs/api/projects:
 *   get:
 *     summary: List all data collection projects
 *     tags: [Projects]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Projects fetched successfully
 */
Router.get("/", get_projects);

/**
 * @swagger
 * /dcs/api/projects:
 *   post:
 *     summary: Create a new data collection project
 *     tags: [Projects]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Project created successfully
 */
Router.post("/", create_project);

/**
 * @swagger
 * /dcs/api/projects/{project_id}:
 *   get:
 *     summary: Get one project's details
 *     tags: [Projects]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Project fetched successfully
 */
Router.get("/:project_id", get_project_by_id);

/**
 * @swagger
 * /dcs/api/projects/{project_id}:
 *   put:
 *     summary: Update a project's details
 *     tags: [Projects]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Project updated successfully
 */
Router.put("/:project_id", update_project);

/**
 * @swagger
 * /dcs/api/projects/{project_id}:
 *   delete:
 *     summary: Permanently delete a project, its forms and all collected data
 *     tags: [Projects]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Project deleted successfully
 */
Router.delete("/:project_id", delete_project);

module.exports = Router;
