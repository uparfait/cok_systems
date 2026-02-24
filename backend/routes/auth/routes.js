const Router = require("express").Router()

// Import route modules
const login = require("./login/routes.js")
const logout = require("./logout/routes.js")
const passwordReset = require("./password-reset/routes.js")
const firstLogin = require("./first-login/routes.js")
const lockUnlock = require("./lock_unlock/routes.js")

const multer = require('multer')
const upload = multer()


Router.use(upload.any())

/**
 * Global Interceptor for Multer Errors
 * This prevents the app from throwing a 500 error when:
 * - No data is sent
 * - Input is not formatted correctly as multipart/form-data
 * - Unexpected fields are sent
 */
Router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError || error) {
        // Log the issue internally for the dev
        console.warn('[UPLOAD WARNING]: Handled unexpected or empty input:', error.message)

        // Instead of crashing, we normalize the body to an empty object
        // and let the request continue to the controllers
        req.body = req.body || {}
        return next()
    }
    next()
})


// Mount routes
Router.use('/login', login)
Router.use('/logout', logout)
Router.use('/password-reset', passwordReset)
Router.use('/first-login', firstLogin)
Router.use('/lock-unlock', lockUnlock)

module.exports = Router
