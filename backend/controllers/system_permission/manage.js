const SystemPermission = require('../../models/system_permission.js');
const mongoose = require('mongoose');

class SystemPermissionsController {
    // Create a new system permission
    static async create(req, res, next) {
        try {
            const { resource, actions = [] } = req.body || {};

            // Basic validation
            if (!resource || typeof resource !== 'string' || actions.length === 0) {
                return res.status(400).json({
                    success: false,
                    type: "warning",
                    message: "Resource (string) and at least one action are required"
                });
            }

            // check if permission for the same resource already exists
            const existingPermission = await SystemPermission.findOne({ resource: resource.trim() });
            if (existingPermission) {
                return res.status(409).json({
                    success: false,
                    type: "warning",
                    message: "A system permission for this resource already exists"
                });
            }

            // check if actions are not in GET, POST, PUT, DELETE, REALTIME
            const validActionTypes = ['GET', 'POST', 'PUT', 'DELETE', 'REALTIME'];
            
            for (const action of actions) {
                if (!action.action_type || !validActionTypes.includes(action.action_type.toString().toUpperCase())) {
                    return res.status(400).json({
                        success: false,
                        type: "warning",
                        message: "Invalid action type. Must be one of GET, POST, PUT, DELETE, REALTIME"
                    });
                }
            }

            // Normalize actions: uppercase action_type
            const normalizedActions = actions.map(action => ({
                action_type: action.action_type?.toString().toUpperCase(),
                description: action.description || "No description provided"
            }));

            const newPermission = new SystemPermission({
                resource: resource.trim(),
                actions: normalizedActions
            });

            const savedPermission = await newPermission.save();

            return res.status(201).json({
                success: true,
                type: "success",
                message: "System permission created successfully",
                data: savedPermission
            });
        } catch (error) {
            console.error("Error in create system permission:", error);
            return res.status(500).json({
                success: false,
                type: "error",
                message: "Failed to create system permission",
                error: error.message
            });
        }
    }

    // List all permissions
    static async list(req, res, next) {
        try {
            let { limit = 10, page = 1 } = req.query;
            const limit_val = Math.min(parseInt(limit), 50);
            const skip_val = (parseInt(page) - 1) * limit_val;

            const permissions = await SystemPermission.find()
                .limit(limit_val)
                .skip(skip_val)
                .sort({ created_at: -1 });

            const total_count = await SystemPermission.countDocuments();

            return res.status(200).json({
                success: true,
                type: "success",
                message: "System permissions list",
                total: total_count,
                page: parseInt(page),
                data: permissions
            });
        } catch (error) {
            console.error("Error in list system permissions:", error);
            return res.status(500).json({
                success: false,
                type: "error",
                message: "Failed to list system permissions",
                error: error.message
            });
        }
    }

    // Get by ID
    static async getById(req, res, next) {
        try {
            const { id } = req.params;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    type: "warning",
                    message: "Invalid ID format"
                });
            }

            const permission = await SystemPermission.findById(id);
            if (!permission) {
                return res.status(404).json({
                    success: false,
                    type: "warning",
                    message: "System permission not found"
                });
            }

            return res.status(200).json({
                success: true,
                type: "success",
                message: "System permission found",
                data: permission
            });
        } catch (error) {
            console.error("Error in get system permission by id:", error);
            return res.status(500).json({
                success: false,
                type: "error",
                message: "Failed to get system permission",
                error: error.message
            });
        }
    }

    // Update
    static async update(req, res, next) {
        try {
            const { id } = req.params;
            const { resource, actions } = req.body || {};

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    type: "warning",
                    message: "Invalid ID format"
                });
            }

            const permission = await SystemPermission.findById(id);
            if (!permission) {
                return res.status(404).json({
                    success: false,
                    type: "warning",
                    message: "System permission not found"
                });
            }

            // Only update provided fields
            if (resource !== undefined && typeof resource === 'string') {
                permission.resource = resource.trim();
            }

            if (actions !== undefined && Array.isArray(actions)) {
                permission.actions = actions.map(action => ({
                    action_type: action.action_type?.toString().toUpperCase(),
                    description: action.description || "No description provided"
                }));
            }

            const updatedPermission = await permission.save();

            return res.status(200).json({
                success: true,
                type: "success",
                message: "System permission updated successfully",
                data: updatedPermission
            });
        } catch (error) {
            console.error("Error in update system permission:", error);
            return res.status(500).json({
                success: false,
                type: "error",
                message: "Failed to update system permission",
                error: error.message
            });
        }
    }

    // Delete
    static async delete(req, res, next) {
        try {
            const { id } = req.params;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    type: "warning",
                    message: "Invalid ID format"
                });
            }

            const deletedPermission = await SystemPermission.findByIdAndDelete(id);
            if (!deletedPermission) {
                return res.status(404).json({
                    success: false,
                    type: "warning",
                    message: "System permission not found"
                });
            }

            return res.status(200).json({
                success: true,
                type: "success",
                message: "System permission deleted successfully"
            });
        } catch (error) {
            console.error("Error in delete system permission:", error);
            return res.status(500).json({
                success: false,
                type: "error",
                message: "Failed to delete system permission",
                error: error.message
            });
        }
    }
}

module.exports = SystemPermissionsController;
