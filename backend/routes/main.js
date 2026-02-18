
/**
 * This will be a base files to groupes all routes into the system
 * And also should never be rewritten again
 */

const Router = require("express").Router()
const ALL_ROUTES = require('./routes.js')


Router.use(ALL_ROUTES)
module.exports = Router