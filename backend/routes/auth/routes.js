const Router = require("express").Router()

// Import route modules
const login = require("./login/routes.js")
const logout = require("./logout/routes.js")
const passwordReset = require("./password-reset/routes.js")

// Mount routes
Router.use('/login', login)
Router.use('/logout', logout)
Router.use('/password-reset', passwordReset)

// Keep old routes for backward compatibility
Router.get('/login', (req, res, next) => {
    return res.status(200).json({
        status: true,
        error: null,
        message: "GET auth/login"
    })
})

Router.post('/login', (req, res, next) => {
    return res.status(200).json({
        status: true,
        error: null,
        message: "POST auth/login"
    })
})

Router.put('/login', (req, res, next) => {
    return res.status(200).json({
        status: true,
        error: null,
        message: "PUT auth/login"
    })
})

module.exports = Router
