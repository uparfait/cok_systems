/**
 * This file combines all routes together and can be rewritten.
 */

const Router = require('express').Router()

const service_delivary = require("./service_delivary/routes.js")
const smartparking = require("./smartparking/routes.js")
const auth = require("./auth/routes.js")


Router.use('/servicedelivary', service_delivary)
Router.use("/smartparking", smartparking)
Router.use("/auth", auth)



module.exports = Router
