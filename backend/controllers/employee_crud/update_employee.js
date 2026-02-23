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
            department_name,
            department_id,
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
        let oldDeptId = user.department_id
        let newDeptId = department_id

        if (newDeptId && newDeptId !== 'Not specified' && newDeptId !== oldDeptId) {
            const newDept = await department_model.findOne({ department_id: newDeptId.toString().toUpperCase() })
            if (!newDept) {
                return res.status(400).json({
                    success: false,
                    type: "warning",
                    message: "Invalid department ID"
                })
            }

            // Decrement old department employee count
            if (oldDeptId && oldDeptId !== 'Not specified') {
                const oldDept = await department_model.findOne({ department_id: oldDeptId.toString().toUpperCase() })
                if (oldDept) {
                    oldDept.total_employees = Math.max(0, oldDept.total_employees - 1)
                    await oldDept.save()
                }
            }

            // Increment new department employee count
            newDept.total_employees = (newDept.total_employees || 0) + 1
            await newDept.save()
        }

        // Apply updates safely
        if (full_name !== undefined) user.full_name = full_name
        if (telephone !== undefined) user.telephone = telephone
        if (gender !== undefined) user.gender = gender
        if (title !== undefined) user.title = title
        if (email !== undefined) user.email = email
        if (department_name !== undefined) user.department_name = department_name
        if (department_id !== undefined) user.department_id = department_id

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

            if (roles.permissions !== undefined && Array.isArray(roles.permissions)) {
                const validatedPermissions = []
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
                user.roles.permissions = validatedPermissions
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
