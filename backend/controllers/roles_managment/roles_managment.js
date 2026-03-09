// controllers/role/RoleController.js
const mongoose = require('mongoose');
const role_model = require('../../models/default_roles.js');
const allowed_resources = require('../../resources/resources.js');

class RoleController {
    
    /**
     * Get all available resources from the allowed_resources file
     */
    static getAllResources() {
        return allowed_resources.map(resource => ({
            resource_name: resource.resource_name,
            actions: resource.actions.map(action => ({
                action: action.action_type,
                description: action.description,
                is_enabled: false // Default to disabled
            }))
        }));
    }

    /**
     * Validate permissions against allowed resources
     */
    static validatePermissions(permissions) {
        const errors = [];
        const validResources = new Map();
        
        // Build valid resources map
        allowed_resources.forEach(resource => {
            validResources.set(resource.resource_name.toLowerCase(), {
                name: resource.resource_name,
                actions: new Set(resource.actions.map(a => a.action_type.toLowerCase()))
            });
        });

        // Validate each permission
        permissions.forEach((perm, index) => {
            if (!perm.resource_name) {
                errors.push(`Permission at index ${index}: missing resource_name`);
                return;
            }

            const resourceKey = perm.resource_name.toLowerCase();
            const validResource = validResources.get(resourceKey);

            if (!validResource) {
                errors.push(`Invalid resource: "${perm.resource_name}" at index ${index}`);
                return;
            }

            // Validate actions
            const actions = perm.actions || [];
            actions.forEach((action, actionIndex) => {
                const actionValue = action.action || action;
                const actionStr = typeof actionValue === 'string' ? actionValue.toLowerCase() : '';
                
                if (!validResource.actions.has(actionStr)) {
                    errors.push(`Invalid action "${actionValue}" for resource "${perm.resource_name}" at permission ${index}, action ${actionIndex}`);
                }
            });
        });

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Merge incoming permissions with complete resource list
     */
    static mergePermissions(incomingPermissions = []) {
        const completePermissions = RoleController.getAllResources();
        
        // Create map of incoming enabled permissions
        const incomingEnabledMap = new Map();
        
        incomingPermissions.forEach(perm => {
            const resourceName = perm.resource_name;
            const actions = perm.actions || [];
            
            actions.forEach(action => {
                const actionValue = action.action || action;
                const key = `${resourceName}:${actionValue}`;
                incomingEnabledMap.set(key.toLowerCase(), true);
            });
        });

        // Merge incoming enabled states
        completePermissions.forEach(resource => {
            resource.actions.forEach(action => {
                const key = `${resource.resource_name}:${action.action}`.toLowerCase();
                if (incomingEnabledMap.has(key)) {
                    action.is_enabled = true;
                }
            });
        });

        return completePermissions;
    }

    
    static async createRole(req, res, next) {
        try {
            const { role_name, permissions = [] } = req.body;

            // Validate required fields
            if (!role_name) {
                return res.status(400).json({
                    success: false,
                    type: 'warning',
                    message: 'Role name is required'
                });
            }

            // Check if role already exists
            const existingRole = await role_model.findOne({ role_name });
            if (existingRole) {
                return res.status(409).json({
                    success: false,
                    type: 'warning',
                    message: `Role "${role_name}" already exists`
                });
            }

            // Validate incoming permissions if provided
            if (permissions.length > 0) {
                const validation = RoleController.validatePermissions(permissions);
                if (!validation.valid) {
                    return res.status(400).json({
                        success: false,
                        type: 'warning',
                        message: 'Permission validation failed',
                        errors: validation.errors
                    });
                }
            }

            // Merge permissions with complete resource list
            const mergedPermissions = RoleController.mergePermissions(permissions);

            // Create new role
            const newRole = new role_model({
                role_name,
                permissions: mergedPermissions
            });

            const savedRole = await newRole.save();

            return res.status(201).json({
                success: true,
                type: 'success',
                message: `Role "${role_name}" created successfully`,
                data: savedRole
            });

        } catch (error) {
            console.error("Error in createRole:", error);
            return res.status(500).json({
                success: false,
                type: "error",
                message: "Something went wrong while creating role",
                error: error.message
            });
        }
    }

   
    static async getAllRoles(req, res, next) {
        try {
            const roles = await role_model.find({});
            
            return res.status(200).json({
                success: true,
                type: 'success',
                message: 'Roles retrieved successfully',
                data: roles
            });

        } catch (error) {
            console.error("Error in getAllRoles:", error);
            return res.status(500).json({
                success: false,
                type: "error",
                message: "Something went wrong while fetching roles",
                error: error.message
            });
        }
    }

    
    static async getRoleById(req, res, next) {
        try {
            const { id } = req.params;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    type: "warning",
                    message: "Invalid role ID format"
                });
            }

