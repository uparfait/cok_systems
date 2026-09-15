const Router = require("express").Router();

const get_dashboard = require("./controllers/get_dashboard.js");
const save_dashboard = require("./controllers/save_dashboard.js");
const dashboard_data = require("./controllers/dashboard_data.js");
const kpi_skipped = require("./controllers/kpi_skipped.js");
const { list_dashboard_links, create_dashboard_link, update_dashboard_link, delete_dashboard_link } = require("./controllers/dashboard_links.js");

/**
 * @swagger
 * /dcs/api/forms/{form_group_id}/dashboard:
 *   get:
 *     summary: Get the form's dashboard configuration (empty default when never saved)
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard fetched successfully
 */
Router.get("/:form_group_id/dashboard", get_dashboard);

/**
 * @swagger
 * /dcs/api/forms/{form_group_id}/dashboard:
 *   put:
 *     summary: Save the form's dashboard (validated against the form's real schema, max 30 widgets)
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard saved successfully
 */
Router.put("/:form_group_id/dashboard", save_dashboard);

/**
 * @swagger
 * /dcs/api/forms/{form_group_id}/dashboard/data:
 *   post:
 *     summary: Compute the live aggregated data of the form's widgets (native MongoDB pipelines over all records, test data included)
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data fetched successfully
 */
Router.post("/:form_group_id/dashboard/data", dashboard_data);

/**
 * @swagger
 * /dcs/api/forms/{form_group_id}/dashboard/kpi-skipped:
 *   post:
 *     summary: List the answers a numeric KPI widget skipped (not readable as numbers) inside its current window
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Skipped entries fetched successfully
 */
Router.post("/:form_group_id/dashboard/kpi-skipped", kpi_skipped);

/**
 * @swagger
 * /dcs/api/forms/{form_group_id}/dashboard/links:
 *   get:
 *     summary: List the form dashboard's public share links (form editors only)
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 *   post:
 *     summary: Create a public share link (title, description, optional expiry) for the form's dashboard
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 */
Router.get("/:form_group_id/dashboard/links", list_dashboard_links);
Router.post("/:form_group_id/dashboard/links", create_dashboard_link);

/**
 * @swagger
 * /dcs/api/forms/{form_group_id}/dashboard/links/{link_id}:
 *   patch:
 *     summary: Edit a share link's title, description or expiry
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 *   delete:
 *     summary: Delete a share link - the public page stops opening at once
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 */
Router.patch("/:form_group_id/dashboard/links/:link_id", update_dashboard_link);
Router.delete("/:form_group_id/dashboard/links/:link_id", delete_dashboard_link);

module.exports = Router;
