/**
 * Below are routes for system permission management
 */

const Router = require('express').Router()
const SystemPermissionManager = require('../../controllers/system_permission/manage.js')

const multer = require('multer')
const upload = multer()

Router.use(upload.any())

/**
 * Global Interceptor for Multer Errors
 */
Router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError || error) {
        console.warn('[UPLOAD WARNING]: Handled unexpected or empty input:', error.message)
        req.body = req.body || {}
        return next()
    }
    next()
})

/**
 * @swagger
 * /permissions:
 *   get:
 *     summary: "List all system permissions"
 *     description: "Retrieve all system-wide permissions and their configurations."
 *     tags: [System Permissions]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: System permissions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       resource_name:
 *                         type: string
 *                         example: "employees"
 *                       actions:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             action_type:
 *                               type: string
 *                               example: "read:employees"
 *                             description:
 *                               type: string
 *                               example: "Allow this user to view a list of all employees"
 *       500:
 *         description: Internal server error
 */
Router.get('/', SystemPermissionManager.listSystemPermissions)

module.exports = Router