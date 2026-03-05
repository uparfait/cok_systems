const crypto = require('crypto')
const user_model = require('../../models/user.js')
const allowed_resources = require('../../resources/resources.js')
const department_model = require('../../models/department.js')
const mongoose = require('mongoose')

module.exports = async function create_user(req, res, next) {
    try {
        let {
            full_name = null,
            telephone = null,
            identification = {},
            gender = null,
            title = null,
            email = null,
            department_id = null,
            roles = {}
        } = req.body || {}

        let dpt = null

        // Validate essential required fields
        if (!full_name || !email || !telephone) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: "Full name, telephone and email are required"
            })
        }

        // if department_id is available and is of mongodb valid id
        if (department_id && department_id !== 'Not specified') { 
            if(mongoose.Types.ObjectId.isValid(department_id)) {
                const dept = await department_model.findById(department_id)

                if (!dept) {
                    return res.status(404).json({
                        success: false,
                        type: "warning",
                        message: `This department not found! create it or use another department.`
                    })
                }

                dpt = dept
            }
        }

        // Uniqueness check
        const query_conditions = []
        if (email) query_conditions.push({ email })
        if (telephone) query_conditions.push({ telephone })

        if (query_conditions.length > 0) {
            const existing_user = await user_model.findOne({ $or: query_conditions })
            if (existing_user) {
                const conflict_field = existing_user.email === email ? 'Email' : 'Telephone'
                return res.status(409).json({
                    success: false,
                    type: "warning",
                    message: `${conflict_field} already exists in the system.`
                })
            }
        }

        // Build complete permissions array with all resources
        const allPermissions = []
        
        // Get all available resources from allowed_resources
        const allResources = allowed_resources.map(r => r.resource_name)
        
        // Create base permissions structure for each resource
        allResources.forEach(resourceName => {
            // Find the resource definition to get all available actions
            const resourceDef = allowed_resources.find(r => r.resource_name === resourceName)
            
            if (resourceDef) {
                // For each action in the resource definition, create a permission entry
                resourceDef.actions.forEach(actionDef => {
                    allPermissions.push({
                        resource_name: resourceName,
                        actions: [{
                            action_type: actionDef.action_type,
                            description: actionDef.description,
                            is_enabled: "disabled" // Default to disabled
                        }]
                    })
                })
            }
        })

        // Process incoming permissions if provided
        if (roles.permissions && Array.isArray(roles.permissions)) {
            for (const perm of roles.permissions) {
                const resourceName = perm.resource?.trim() || perm.resource_name?.trim()
                
                if (!resourceName) continue

                // Validate resource exists
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

                // Get actions from incoming permission
                const incomingActions = perm.actions || []
                
                // For each incoming action, find and enable it in allPermissions
                incomingActions.forEach(action => {
                    const actionType = typeof action === 'string' ? action : action.action_type
                    
                    // Find the matching permission in allPermissions
                    const targetPermission = allPermissions.find(p => 
                        p.resource_name.toLowerCase() === resourceName.toLowerCase() &&
                        p.actions[0].action_type === actionType
                    )
                    
                    if (targetPermission) {
                        targetPermission.actions[0].is_enabled = "enabled"
                    }
                })
            }
        }

        // Group permissions by resource for final structure
        const groupedPermissions = []
        const resourceMap = new Map()

        allPermissions.forEach(perm => {
            const resourceName = perm.resource_name
            if (!resourceMap.has(resourceName)) {
                resourceMap.set(resourceName, {
                    resource_name: resourceName,
                    actions: []
                })
                groupedPermissions.push(resourceMap.get(resourceName))
            }
            
            resourceMap.get(resourceName).actions.push(perm.actions[0])
        })

        // Generate system-assigned values
        const generated_password = crypto.randomBytes(8).toString('hex')
        const default_picture = 'https://placehold.co/800?text=CoK&font=roboto'
        const registered_by = req.user ? req.user?.name || req.user?.email || 'System' : 'System'

        const new_user = new user_model({
            full_name,
            telephone,
            identification: {
                id_type: identification.id_type || 'Not specified',
                number: identification.number || 'Not specified'
            },
            picture: default_picture,
            gender: gender || 'Not specified',
            title: title || 'Not specified',
            email,
            department: dpt ? dpt._id : null,
            password: generated_password,
            access_control: {
                is_locked: false,
                reason: null,
                last_login_attempt: 0
            },
            auth: {
                access_token: { token_type: null, token: null }
            },
            roles: {
                role_name: roles.role_name || 'Not specified',
                permissions: groupedPermissions
            },
            is_active: false,
            is_account_activated: false,
            registered_by
        })

        await new_user.save()

        // increment total_employees in the department
        if(department_id && department_id !== 'Not specified') {
            const dept = await department_model.findOne({ department_id: department_id.toString().toUpperCase() })
            if (dept) {
                dept.total_employees = (dept.total_employees || 0) + 1
                await dept.save()
            }
        }

        return res.status(201).json({
            success: true,
            type: "success",
            message: "Employee account created successfully. Account activation is required."
        })

    } catch (error) {
        console.error("Error in create_user controller:", error)
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while creating the user",
            error: error.message
        })
    }
}