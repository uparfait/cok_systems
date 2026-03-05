const roles_managment = require('../../controllers/roles_managment/roles_managment.js')
const Router = require('express').Router()


Router.get('/', roles_managment.getAllRoles)
Router.post('/', roles_managment.createRole)
Router.put('/:id/permissions/bulk', roles_managment.bulkUpdatePermissions)
Router.get('/:id', roles_managment.getRoleById)
Router.put('/:id/permissions/toggle', roles_managment.togglePermission)
Router.get('/name/:name', roles_managment.getRoleByName)
Router.delete('/:id', roles_managment.deleteRole)
Router.put('/:id', roles_managment.updateRole)
Router.get('/resources/available', roles_managment.getAvailableResources)
module.exports = Router