            const role = await role_model.findById(id);

            if (!role) {
                return res.status(404).json({
                    success: false,
                    type: "warning",
                    message: "Role not found"
                });
            }

            return res.status(200).json({
                success: true,
                type: 'success',
                message: 'Role retrieved successfully',
                data: role
            });

        } catch (error) {
            console.error("Error in getRoleById:", error);
            return res.status(500).json({
                success: false,
                type: "error",
                message: "Something went wrong while fetching role",
                error: error.message
            });
        }
    }

    
    static async getRoleByName(req, res, next) {
        try {
            const { name } = req.params;

            const role = await role_model.findOne({ role_name: name });

            if (!role) {
                return res.status(404).json({
                    success: false,
                    type: "warning",
                    message: `Role "${name}" not found`
                });
            }

            return res.status(200).json({
                success: true,
                type: 'success',
                message: 'Role retrieved successfully',
                data: role
            });

        } catch (error) {
            console.error("Error in getRoleByName:", error);
            return res.status(500).json({
                success: false,
                type: "error",
                message: "Something went wrong while fetching role",
                error: error.message
            });
        }
    }

    
    static async updateRole(req, res, next) {
        try {
            const { id } = req.params;
            const { role_name, permissions } = req.body;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    type: "warning",
                    message: "Invalid role ID format"
                });
            }

            const role = await role_model.findById(id);
            if (!role) {
                return res.status(404).json({
                    success: false,
                    type: "warning",
                    message: "Role not found"
                });
            }

            // Update role name if provided
            if (role_name && role_name !== role.role_name) {
                const existingRole = await role_model.findOne({ role_name });
                if (existingRole) {
                    return res.status(409).json({
                        success: false,
                        type: "warning",
                        message: `Role name "${role_name}" already exists`
                    });
                }
                role.role_name = role_name;
            }

            // Update permissions if provided
            if (permissions) {
                // Validate incoming permissions
                const validation = RoleController.validatePermissions(permissions);
                if (!validation.valid) {
                    return res.status(400).json({
                        success: false,
                        type: 'warning',
                        message: 'Permission validation failed',
                        errors: validation.errors
                    });
                }

                // Create map of existing enabled permissions
                const existingEnabledMap = new Map();
                role.permissions.forEach(resource => {
                    resource.actions.forEach(action => {
                        if (action.is_enabled) {
                            const key = `${resource.resource_name}:${action.action}`;
                            existingEnabledMap.set(key.toLowerCase(), true);
                        }
                    });
                });

                // Merge new permissions while preserving existing enabled states
                const mergedPermissions = RoleController.mergePermissions(permissions);
                
                // Preserve existing enabled states if not explicitly disabled
                mergedPermissions.forEach(resource => {
                    resource.actions.forEach(action => {
                        const key = `${resource.resource_name}:${action.action}`.toLowerCase();
                        if (existingEnabledMap.has(key) && !action.is_enabled) {
                            // Check if this action was explicitly disabled in incoming permissions
                            const wasExplicitlySet = permissions.some(p => 
                                p.resource_name === resource.resource_name && 
                                p.actions.some(a => (a.action || a) === action.action)
                            );
                            
                            if (!wasExplicitlySet) {
                                action.is_enabled = true; // Preserve existing state
                            }
                        }
                    });
                });

                role.permissions = mergedPermissions;
            }

            const updatedRole = await role.save();

            return res.status(200).json({
                success: true,
                type: 'success',
                message: `Role "${updatedRole.role_name}" updated successfully`,
                data: updatedRole
            });

        } catch (error) {
            console.error("Error in updateRole:", error);
            return res.status(500).json({
                success: false,
                type: "error",
                message: "Something went wrong while updating role",
                error: error.message
            });
        }
    }

    
    static async deleteRole(req, res, next) {
        try {
            const { id } = req.params;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    type: "warning",
                    message: "Invalid role ID format"
                });
            }

            const role = await role_model.findByIdAndDelete(id);

            if (!role) {
                return res.status(404).json({
                    success: false,
                    type: "warning",
                    message: "Role not found"
                });
            }

            return res.status(200).json({
                success: true,
                type: 'success',
                message: `Role "${role.role_name}" deleted successfully`
            });

        } catch (error) {
            console.error("Error in deleteRole:", error);
            return res.status(500).json({
                success: false,
                type: "error",
                message: "Something went wrong while deleting role",
                error: error.message
            });
        }
    }

    
    static async getAvailableResources(req, res, next) {
        try {
            const resources = allowed_resources.map(resource => ({
                resource_name: resource.resource_name,
                actions: resource.actions.map(action => ({
                    action: action.action_type,
                    description: action.description
                }))
            }));

            return res.status(200).json({
                success: true,
                type: 'success',
                message: 'Available resources retrieved successfully',
                data: resources
            });

        } catch (error) {
            console.error("Error in getAvailableResources:", error);
            return res.status(500).json({
                success: false,
                type: "error",
                message: "Something went wrong while fetching resources",
                error: error.message
            });
        }
    }

    
    static async togglePermission(req, res, next) {
        try {
            const { id } = req.params;
            const { resource_name, action, enabled } = req.body;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    type: "warning",
                    message: "Invalid role ID format"
                });
            }

            if (!resource_name || !action) {
                return res.status(400).json({
                    success: false,
                    type: "warning",
                    message: "resource_name and action are required"
                });
            }

            const role = await role_model.findById(id);
            if (!role) {
                return res.status(404).json({
                    success: false,
                    type: "warning",
                    message: "Role not found"
                });
            }

            // Find and toggle the specific permission
            let permissionFound = false;
            role.permissions.forEach(resource => {
                if (resource.resource_name.toLowerCase() === resource_name.toLowerCase()) {
                    resource.actions.forEach(permAction => {
                        if (permAction.action.toLowerCase() === action.toLowerCase()) {
                            permAction.is_enabled = enabled !== undefined ? enabled : !permAction.is_enabled;
                            permissionFound = true;
                        }
                    });
                }
            });

            if (!permissionFound) {
                return res.status(404).json({
                    success: false,
                    type: "warning",
                    message: "Permission not found"
                });
            }

            await role.save();

            return res.status(200).json({
                success: true,
                type: 'success',
                message: `Permission toggled successfully`,
                data: role
            });

        } catch (error) {
            console.error("Error in togglePermission:", error);
            return res.status(500).json({
                success: false,
                type: "error",
                message: "Something went wrong while toggling permission",
                error: error.message
            });
        }
    }

   
    static async bulkUpdatePermissions(req, res, next) {
        try {
            const { id } = req.params;
            const { permissions } = req.body;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    type: "warning",
                    message: "Invalid role ID format"
                });
            }

            if (!permissions || !Array.isArray(permissions)) {
                return res.status(400).json({
                    success: false,
                    type: "warning",
                    message: "Permissions array is required"
                });
            }

            // Validate permissions
            const validation = RoleController.validatePermissions(permissions);
            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    type: 'warning',
                    message: 'Permission validation failed',
                    errors: validation.errors
                });
            }

            const role = await role_model.findById(id);
            if (!role) {
                return res.status(404).json({
                    success: false,
                    type: "warning",
                    message: "Role not found"
                });
            }

            // Merge and update permissions
            const mergedPermissions = RoleController.mergePermissions(permissions);
            role.permissions = mergedPermissions;
            await role.save();

            return res.status(200).json({
                success: true,
                type: 'success',
                message: 'Permissions updated successfully',
                data: role
            });

        } catch (error) {
            console.error("Error in bulkUpdatePermissions:", error);
            return res.status(500).json({
                success: false,
                type: "error",
                message: "Something went wrong while updating permissions",
                error: error.message
            });
        }
    }
}

module.exports = RoleController;