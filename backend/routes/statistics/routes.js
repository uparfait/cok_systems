/**
 * Statistics routes
 */

const Router = require('express').Router();

const multer = require('multer')
const upload = multer()
const statisticsController = require('../../controllers/statistics/statistics.js');

Router.use(upload.any())

/**
 * Global Interceptor for Multer Errors
 */
Router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError || error) {
        console.warn('[UPLOAD WARNING]: Handled unexpected or empty input:', error.message)
        req.body = req.body || {}
        return next()
    }
    next()
})

/**
 * @swagger
 * /statistics/roles-permissions:
 *   get:
 *     summary: "Get roles with permissions"
 *     description: "Retrieve all roles with their associated permissions for system configuration."
 *     tags: [Statistics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Roles and permissions data retrieved
 *       500:
 *         description: Internal server error
 */
Router.get('/roles-permissions', statisticsController.getRolesWithPermissions);

/**
 * @swagger
 * /statistics/departments-leaders:
 *   get:
 *     summary: "Get departments with leaders"
 *     description: "Retrieve all departments along with their assigned leaders."
 *     tags: [Statistics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Departments with leaders retrieved
 *       500:
 *         description: Internal server error
 */
Router.get('/departments-leaders', statisticsController.getDepartmentsWithLeaders);

/**
 * @swagger
 * /statistics/employees:
 *   get:
 *     summary: "Get employee statistics"
 *     description: "Retrieve aggregated employee statistics including total count, active/inactive, and department distribution."
 *     tags: [Statistics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Employee statistics retrieved
 *       500:
 *         description: Internal server error
 */
Router.get('/employees', statisticsController.getEmployeeStats);

/**
 * @swagger
 * /statistics/emergency-cars:
 *   get:
 *     summary: "Get emergency cars statistics"
 *     description: "Retrieve statistics about emergency/reserved vehicles."
 *     tags: [Statistics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Emergency cars statistics retrieved
 *       500:
 *         description: Internal server error
 */
Router.get('/emergency-cars', statisticsController.getEmergencyCarsStats);

/**
 * @swagger
 * /statistics/flagged-vehicles:
 *   get:
 *     summary: "Get flagged vehicles statistics"
 *     description: "Retrieve statistics about flagged vehicles including count and reasons."
 *     tags: [Statistics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Flagged vehicles statistics retrieved
 *       500:
 *         description: Internal server error
 */
Router.get('/flagged-vehicles', statisticsController.getFlaggedVehiclesStats);

/**
 * @swagger
 * /statistics/currently-parked:
 *   get:
 *     summary: "Get currently parked statistics"
 *     description: "Retrieve statistics about currently parked vehicles including counts by driver type."
 *     tags: [Statistics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Currently parked statistics retrieved
 *       500:
 *         description: Internal server error
 */
Router.get('/currently-parked', statisticsController.getCurrentlyParkedStats);

/**
 * @swagger
 * /statistics/service-delivery:
 *   get:
 *     summary: "Get service delivery statistics"
 *     description: "Retrieve aggregated service delivery statistics including total visitors, in-house, completed, and by department."
 *     tags: [Statistics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Service delivery statistics retrieved
 *       500:
 *         description: Internal server error
 */
Router.get('/service-delivery', statisticsController.getServiceDeliveryStats);

/**
 * @swagger
 * /statistics/feedback-totals:
 *   get:
 *     summary: "Get feedback totals"
 *     description: "Retrieve total feedback counts and average ratings."
 *     tags: [Statistics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Feedback totals retrieved
 *       500:
 *         description: Internal server error
 */
Router.get('/feedback-totals', statisticsController.getFeedbackTotals);

/**
 * @swagger
 * /statistics/feedback-average:
 *   get:
 *     summary: "Get feedback average by department"
 *     description: "Retrieve average feedback ratings grouped by department."
 *     tags: [Statistics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Feedback averages retrieved
 *       500:
 *         description: Internal server error
 */
Router.get('/feedback-average', statisticsController.getFeedbackAverageByDepartment);

/**
 * @swagger
 * /statistics/hourly-parking:
 *   get:
 *     summary: "Get hourly parking statistics"
 *     description: "Retrieve hourly parking activity statistics for graph visualization."
 *     tags: [Statistics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Hourly parking statistics retrieved
 *       500:
 *         description: Internal server error
 */
Router.get('/hourly-parking', statisticsController.getHourlyParkingStats);

/**
 * @swagger
 * /statistics/hourly-service-delivery:
 *   get:
 *     summary: "Get hourly service delivery statistics"
 *     description: "Retrieve hourly service delivery activity for graph visualization."
 *     tags: [Statistics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Hourly service delivery statistics retrieved
 *       500:
 *         description: Internal server error
 */
Router.get('/hourly-service-delivery', statisticsController.getHourlyServiceDeliveryStats);

/**
 * @swagger
 * /statistics/employee-performance/tasks:
 *   get:
 *     summary: "Get employee performance by tasks"
 *     description: "Retrieve employee performance metrics based on task completion."
 *     tags: [Statistics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Employee task performance retrieved
 *       500:
 *         description: Internal server error
 */
Router.get('/employee-performance/tasks', statisticsController.getEmployeePerformanceByTasks);

/**
 * @swagger
 * /statistics/employee-performance/tasks-done:
 *   get:
 *     summary: "Get employee performance by tasks done"
 *     description: "Retrieve employee performance based on completed tasks count."
 *     tags: [Statistics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Employee tasks done performance retrieved
 *       500:
 *         description: Internal server error
 */
Router.get('/employee-performance/tasks-done', statisticsController.getEmployeePerformanceByTasksDone);

/**
 * @swagger
 * /statistics/waiting-time-analytics:
 *   get:
 *     summary: "Get waiting time analytics"
 *     description: "Retrieve analytics on visitor waiting times across departments."
 *     tags: [Statistics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Waiting time analytics retrieved
 *       500:
 *         description: Internal server error
 */
Router.get('/waiting-time-analytics', statisticsController.getWaitingTimeAnalytics);

/**
 * @swagger
 * /statistics/employee-performance/service:
 *   get:
 *     summary: "Get employee performance by service"
 *     description: "Retrieve employee performance metrics based on service delivery."
 *     tags: [Statistics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Employee service performance retrieved
 *       500:
 *         description: Internal server error
 */
Router.get('/employee-performance/service', statisticsController.getEmployeePerformanceByService);

/**
 * @swagger
 * /statistics/served:
 *   get:
 *     summary: "Get served statistics for the overview dashboard"
 *     description: "Server-side aggregation of service delivery records: total visitors, hourly check-ins, served counts by department (with busiest employee) and by employee. Accepts optional from/to ISO date query params."
 *     tags: [Statistics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Served statistics retrieved
 *       500:
 *         description: Internal server error
 */
Router.get('/served', statisticsController.getServedStatistics);

module.exports = Router;