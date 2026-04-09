/**
 * Department Manager Routes
 * Routes for department manager functionality
 */

const Router = require('express').Router();
const departmentManagerController = require('../controllers/department_manager_requests');
const authenticate = require('../middlewares/authenticate');

/**
 * GET /department-manager/visitors/status/:status
 * Fetch visitors by status (pending, active, transferred, completed)
 * Query params: limit, page, dateFilter
 */
Router.get('/visitors/status/:status', authenticate, departmentManagerController.getVisitorsByStatus);

/**
 * GET /department-manager/visitors/provider/:providerId
 * Fetch visitors by provider with pagination
 * Query params: limit, page, dateFilter
 */
Router.get('/visitors/provider/:providerId', authenticate, departmentManagerController.getVisitorsByProvider);

/**
 * GET /department-manager/visitors/department/:departmentId
 * Fetch visitors by department with date filtering
 * Query params: limit, page, dateFilter, status
 */
Router.get('/visitors/department/:departmentId', authenticate, departmentManagerController.getVisitorsByDepartment);

/**
 * GET /department-manager/departments
 * Get departments managed by head of department
 */
Router.get('/departments', authenticate, departmentManagerController.getManagedDepartments);

/**
 * PUT /department-manager/departments/:departmentId
 * Update department details (name, response time)
 */
Router.put('/departments/:departmentId', authenticate, departmentManagerController.updateDepartment);

/**
 * GET /department-manager/analytics/response-time
 * Get average response time per provider for department
 */
Router.get('/analytics/response-time', authenticate, departmentManagerController.getResponseTimeAnalytics);

/**
 * GET /department-manager/feedback
 * Get feedback for managed departments
 * Query params: limit, page, dateFilter, rating
 */
Router.get('/feedback', authenticate, departmentManagerController.getDepartmentFeedback);

module.exports = Router;