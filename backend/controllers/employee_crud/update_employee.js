const mongoose = require('mongoose')
const user_model = require('../../models/user.js')
const allowed_resources = require('../../resources/resources.js')
const department_model = require('../../models/department.js')

module.exports = async function update_user(req, res, next) {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: "Invalid user ID format."
            })
        }

        const {
            full_name,
            telephone,
            identification = {},
            gender,
            title,
            email,
            department_id,
            department_unit, // Extracted department_unit
            access_control,
            roles
        } = req.body || {}

        const user = await user_model.findById(id)
        if (!user) {
            return res.status(404).json({
                success: false,
                type: "warning",
                message: "User not found to update."
            })
        }

        // Uniqueness check
        const conflict_checks = []
        if (email && email !== user.email) conflict_checks.push({ email })
        if (telephone && telephone !== user.telephone) conflict_checks.push({ telephone })

        if (conflict_checks.length > 0) {
            const existing_user = await user_model.findOne({ $or: conflict_checks })
            if (existing_user) {
                const conflict_field = existing_user.email === email ? 'Email' : 'Telephone'
                return res.status(409).json({
                    success: false,
                    type: "warning",
                    message: `${conflict_field} is already in use by another account.`
                })
            }
        }

        /**
         * Handle department change: decrement old department, increment new department
         */
        let oldDeptId = user.department
        let newDeptId = department_id

        if (newDeptId && newDeptId !== 'Not specified' && newDeptId !== oldDeptId) {
            if (!mongoose.Types.ObjectId.isValid(newDeptId)) {
                return res.status(400).json({
                    success: false,
                    type: "warning",
                    message: "Invalid department ID format."
                })
            }

            const newDept = await department_model.findById(newDeptId)
            if (!newDept) {
                return res.status(400).json({
                    success: false,
                    type: "warning",
                    message: "Department not found."
                })
            }

            // Decrement old department employee count
            if (oldDeptId && oldDeptId !== 'Not specified') {
                const oldDept = await department_model.findById(oldDeptId)
                if (oldDept) {
                    oldDept.total_employees = Math.max(0, (oldDept.total_employees || 0) - 1)
                    await oldDept.save()
                }
            }

            // FIXED: Increment new department using total_employees
            newDept.total_employees = (newDept.total_employees || 0) + 1
            await newDept.save()
        } else if (newDeptId === 'Not specified' && user.department && user.department !== 'Not specified') {
            // FIXED: If changing to 'Not specified', decrement old department using total_employees
            const oldDept = await department_model.findById(user.department)
            if (oldDept) {
                oldDept.total_employees = Math.max(0, (oldDept.total_employees || 0) - 1)
                await oldDept.save()
            }
        }

        // Apply updates safely
        if (full_name !== undefined) user.full_name = full_name
        if (telephone !== undefined) user.telephone = telephone
        if (gender !== undefined) user.gender = gender
        if (title !== undefined) user.title = title
        if (email !== undefined) user.email = email
        if (department_id) user.department = department_id === 'Not specified' ? null : department_id
        // Save the department unit safely
        if (department_unit !== undefined) user.department_unit = department_unit === 'Not specified' ? null : department_unit

        if (identification) {
            if (identification.id_type !== undefined) user.identification.id_type = identification.id_type
            if (identification.number !== undefined) user.identification.number = identification.number
        }

        if (access_control) {
            if (access_control.is_locked !== undefined) user.access_control.is_locked = access_control.is_locked
            if (access_control.reason !== undefined) user.access_control.reason = access_control.reason
        }

        if (roles) {
            if (roles.role_name !== undefined) user.roles.role_name = roles.role_name

            // Handle permissions update
            if (roles.permissions !== undefined) {
                if (Array.isArray(roles.permissions)) {
                    // Build complete permissions structure
                    const allResources = allowed_resources.map(r => r.resource_name)
                    const updatedPermissions = []
                    
                    // Get existing permissions for reference
                    const existingPermissions = user.roles.permissions || []
                    
                    // Create a map of existing enabled actions
                    const existingEnabledMap = new Map()
                    existingPermissions.forEach(perm => {
                        const resourceName = perm.resource_name
                        perm.actions.forEach(action => {
                            if (action.is_enabled === 'enabled') {
                                const key = `${resourceName}:${action.action_type}`
                                existingEnabledMap.set(key, true)
                            }
                        })
                    })

                    // Process incoming permissions to enable specific actions
                    const incomingEnabledMap = new Map()
                    for (const perm of roles.permissions) {
                        const resourceName = perm.resource?.trim() || perm.resource_name?.trim()
                        
                        if (!resourceName) continue

                        // Validate resource
                        const resourceDef = allowed_resources.find(
                            r => r.resource_name.toLowerCase() === resourceName.toLowerCase()
                        )
                        
                        if (!resourceDef) {
                            return res.status(400).json({
                                success: false,
                                type: "warning",
                                message: `Invalid resource: ${resourceName}`
                            })
                        }

                        // Get actions to enable
                        const actionsToEnable = perm.actions || []
                        actionsToEnable.forEach(action => {
                            const actionType = typeof action === 'string' ? action : action.action_type
                            const validActionTypes = resourceDef.actions.map(a => a.action_type)
                            
                            if (!validActionTypes.includes(actionType)) {
                                return res.status(400).json({
                                    success: false,
                                    type: "warning",
                                    message: `Invalid action type: ${actionType} for resource ${resourceName}`
                                })
                            }
                            
                            const key = `${resourceName}:${actionType}`
                            incomingEnabledMap.set(key, true)
                        })
                    }

                    // Build complete permissions for all resources
                    allResources.forEach(resourceName => {
                        const resourceDef = allowed_resources.find(r => r.resource_name === resourceName)
                        
                        if (resourceDef) {
                            const resourcePermissions = {
                                resource_name: resourceName,
                                actions: []
                            }
                            
                            resourceDef.actions.forEach(actionDef => {
                                const key = `${resourceName}:${actionDef.action_type}`
                                
                                // Determine if action should be enabled
                                let isEnabled = "disabled"
                                
                                // Check if this action is enabled in incoming request
                                if (incomingEnabledMap.has(key)) {
                                    isEnabled = "enabled"
                                }
                                // Otherwise, preserve existing state if any
                                else if (existingEnabledMap.has(key)) {
                                    isEnabled = "enabled"
                                }
                                
                                resourcePermissions.actions.push({
                                    action_type: actionDef.action_type,
                                    description: actionDef.description,
                                    is_enabled: isEnabled
                                })
                            })
                            
                            updatedPermissions.push(resourcePermissions)
                        }
                    })
                    
                    user.roles.permissions = updatedPermissions
                }
            }
        }

        await user.save()

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Employee data updated successfully"
        })

    } catch (error) {
        console.error("Error in update_user controller:", error)
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Failed to update employee details",
            error: error.message
        })
    }
}