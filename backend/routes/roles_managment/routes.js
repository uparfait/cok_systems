const roles_managment = require('../../controllers/roles_managment/roles_managment.js')
const Router = require('express').Router()

/**
 * @swagger
 * /roles:
 *   get:
 *     summary: "Get all roles"
 *     description: "Retrieve a list of all defined roles in the system."
 *     tags: [Roles & Permissions]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Roles retrieved successfully
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
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       permissions:
 *                         type: array
 *       500:
 *         description: Internal server error
 */
Router.get('/', roles_managment.getAllRoles)

/**
 * @swagger
 * /roles:
 *   post:
 *     summary: "Create a new role"
 *     description: "Create a new role with a name and optional permissions."
 *     tags: [Roles & Permissions]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: "Role name"
 *                 example: "department_employee"
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     resource_name:
 *                       type: string
 *                       example: "employees"
 *                     actions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           action_type:
 *                             type: string
 *                             example: "read:employees"
 *                           is_enabled:
 *                             type: boolean
 *                             example: true
 *     responses:
 *       201:
 *         description: Role created successfully
 *       400:
 *         description: Role name is required or role already exists
 *       500:
 *         description: Internal server error
 */
Router.post('/', roles_managment.createRole)

/**
 * @swagger
 * /roles/resources/available:
 *   get:
 *     summary: "Get available resources"
 *     description: "Retrieve a list of all available system resources that can be assigned permissions."
 *     tags: [Roles & Permissions]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Available resources retrieved
 *       500:
 *         description: Internal server error
 */
Router.get('/resources/available', roles_managment.getAvailableResources)

/**
 * @swagger
 * /roles/{id}:
 *   get:
 *     summary: "Get role by ID"
 *     description: "Retrieve a single role by its MongoDB ObjectId."
 *     tags: [Roles & Permissions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Role MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     responses:
 *       200:
 *         description: Role details retrieved
 *       404:
 *         description: Role not found
 *       500:
 *         description: Internal server error
 */
Router.get('/:id', roles_managment.getRoleById)

/**
 * @swagger
 * /roles/name/{name}:
 *   get:
 *     summary: "Get role by name"
 *     description: "Retrieve a role by its name string."
 *     tags: [Roles & Permissions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: "Role name"
 *         example: "system_admin"
 *     responses:
 *       200:
 *         description: Role details retrieved
 *       404:
 *         description: Role not found
 *       500:
 *         description: Internal server error
 */
Router.get('/name/:name', roles_managment.getRoleByName)

/**
 * @swagger
 * /roles/{id}:
 *   put:
 *     summary: "Update role"
 *     description: "Update a role's name and permissions."
 *     tags: [Roles & Permissions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Role MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "updated_role_name"
 *               permissions:
 *                 type: array
 *     responses:
 *       200:
 *         description: Role updated successfully
 *       404:
 *         description: Role not found
 *       500:
 *         description: Internal server error
 */
Router.put('/:id', roles_managment.updateRole)

/**
 * @swagger
 * /roles/{id}/permissions/toggle:
 *   put:
 *     summary: "Toggle a permission"
 *     description: "Toggle a specific permission's enabled/disabled state for a role."
 *     tags: [Roles & Permissions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Role MongoDB ObjectId"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resource_name
 *               - action_type
 *             properties:
 *               resource_name:
 *                 type: string
 *                 example: "employees"
 *               action_type:
 *                 type: string
 *                 example: "read:employees"
 *     responses:
 *       200:
 *         description: Permission toggled successfully
 *       404:
 *         description: Role not found
 *       500:
 *         description: Internal server error
 */
Router.put('/:id/permissions/toggle', roles_managment.togglePermission)

/**
 * @swagger
 * /roles/{id}/permissions/bulk:
 *   put:
 *     summary: "Bulk update permissions"
 *     description: "Bulk update all permissions for a role at once."
 *     tags: [Roles & Permissions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Role MongoDB ObjectId"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - permissions
 *             properties:
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Permissions updated successfully
 *       404:
 *         description: Role not found
 *       500:
 *         description: Internal server error
 */
Router.put('/:id/permissions/bulk', roles_managment.bulkUpdatePermissions)

/**
 * @swagger
 * /roles/{id}:
 *   delete:
 *     summary: "Delete role"
 *     description: "Delete a role by its MongoDB ObjectId."
 *     tags: [Roles & Permissions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Role MongoDB ObjectId"
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     responses:
 *       200:
 *         description: Role deleted successfully
 *       404:
 *         description: Role not found
 *       500:
 *         description: Internal server error
 */
Router.delete('/:id', roles_managment.deleteRole)

module.exports = Router