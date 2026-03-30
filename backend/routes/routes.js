/**
 * This file combines all routes together and can be rewritten.
 */

const Router = require('express').Router()

const service_delivery = require("./service_delivery/routes.js")
const smartparking = require("./smartparking/routes.js")
const auth = require("./auth/routes.js")
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


Router.use('/servicedelivery', 
           authenticate,
     // 
    service_delivery)

Router.use("/smartparking", 
           authenticate,
     //
    smartparking)

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


module.exports = Router
