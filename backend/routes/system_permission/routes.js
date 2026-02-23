/**
 * Below are routes for system permission management
 */

const Router = require('express').Router()
const SystemPermissionManager = require('../../controllers/system_permission/manage.js')





Router.get('/', SystemPermissionManager.list) // List all system permissions
Router.get('/:id', SystemPermissionManager.getById) // Get system permission by ID
Router.post('/', SystemPermissionManager.create) // Create a new system permission
Router.put('/:id', SystemPermissionManager.update) // Update a system permission by ID
Router.delete('/:id', SystemPermissionManager.delete) // Delete a system permission by ID


module.exports = Router