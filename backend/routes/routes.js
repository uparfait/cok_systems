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


Router.use('/servicedelivery', service_delivery)
Router.use("/smartparking", smartparking)
Router.use("/auth", auth)
Router.use('/parfait', parfaits_api_docs)
Router.use('/amos', amos_api_docs)
Router.use('/department/crud', department)
Router.use('/employee/crud', employee)
Router.use('/permissions', system_permission)



module.exports = Router
