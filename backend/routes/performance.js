/**
 * Routes for Performance Analytics
 * Tracks employee and team performance metrics based on tasks
 */

const Router = require('express').Router()
const { auditSuccess, auditError } = require('../middlewares/audit')
const getEmployeePerformance = require('../controllers/performance/getEmployeePerformance')
const getTeamPerformance = require('../controllers/performance/getTeamPerformance')

/**
 * @swagger
 * /performance/employee:
 *   get:
 *     summary: "Get employee performance metrics"
 *     description: "Retrieve performance metrics for individual employees based on task completion, service delivery, and other KPIs."
 *     tags: [Performance]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: employeeId
 *         schema:
 *           type: string
 *         description: "Employee MongoDB ObjectId (defaults to authenticated user)"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [today, week, month, year]
 *         description: "Time period for metrics"
 *         example: "month"
 *     responses:
 *       200:
 *         description: Employee performance metrics retrieved successfully
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
 *                     tasksCompleted:
 *                       type: integer
 *                       example: 15
 *                     tasksInProgress:
 *                       type: integer
 *                       example: 3
 *                     overdueTasks:
 *                       type: integer
 *                       example: 1
 *                     averageCompletionTime:
 *                       type: string
 *                       example: "2d 4h"
 *                     serviceRating:
 *                       type: number
 *                       example: 8.5
 *                     visitorsServed:
 *                       type: integer
 *                       example: 42
 *       500:
 *         description: Internal server error
 */
Router.get(
    '/employee',
    auditSuccess('READ', 'performance_analytics', (req, res, data) => `Viewed employee performance metrics`),
    getEmployeePerformance
)

/**
 * @swagger
 * /performance/team:
 *   get:
 *     summary: "Get team performance metrics"
 *     description: "Retrieve aggregate performance metrics for a department team. Shows collective task completion, service delivery stats, and team ratings."
 *     tags: [Performance]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *         description: "Department MongoDB ObjectId (defaults to user's department)"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [today, week, month, year]
 *         description: "Time period for metrics"
 *         example: "month"
 *     responses:
 *       200:
 *         description: Team performance metrics retrieved successfully
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
 *                     totalEmployees:
 *                       type: integer
 *                       example: 25
 *                     totalTasksCompleted:
 *                       type: integer
 *                       example: 120
 *                     averageTaskCompletionRate:
 *                       type: number
 *                       example: 85.5
 *                     totalVisitorsServed:
 *                       type: integer
 *                       example: 350
 *                     averageServiceRating:
 *                       type: number
 *                       example: 8.2
 *                     topPerformers:
 *                       type: array
 *       500:
 *         description: Internal server error
 */
Router.get(
    '/team',
    auditSuccess('READ', 'performance_analytics', (req, res, data) => `Viewed team performance metrics`),
    getTeamPerformance
)

// Add error logging middleware
Router.use(auditError('performance'))

module.exports = Router