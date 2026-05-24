/**
 * Routes for Performance Analytics
 * Tracks employee and team performance metrics based on tasks
 */

const Router = require('express').Router()
const { auditSuccess, auditError } = require('../middlewares/audit')
const getEmployeePerformance = require('../controllers/performance/getEmployeePerformance')
const getTeamPerformance = require('../controllers/performance/getTeamPerformance')

// Employee performance endpoint
Router.get(
    '/employee',
    auditSuccess('READ', 'performance_analytics', (req, res, data) => `Viewed employee performance metrics`),
    getEmployeePerformance
)

// Team performance endpoint
Router.get(
    '/team',
    auditSuccess('READ', 'performance_analytics', (req, res, data) => `Viewed team performance metrics`),
    getTeamPerformance
)

// Add error logging middleware
Router.use(auditError('performance'))

module.exports = Router
