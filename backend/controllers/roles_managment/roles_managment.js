// controllers/role/RoleController.js
const mongoose = require('mongoose');
const role_model = require('../../models/default_roles.js');
const user_model = require('../../models/user.js');
const allowed_resources = require('../../resources/resources.js');
const navigation = require('../../utilities/navigation.js');

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
     * Links marked default_enabled in the catalog (e.g. Calender, Task
     * Manager) are required on every custom role; missing ones are added.
     */
    static ensureRequiredLinks(navLinks) {
        const required = (navigation.loadDefaults().link_catalog || [])
            .filter((l) => l.default_enabled);
        const present = new Set(
            (navLinks || []).map((e) => (typeof e === 'string' ? e : e?.id))
        );
        const merged = [...(navLinks || [])];
        required.forEach((l) => {
            if (!present.has(l.id)) merged.push({ id: l.id });
        });
        return merged;
    }

    /**
     * A role name is reserved when it is one of the default roles
     * (same slug or same name); those roles are unchangeable.
     */
    static isReservedRoleName(roleName) {
        const name = String(roleName || '').toLowerCase().trim();
        const slug = navigation.slugify(roleName);
        return (navigation.loadDefaults().default_roles || []).some(
            (r) => r.role_slug === slug || r.role_name.toLowerCase() === name
        );
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
            const { role_name, permissions = [], nav_links, default_route } = req.body;

            // Validate required fields
            if (!role_name) {
                return res.status(400).json({
                    success: false,
                    type: 'warning',
                    message: 'Role name is required'
                });
            }

            // Default roles are unchangeable and cannot be shadowed
            if (nav_links && RoleController.isReservedRoleName(role_name)) {
                return res.status(400).json({
                    success: false,
                    type: 'warning',
                    message: `"${role_name}" collides with a default role. Default roles are unchangeable - please choose a different role name.`
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

            // Validate navigation links against the shared catalog
            let finalNavLinks = nav_links;
            if (nav_links !== undefined) {
                if (!Array.isArray(nav_links) || nav_links.length === 0) {
                    return res.status(400).json({
                        success: false,
                        type: 'warning',
                        message: 'A role must have at least one link'
                    });
                }
                const navErrors = navigation.validateNavLinks(nav_links);
                if (navErrors.length > 0) {
                    return res.status(400).json({
                        success: false,
                        type: 'warning',
                        message: 'Navigation link validation failed',
                        errors: navErrors
                    });
                }
                // Required default links are always part of the role
                finalNavLinks = RoleController.ensureRequiredLinks(nav_links);
            }

            // Merge permissions with complete resource list
            const mergedPermissions = RoleController.mergePermissions(permissions);

            // Create new role
            const newRole = new role_model({
                role_name,
                permissions: mergedPermissions,
                nav_links: finalNavLinks || [],
                default_route: default_route || ''
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
            // Database roles combined with the JSON defaults, deduplicated
            // by slug so no role (e.g. Mayor) can ever appear twice
            const combined = await navigation.getCombinedRoles();

            return res.status(200).json({
                success: true,
                type: 'success',
                message: 'Roles retrieved successfully',
                data: combined
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
            const { role_name, permissions, nav_links, default_route } = req.body;

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

                // Merge new permissions while preserving existing enabled states
                const mergedPermissions = RoleController.mergePermissions(permissions);
                role.permissions = mergedPermissions;
            }

            // Update navigation links / landing route (custom roles only)
            if (nav_links !== undefined || default_route !== undefined) {
                if (RoleController.isReservedRoleName(role.role_name)) {
                    return res.status(400).json({
                        success: false,
                        type: 'warning',
                        message: `"${role.role_name}" is a default role. Default role navigation is unchangeable.`
                    });
                }
                if (nav_links !== undefined) {
                    if (!Array.isArray(nav_links) || nav_links.length === 0) {
                        return res.status(400).json({
                            success: false,
                            type: 'warning',
                            message: 'A role must keep at least one link'
                        });
                    }
                    const navErrors = navigation.validateNavLinks(nav_links);
                    if (navErrors.length > 0) {
                        return res.status(400).json({
                            success: false,
                            type: 'warning',
                            message: 'Navigation link validation failed',
                            errors: navErrors
                        });
                    }
                    // Required default links are always part of the role
                    role.nav_links = RoleController.ensureRequiredLinks(nav_links);
                }
                if (default_route !== undefined) {
                    role.default_route = default_route || '';
                }
            }

            const updatedRole = await role.save();

            return res.status(200).json({
                success: true,
                type: 'success',
                message: `Role "${updatedRole.role_name}" updated successfully.`,
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

            const role = await role_model.findById(id);

            if (!role) {
                return res.status(404).json({
                    success: false,
                    type: "warning",
                    message: "Role not found"
                });
            }

            // A role still assigned to employees cannot be deleted
            const assignedCount = await user_model.countDocuments({
                'roles.role_name': new RegExp(`^${escapeRegex(role.role_name)}$`, 'i')
            });
            if (assignedCount > 0) {
                return res.status(400).json({
                    success: false,
                    type: 'warning',
                    message: `Cannot delete "${role.role_name}" - it is assigned to ${assignedCount} employee${assignedCount > 1 ? 's' : ''}. Reassign them to another role first.`
                });
            }

            await role_model.findByIdAndDelete(id);

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

    /**
     * The unchangeable default roles (from configurations/Default_Roles.json),
     * links resolved with each role's own slug.
     */
    static async getDefaultRoles(req, res) {
        try {
            const defaults = navigation.loadDefaults();
            const roles = (defaults.default_roles || []).map((r) => ({
                role_name: r.role_name,
                role_slug: r.role_slug,
                default_route: r.default_route,
                links: navigation.applyPlaceholders(r.links, r.role_slug)
            }));
            return res.status(200).json({
                success: true,
                type: 'success',
                message: 'Default roles retrieved successfully',
                data: { version: defaults.version, roles }
            });
        } catch (error) {
            console.error('Error in getDefaultRoles:', error);
            return res.status(500).json({
                success: false,
                type: 'error',
                message: 'Something went wrong while fetching default roles',
                error: error.message
            });
        }
    }

    /**
     * The catalog of slug-generic links custom roles can toggle.
     * Role-tied links (backend-hardcoded behaviors) are not in the catalog.
     */
    static async getLinksCatalog(req, res) {
        try {
            const defaults = navigation.loadDefaults();
            return res.status(200).json({
                success: true,
                type: 'success',
                message: 'Link catalog retrieved successfully',
                data: { version: defaults.version, links: defaults.link_catalog || [] }
            });
        } catch (error) {
            console.error('Error in getLinksCatalog:', error);
            return res.status(500).json({
                success: false,
                type: 'error',
                message: 'Something went wrong while fetching the link catalog',
                error: error.message
            });
        }
    }

    /**
     * Navigation for the authenticated user: sidebar links, role slug and
     * the route to land on after login. The frontend stores this in
     * localStorage and refreshes it on every page load.
     */
    static async getNavigation(req, res) {
        try {
            const roleName = req.user?.role_name || req.user?.role || '';
            const nav = await navigation.resolveNavigation(roleName);
            return res.status(200).json({
                success: true,
                type: 'success',
                message: 'Navigation retrieved successfully',
                data: nav
            });
        } catch (error) {
            console.error('Error in getNavigation:', error);
            return res.status(500).json({
                success: false,
                type: 'error',
                message: 'Something went wrong while fetching navigation',
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