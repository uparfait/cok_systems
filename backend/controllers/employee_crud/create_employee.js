const crypto = require('crypto')
const user_model = require('../../models/user.js')
const allowed_resources = require('../../resources/resources.js')
const department_model = require('../../models/department.js')

module.exports = async function create_user(req, res, next) {
    try {
        let {
            full_name = null,
            telephone = null,
            identification = {},
            gender = null,
            title = null,
            email = null,
            department_name = 'Not specified',
            department_id = 'Not specified',
            roles = {}
        } = req.body || {}

        // Validate essential required fields
        if (!full_name || !email || !telephone) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: "Full name, telephone and email are required fields."
            })
        }

        // if department_name and id are available, chek if they are available in database

        if(department_name && department_id && department_name !== 'Not specified' && department_id !== 'Not specified') {
            const dept = await department_model.findOne({ department_id: department_id.toString().toUpperCase(), department_name: department_name.trim() })
            if (!dept) {
                return res.status(404).json({
                    success: false,
                    type: "warning",
                    message: `Department with ID ${department_id} and name ${department_name} does not exist.`
                })
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

        // Validate roles and permissions
        let validatedPermissions = []
        if (roles.permissions && Array.isArray(roles.permissions)) {
            for (const perm of roles.permissions) {
                const resourceDef = allowed_resources.find(
                    r => r.resource_name.toLowerCase() === perm.resource.trim().toLowerCase()
                )
                if (!resourceDef) {
                    return res.status(400).json({
                        success: false,
                        type: "warning",
                        message: `Invalid resource: ${perm.resource}`
                    })
                }

                const validActionTypes = resourceDef.actions.map(a => a.action_type)
                const normalizedActions = []
                for (const action of perm.actions || []) {
                    const upperAction = action.toString().toUpperCase()
                    if (!validActionTypes.includes(upperAction)) {
                        return res.status(400).json({
                            success: false,
                            type: "warning",
                            message: `Invalid action type: ${action} for resource ${perm.resource}`
                        })
                    }
                    normalizedActions.push(upperAction)
                }

                validatedPermissions.push({
                    resource: perm.resource.trim(),
                    actions: normalizedActions
                })
            }
        }

        // Generate system-assigned values
        const generated_password = crypto.randomBytes(8).toString('hex')
        const default_picture = 'https://placehold.co/800?text=CoK&font=roboto'
        const registered_by = req.user ? req.user?.name : 'Not specified'

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
            department_name,
            department_id,
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
                permissions: validatedPermissions
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
                dept.total_employees += 1
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
