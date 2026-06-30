/**
 * Dashboard Analytics Routes
 */

const Router = require('express').Router();
const dashboardController = require('../../controllers/dashboard/dashboard.js');

/**
 * @swagger
 * /dashboard/analytics:
 *   get:
 *     summary: "Get dashboard analytics"
 *     description: "Retrieve comprehensive dashboard analytics with optional date filtering. Includes key metrics about visitors, parking, service delivery, and system activity."
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: "Start date for filtering data (YYYY-MM-DD)"
 *         example: "2026-01-01"
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: "End date for filtering data (YYYY-MM-DD)"
 *         example: "2026-12-31"
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [today, week, month, year]
 *         description: "Pre-defined period filter"
 *         example: "month"
 *     responses:
 *       200:
 *         description: Dashboard analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalVisitors:
 *                       type: integer
 *                       example: 1250
 *                     activeVisitors:
 *                       type: integer
 *                       example: 45
 *                     totalParkedVehicles:
 *                       type: integer
 *                       example: 230
 *                     availableParkingSlots:
 *                       type: integer
 *                       example: 120
 *                     averageWaitTime:
 *                       type: string
 *                       example: "12m 30s"
 *                     feedbackAverage:
 *                       type: number
 *                       example: 8.5
 *       500:
 *         description: Internal server error
 */
Router.get('/analytics', dashboardController.getDashboardAnalytics);

module.exports = Router;