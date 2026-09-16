const Router = require("express").Router();

const get_dashboard = require("./controllers/get_dashboard.js");
const save_dashboard = require("./controllers/save_dashboard.js");
const dashboard_data = require("./controllers/dashboard_data.js");
const kpi_skipped = require("./controllers/kpi_skipped.js");
const filter_values = require("./controllers/filter_values.js");
const { list_dashboard_links, create_dashboard_link, update_dashboard_link, delete_dashboard_link } = require("./controllers/dashboard_links.js");
const { list_dashboards, create_dashboard, rename_dashboard, delete_dashboard, get_dashboard_by_id, save_dashboard_by_id } = require("./controllers/dashboards.js");

/**
 * @swagger
 * /dcs/api/forms/{form_group_id}/dashboards:
 *   get:
 *     summary: List the form's named dashboards (id, name, widget count)
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 *   post:
 *     summary: Create a named dashboard for the form (form editors only)
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 */
Router.get("/:form_group_id/dashboards", list_dashboards);
Router.post("/:form_group_id/dashboards", create_dashboard);

/**
 * @swagger
 * /dcs/api/forms/{form_group_id}/dashboards/{dashboard_id}:
 *   get:
 *     summary: One dashboard's widgets
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 *   put:
 *     summary: Save one dashboard's widgets (validated against the form's schema)
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 *   patch:
 *     summary: Rename a dashboard
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 *   delete:
 *     summary: Delete a dashboard and its share links
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 */
Router.get("/:form_group_id/dashboards/:dashboard_id", get_dashboard_by_id);
Router.put("/:form_group_id/dashboards/:dashboard_id", save_dashboard_by_id);
Router.patch("/:form_group_id/dashboards/:dashboard_id", rename_dashboard);
Router.delete("/:form_group_id/dashboards/:dashboard_id", delete_dashboard);

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
 * /dcs/api/forms/{form_group_id}/dashboard/filter-values:
 *   post:
 *     summary: The values a board filter field can take (distinct answers under the period and the other applied filters)
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 */
Router.post("/:form_group_id/dashboard/filter-values", filter_values);

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
