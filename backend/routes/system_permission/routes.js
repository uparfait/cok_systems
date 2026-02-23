/**
 * Below are routes for system permission management
 */

const Router = require('express').Router()
const SystemPermissionManager = require('../../controllers/system_permission/manage.js')

const ManagerInstance = new SystemPermissionManager()



Router.get('/', ManagerInstance.list) // List all system permissions
Router.get('/:id', ManagerInstance.getById) // Get system permission by ID
Router.post('/', ManagerInstance.create) // Create a new system permission
Router.put('/:id', ManagerInstance.update) // Update a system permission by ID
Router.delete('/:id', ManagerInstance.delete) // Delete a system permission by ID


module.exports = Router