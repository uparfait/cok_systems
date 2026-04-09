/**
 * Department Manager Routes
 * Routes for department manager functionality
 */

// Import controllers from department_flow folder
const { getVisitorsByStatus } = require('../controllers/department_flow/visitors_by_status');
const { getVisitorsByProvider } = require('../controllers/department_flow/visitors_by_provider');
const { getVisitorsByDepartment } = require('../controllers/department_flow/visitors_by_department');
const { getManagedDepartments, updateDepartment } = require('../controllers/department_flow/department_management');
const { getResponseTimeAnalytics } = require('../controllers/department_flow/analytics');
const { getDepartmentFeedback } = require('../controllers/department_flow/feedback');

const Router = require('express').Router();
const authenticate = require('../middlewares/authenticate');

/**
 * GET /department-manager/visitors/status/:status
 * Fetch visitors by status (pending, active, transferred, completed)
 * Query params: limit, page, dateFilter
 */
Router.get('/visitors/status/:status', authenticate, getVisitorsByStatus);

/**
 * GET /department-manager/visitors/provider/:providerId
 * Fetch visitors by provider with pagination
 * Query params: limit, page, dateFilter
 */
Router.get('/visitors/provider/:providerId', authenticate, getVisitorsByProvider);

/**
 * GET /department-manager/visitors/department/:departmentId
 * Fetch visitors by department with date filtering
 * Query params: limit, page, dateFilter, status
 */
Router.get('/visitors/department/:departmentId', authenticate, getVisitorsByDepartment);

/**
 * GET /department-manager/departments
 * Get departments managed by head of department
 */
Router.get('/departments', authenticate, getManagedDepartments);

/**
 * PUT /department-manager/departments/:departmentId
 * Update department details (name, response time)
 */
Router.put('/departments/:departmentId', authenticate, updateDepartment);

/**
 * GET /department-manager/analytics/response-time
 * Get average response time per provider for department
 */
Router.get('/analytics/response-time', authenticate, getResponseTimeAnalytics);

/**
 * GET /department-manager/feedback
 * Get feedback for managed departments
 * Query params: limit, page, dateFilter, rating
 */
Router.get('/feedback', authenticate, getDepartmentFeedback);

module.exports = Router;