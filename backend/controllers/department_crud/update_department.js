const department_model = require('../../models/department.js')
const mongoose = require('mongoose')
const user_model = require('../../models/user.js')

module.exports = async function update_department(req, res, next) {
    try {
        const { id } = req.params
        let {
            department_id = null,
            department_name = null,
            department_leader = null // Expecting an email string
        } = req.body || {}

        // Validate if the ID is a valid MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: `The provided ID '${id}' is not a valid format`
            })
        }

        const department = await department_model.findById(id)

        if (!department) {
            return res.status(404).json({
                success: false,
                type: "warning",
                message: "Department not found"
            })
        }

        if (
            department_id === null &&
            department_name === null &&
            department_leader === null
        ) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: "No valid data provided to update",
            })
        }

        // Verify and load user data if a new leader email was provided
        if (department_leader !== null && department_leader !== undefined) {
            const leader_user = await user_model.findOne({ email: department_leader })
            
            if (!leader_user) {
                return res.status(404).json({
                    success: false,
                    type: "warning",
                    message: `User with email ${department_leader} not found. Cannot assign leader.`
                })
            }

            department.department_leader = {
                name: leader_user.full_name,
                email: leader_user.email,
                title: leader_user.title || "",
                picture: leader_user.picture || ""
            }
        }

        // Validate and update other allowed fields
        if (department_name !== null && department_name !== undefined) department.department_name = department_name
        if (department_id !== null && department_id !== undefined) department.department_id = department_id.toString().toUpperCase()

        department.registered_by = req.user?.name || "Not specified"

        const saved_department = await department.save()

        // Also update all employees whose department matches this one
        await user_model.updateMany(
            { department_id: department.department_id }, // assuming you tie users by string ID based on your user schema
            {
                $set: {
                    department_name: saved_department.department_name,
                    department_id: saved_department.department_id
                }
            }
        )

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Department updated",
            data: saved_department
        })

    } catch (error) {
        console.error("Error in update_department:", error)
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Update failed, check your data and try again",
            error: error.message
        })
    }
}