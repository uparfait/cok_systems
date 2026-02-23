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




Router.get('/', SystemPermissionManager.list) // List all system permissions
Router.get('/:id', SystemPermissionManager.getById) // Get system permission by ID
Router.post('/', SystemPermissionManager.create) // Create a new system permission
Router.put('/:id', SystemPermissionManager.update) // Update a system permission by ID
Router.delete('/:id', SystemPermissionManager.delete) // Delete a system permission by ID


module.exports = Router