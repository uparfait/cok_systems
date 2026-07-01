/**
 * Department Manager Routes
 * Routes for department manager functionality
 */

// Import controllers from department_flow folder
const { getVisitorsByStatus } = require('../controllers/department_flow/visitors_by_status');
const { getVisitorsByProvider } = require('../controllers/department_flow/visitors_by_provider');
const { getVisitorsByDepartment } = require('../controllers/department_flow/visitors_by_department');
const { getManagedDepartments, updateDepartment } = require('../controllers/department_flow/department_management');
const { getDepartmentFeedback } = require('../controllers/department_flow/feedback');

const Router = require('express').Router();
const authenticate = require('../middlewares/authenticate');

/**
 * @swagger
 * /department-manager/visitors/status/{status}:
 *   get:
 *     summary: "Get visitors by status"
 *     description: "Fetch visitors filtered by service status (pending, active, transferred, completed). Supports pagination and date filtering."
 *     tags: [Department Manager]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *           enum: [pending, active, transferred, completed]
 *         description: "Service status to filter by"
 *         example: "active"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         example: 20
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         example: 1
 *       - in: query
 *         name: dateFilter
 *         schema:
 *           type: string
 *         description: "Date filter (today, week, month, or specific date YYYY-MM-DD)"
 *     responses:
 *       200:
 *         description: Visitors by status retrieved successfully
 *       400:
 *         description: Invalid status value
 *       500:
 *         description: Internal server error
 */
Router.get('/visitors/status/:status', authenticate, getVisitorsByStatus);

/**
 * @swagger
 * /department-manager/visitors/provider/{providerId}:
 *   get:
 *     summary: "Get visitors by provider"
 *     description: "Fetch visitors assigned to a specific service provider with pagination."
 *     tags: [Department Manager]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: providerId
 *         required: true
 *         schema:
 *           type: string
 *         description: "Provider's MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: dateFilter
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Visitors by provider retrieved successfully
 *       404:
 *         description: Provider not found
 *       500:
 *         description: Internal server error
 */
Router.get('/visitors/provider/:providerId', authenticate, getVisitorsByProvider);

/**
 * @swagger
 * /department-manager/visitors/department/{departmentId}:
 *   get:
 *     summary: "Get visitors by department"
 *     description: "Fetch visitors for a specific department with date filtering and status filtering."
 *     tags: [Department Manager]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: departmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: "Department MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: dateFilter
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: "Filter by service status"
 *     responses:
 *       200:
 *         description: Visitors by department retrieved successfully
 *       404:
 *         description: Department not found
 *       500:
 *         description: Internal server error
 */
Router.get('/visitors/department/:departmentId', authenticate, getVisitorsByDepartment);

/**
 * @swagger
 * /department-manager/departments:
 *   get:
 *     summary: "Get managed departments"
 *     description: "Get departments managed by the authenticated head of department."
 *     tags: [Department Manager]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Managed departments retrieved successfully
 *       500:
 *         description: Internal server error
 */
Router.get('/departments', authenticate, getManagedDepartments);

/**
 * @swagger
 * /department-manager/departments/{departmentId}:
 *   put:
 *     summary: "Update department details"
 *     description: "Update department name, response time, and other configuration. For department managers."
 *     tags: [Department Manager]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: departmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: "Department MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               department_name:
 *                 type: string
 *                 example: "Service d'Urbanisme"
 *               department_response_time_in_minutes:
 *                 type: integer
 *                 example: 5
 *     responses:
 *       200:
 *         description: Department updated successfully
 *       404:
 *         description: Department not found
 *       500:
 *         description: Internal server error
 */
Router.put('/departments/:departmentId', authenticate, updateDepartment);

/**
 * @swagger
 * /department-manager/feedback:
 *   get:
 *     summary: "Get department feedback"
 *     description: "Get feedback for departments managed by the authenticated user. Supports pagination and rating filtering."
 *     tags: [Department Manager]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: dateFilter
 *         schema:
 *           type: string
 *       - in: query
 *         name: rating
 *         schema:
 *           type: integer
 *         description: "Filter by minimum rating (1-10)"
 *     responses:
 *       200:
 *         description: Department feedback retrieved successfully
 *       500:
 *         description: Internal server error
 */
Router.get('/feedback', authenticate, getDepartmentFeedback);

module.exports = Router;