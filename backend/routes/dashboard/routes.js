/**
 * Dashboard Analytics Routes
 */

const Router = require('express').Router();
const dashboardController = require('../../controllers/dashboard/dashboard.js');

/**
 * GET /cok/api/dashboard/analytics
 * Get comprehensive dashboard analytics with date filtering
 */
Router.get('/analytics', dashboardController.getDashboardAnalytics);

module.exports = Router;