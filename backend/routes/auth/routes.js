const Router = require("express").Router()

// Import route modules
const login = require("./login/routes.js")
const logout = require("./logout/routes.js")
const passwordReset = require("./password-reset/routes.js")
const firstLogin = require("./first-login/routes.js")
const lockUnlock = require("./lock_unlock/routes.js")
const twoFA = require("./2fa/routes.js")

const multer = require('multer')
const upload = multer()

// Import middleware
const authenticate = require('../../middlewares/authenticate')

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
        console.warn('[UPLOAD WARNING]: Handled unexpected or empty input:', error.message)
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
Router.use('/2fa', twoFA)

/**
 * @swagger
 * /auth/validate-token:
 *   get:
 *     summary: "Validate JWT token and get user info"
 *     description: "Check if the current JWT token is valid and retrieve the authenticated user's information."
 *     tags: [Authentication - Login]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Token is valid"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         userId:
 *                           type: string
 *                           example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *                         email:
 *                           type: string
 *                           example: "john.doe@cok.gov.rw"
 *                         fullName:
 *                           type: string
 *                           example: "John Doe"
 *                         role:
 *                           type: string
 *                           example: "system_admin"
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                       example: "2026-06-30T10:00:00.000Z"
 *       401:
 *         description: Invalid or expired token
 */
Router.get('/validate-token', authenticate, (req, res) => {
  res.status(200).json({
    status: true,
    message: 'Token is valid',
    data: {
      user: req.user,
      timestamp: new Date().toISOString()
    }
  });
});

module.exports = Router
