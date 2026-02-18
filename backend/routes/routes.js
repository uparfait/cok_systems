/**
 * This file combines all routes together and can be rewritten.
 */

const Router = require('express').Router

const service_deliver = require("./service_deliver/routes.js")
const smartparking = require("./smartparking/routes.js")


Router.use('/servicedelivary', service_delivary)
Router.use("/smartparking", smartparking)




module.exports = Router