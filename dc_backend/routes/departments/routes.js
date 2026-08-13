const Router = require("express").Router();

const list_departments = require("../../controllers/departments/list_departments.js");
const list_department_units = require("../../controllers/departments/list_department_units.js");

/**
 * @swagger
 * /dcs/api/departments:
 *   get:
 *     summary: List top-level departments (read-only, from the main system)
 *     tags: [Departments]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Departments fetched successfully
 */
Router.get("/", list_departments);

/**
 * @swagger
 * /dcs/api/departments/{department_id}/units:
 *   get:
 *     summary: List the units of a department
 *     tags: [Departments]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Department units fetched successfully
 */
Router.get("/:department_id/units", list_department_units);

module.exports = Router;
