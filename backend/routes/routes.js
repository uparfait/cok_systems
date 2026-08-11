/**
 * This file combines all routes together and can be rewritten.
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


Router.use('/servicedelivery',
            authenticate,
      //
     service_delivery)

Router.use("/smartparking",
            authenticate,
      //
     smartparking)

Router.use('/audit',
            authenticate,
      //
     audit)

Router.use('/department/crud', 
           authenticate,
     // 
    department)

Router.use('/employee/crud', 
           authenticate,
     // 
    employee)

Router.use('/permissions', 
           authenticate,
     // 
    system_permission)

Router.use('/roles', authenticate, roles_managment)

Router.use("/auth", auth)
Router.use('/docs', docs)
Router.use('/feedback', feedback)
Router.use('/statistics', authenticate, statistics)
Router.use('/multiple',
    authenticate,
      create_multiple_employees)
Router.use('/profile', authenticate, profile)
Router.use('/department-manager', authenticate, department_manager)
Router.use('/tasks', authenticate, task_management)
Router.use('/notifications', authenticate, notifications)
Router.use('/performance', authenticate, performance)
Router.use('/requests', requests)
Router.use('/v1/event-actions', event_management)
Router.use('/data-management', authenticate, data_management)
Router.use('/webpush', require('./webpush/routes.js'))

// Serve uploaded files
const path = require('path')
const express = require('express')
Router.use('/uploads', express.static(path.join(__dirname, '../uploads')))

module.exports = Router