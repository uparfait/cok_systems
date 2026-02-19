const Router = require("express").Router()

// Import route modules
const login = require("./login/routes.js")
const logout = require("./logout/routes.js")
const passwordReset = require("./password-reset/routes.js")

// Mount routes
Router.use('/login', login)
Router.use('/logout', logout)
Router.use('/password-reset', passwordReset)