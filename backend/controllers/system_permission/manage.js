const User = require('../../models/user.js');
const mongoose = require('mongoose');
const allowed_resources = require('../../resources/resources.js');

class PermissionManager {
    // Retrieve permissions for a given resource
    static async getResourcePermissions(req, res, next) {
        try {
            const { resource } = req.params;

            if (!resource || typeof resource !== 'string') {
                return res.status(400).json({
                    success: false,
                    type: "warning",
                    message: "Resource name is required"
                });
            }

            const resourceDef = allowed_resources.find(
                r => r.resource_name.toLowerCase().trim( ) === resource.trim().toLowerCase()
            );

            if (!resourceDef) {
                return res.status(404).json({
                    success: false,
                    type: "warning",
                    message: "Resource not found in allowed list"
                });
            }

            return res.status(200).json({
                success: true,
                type: "success",
                message: "Resource permissions retrieved",
                data: resourceDef.actions
            });
        } catch (error) {
            console.error("Error in getResourcePermissions:", error);
            return res.status(500).json({
                success: false,
                type: "error",
                message: "Failed to retrieve resource permissions",
                error: error.message
            });
        }
    }

    // Assign permissions to a user
    static async assignPermissions(req, res, next) {
        try {
            const { userId } = req.params;
            const { resource, actions = [] } = req.body || {};

            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({
                    success: false,
                    type: "warning",
                    message: "Invalid user ID format"
                });
            }

            if (!resource || typeof resource !== 'string' || actions.length === 0) {
                return res.status(400).json({
                    success: false,
                    type: "warning",
                    message: "Resource and actions are required"
                });
            }

            // Validate resource
            const resourceDef = allowed_resources.find(
                r => r.resource_name.toLowerCase() === resource.trim().toLowerCase()
            );
            if (!resourceDef) {
                return res.status(400).json({
                    success: false,
                    type: "warning",
                    message: "Resource is not in the allowed list"
                });
            }

            // Validate actions
            const validActionTypes = resourceDef.actions.map(a => a.action_type.toString().toUpperCase().trim());
            const normalizedActions = [];
            for (const action of actions) {
                const upperAction = action.toString().toUpperCase().trim();
                if (!validActionTypes.includes(upperAction)) {
                    return res.status(400).json({
                        success: false,
                        type: "warning",
                        message: `Invalid action type: ${action}. Must be one of ${validActionTypes.join(', ')}`
                    });
                }
                normalizedActions.push(upperAction);
            }

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    type: "warning",
                    message: "User not found"
                });
            }

            // Avoid blind write: merge with existing permissions
            const existingPerm = user.roles.permissions.find(
                p => p.resource.toLowerCase() === resource.trim().toLowerCase()
            );

            if (existingPerm) {
                existingPerm.actions = Array.from(new Set([...existingPerm.actions, ...normalizedActions]));
            } else {
                user.roles.permissions.push({
                    resource: resource.trim(),
                    actions: normalizedActions
                });
            }

            await user.save();

            return res.status(200).json({
                success: true,
                type: "success",
                message: "Permissions assigned successfully.",
                data: user.roles.permissions
            });
        } catch (error) {
            console.error("Error in assignPermissions:", error);
            return res.status(500).json({
                success: false,
                type: "error",
                message: "Failed to assign permissions",
                error: error.message
            });
        }
    }

    // Remove permissions from a user
    static async removePermissions(req, res, next) {
        try {
            const { userId } = req.params;
            const { resource, actions = [] } = req.body || {};

            //console.log('Request full url', req.originalUrl);

            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({
                    success: false,
                    type: "warning",
                    message: "Invalid user ID format"
                });
            }

            if (!resource || typeof resource !== 'string') {
                return res.status(400).json({
                    success: false,
                    type: "warning",
                    message: "Resource is required"
                });
            }

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    type: "warning",
                    message: "User not found"
                });
            }

            const permIndex = user.roles.permissions.findIndex(
                p => p.resource.toLowerCase() === resource.trim().toLowerCase()
            );

            if (permIndex === -1) {
                return res.status(404).json({
                    success: false,
                    type: "warning",
                    message: "Permission for this resource not found"
                });
            }

            if (actions.length > 0) {
                // Remove only specified actions
                user.roles.permissions[permIndex].actions = user.roles.permissions[permIndex].actions.filter(
                    a => !actions.map(act => act.toUpperCase()).includes(a.toUpperCase())
                );

                // If no actions left, remove the resource entirely
                if (user.roles.permissions[permIndex].actions.length === 0) {
                    user.roles.permissions.splice(permIndex, 1);
                }
            } else {
                // Remove entire resource permission
                user.roles.permissions.splice(permIndex, 1);
            }

            await user.save();

            return res.status(200).json({
                success: true,
                type: "success",
                message: "Permissions removed successfully",
                data: user.roles.permissions
            });
        } catch (error) {
            console.error("Error in removePermissions:", error);
            return res.status(500).json({
                success: false,
                type: "error",
                message: "Failed to remove permissions",
                error: error.message
            });
        }
    }

    // List all system permissions (with pagination) (from resource not systemPermison model)
    static async listSystemPermissions(req, res, next) {
        try {
            let { limit = 10, page = 1 } = req.query;
            const limit_val = Math.min(parseInt(limit), 50);
            const skip_val = (parseInt(page) - 1) * limit_val;

            const permissions = allowed_resources.slice(skip_val, skip_val + limit_val).map(r => ({
                resource: r.resource_name,
                actions: r.actions
            }));

            const total_count = allowed_resources.length;

            return res.status(200).json({
                success: true,
                type: "success",
                message: "System permissions list",
                total: total_count,
                page: parseInt(page),
                data: permissions
            });
        } catch (error) {
            console.error("Error in listSystemPermissions:", error);
            return res.status(500).json({
                success: false,
                type: "error",
                message: "Failed to list system permissions",
                error: error.message
            });
        }
    }
}

module.exports = PermissionManager;
