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
const parfaits_api_docs = require("./parfaits_api_docs/routes.js")
const system_permission = require("./system_permission/routes.js")
const amos_api_docs = require("./amos_api_docs/routes.js")
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
Router.use('/parfait', parfaits_api_docs)
Router.use('/amos', amos_api_docs)
Router.use('/docs', docs)
Router.use('/feedback', feedback)
Router.use('/statistics', authenticate, statistics)
Router.use('/multiple',
    //authenticate,
      create_multiple_employees)
Router.use('/profile', authenticate, profile)
Router.use('/department-manager', authenticate, department_manager)
Router.use('/tasks', authenticate, task_management)
Router.use('/notifications', authenticate, notifications)

module.exports = Router
