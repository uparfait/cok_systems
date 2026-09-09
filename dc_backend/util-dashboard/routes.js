const Router = require("express").Router();

const get_dashboard = require("./controllers/get_dashboard.js");
const save_dashboard = require("./controllers/save_dashboard.js");
const dashboard_data = require("./controllers/dashboard_data.js");

/**
 * @swagger
 * /dcs/api/projects/{project_id}/dashboard:
 *   get:
 *     summary: Get the project's dashboard configuration (empty default when never saved)
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard fetched successfully
 */
Router.get("/:project_id/dashboard", get_dashboard);

/**
 * @swagger
 * /dcs/api/projects/{project_id}/dashboard:
 *   put:
 *     summary: Save the project's dashboard (validated against the real form schemas, max 30 widgets)
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard saved successfully
 */
Router.put("/:project_id/dashboard", save_dashboard);

/**
 * @swagger
 * /dcs/api/projects/{project_id}/dashboard/data:
 *   post:
 *     summary: Compute the live aggregated data of the requested widgets (native MongoDB pipelines, test data always excluded)
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data fetched successfully
 */
Router.post("/:project_id/dashboard/data", dashboard_data);

module.exports = Router;
