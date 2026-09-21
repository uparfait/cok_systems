/**
 * This file combines all routes together and can be rewritten.
 *
 * Every mount below is authenticated, then authorized against the caller's
 * role navigation (middlewares/authorize.js + utilities/access_policy.js):
 * a role only reaches the APIs of the systems its sidebar links open. Route
 * files that mix public and protected endpoints, or need per-route
 * granularity (employees, departments, roles, feedback), carry their own
 * authorize() calls inside.
 */

const Router = require('express').Router()

const service_delivery = require("./service_delivery/routes.js")
const smartparking = require("./smartparking/routes.js")
const auth = require("./auth/routes.js")
const audit = require("./audit/routes.js")
const department = require('./department_crud/routes.js')
const employee = require("./employee_crud/routes.js")
const system_permission = require("./system_permission/routes.js")
const docs = require("./docs/routes.js")
const feedback = require("./feedback/routes.js")
const authenticate = require('../middlewares/authenticate.js')
const { authorize, authorizeByMethod } = require('../middlewares/authorize.js')
const { GROUPS } = require('../utilities/access_policy.js')
const roles_managment = require('./roles_managment/routes.js')
const statistics = require('./statistics/routes.js')
const create_multiple_employees = require('./create_multiple_employees/routes.js')
const profile = require('./profile/routes.js')
const department_manager = require('./department_manager_routes.js')
const task_management = require('./task_management/routes.js')
const notifications = require('./notifications/routes.js')
const performance = require('./performance.js')
const requests = require('./requests/routes.js')
const event_management = require('./event_management/routes.js')
const data_management = require('./data_management/routes.js')


Router.use('/servicedelivery', authenticate, authorize(GROUPS.SERVICE_DELIVERY), service_delivery)

Router.use("/smartparking", authenticate, authorize(GROUPS.SMART_PARKING), smartparking)

Router.use('/audit', authenticate, authorize(GROUPS.ADMIN_AUDIT), audit)

// Reads are open to every signed-in user (dropdowns, visitor assignment,
// requests); the per-route checks inside guard every write.
Router.use('/department/crud', authenticate, department)

// Same split as departments: listing/reading employees is shared, writing
// them (other than one's own profile) is an admin action.
Router.use('/employee/crud', authenticate, employee)

Router.use('/permissions', authenticate, authorize(GROUPS.ADMIN_ROLES_READ), system_permission)

// /roles/navigation must stay reachable by everyone (it feeds the sidebar);
// the roles router applies the admin checks on its other routes itself.
Router.use('/roles', authenticate, roles_managment)

Router.use("/auth", auth)
Router.use('/docs', docs)
// Public submit/verify flows plus authenticated management reads - the
// feedback router protects the management routes itself.
Router.use('/feedback', feedback)
Router.use('/statistics', authenticate, authorize(GROUPS.ANALYTICS), statistics)
Router.use('/multiple', authenticate, authorize(GROUPS.ADMIN_EMPLOYEES), create_multiple_employees)
Router.use('/profile', authenticate, profile)
Router.use('/department-manager', authenticate, authorize(GROUPS.DEPARTMENT_MANAGER), department_manager)
Router.use('/tasks', authenticate, authorize(GROUPS.TASKS), task_management)
Router.use('/notifications', authenticate, notifications)
Router.use('/performance', authenticate, authorize(GROUPS.ANALYTICS), performance)
// Reading requests (the statistics cards on the receptionist and employee
// dashboards, the list, the export) is open to every service-delivery
// role; creating, editing and archiving one is not.
Router.use('/requests', authenticate, authorizeByMethod({ read: GROUPS.REQUESTS_READ, write: GROUPS.REQUESTS_WRITE }), requests)
Router.use('/v1/event-actions', authenticate, authorize(GROUPS.EVENTS), event_management)
Router.use('/data-management', authenticate, authorize(GROUPS.ADMIN_STORAGE), data_management)
Router.use('/webpush', require('./webpush/routes.js'))
// Server-to-server calls (each route verifies its own service JWT)
Router.use('/internal', require('./internal/routes.js'))

// Serve uploaded files
const path = require('path')
const express = require('express')
Router.use('/uploads', express.static(path.join(__dirname, '../uploads')))

module.exports = Router
