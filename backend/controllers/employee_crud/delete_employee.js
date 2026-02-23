const mongoose = require('mongoose')
const user_model = require('../../models/user.js')
const department_model = require('../../models/department.js')

module.exports = async function delete_employee(req, res, next) {
    try {
        const { id } = req.params

        //  Validate ID format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: "Invalid ID format"
            })
        }

        //  Prevent self-deletion
        if (req.user && req.user?.id === id) {
            return res.status(403).json({
                success: false,
                type: "warning",
                message: "You cannot delete your own account"
            })
        }

        // check if user have a department and decrement employee in that department

            const user = await user_model.findById(id)
            if (!user) {
                return res.status(404).json({
                    success: false,
                    type: "warning",
                    message: "Employee not found"
                })
            }

            if(user.department_id && user.department_id !== 'Not specified') {
                const dept = await department_model.findOne({ department_id: user.department_id })
                if (dept) {
                    dept.total_employees = Math.max(dept.total_employees - 1, 0)
                    await dept.save()
                }
            }

        //  Perform deletion
        const deleted_user = await user_model.findByIdAndDelete(id)

        if (!deleted_user) {
            return res.status(404).json({
                success: false,
                type: "warning",
                message: "Employee not found or already deleted"
            })
        }

        return res.status(200).json({
            success: true,
            type: "success",
            message: `Account for ${deleted_user.full_name} has been successfully removed`,
            data: { id: deleted_user._id }
        })

    } catch (error) {
        console.error("Error in delete_employee:", error)
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Internal server error during deletion of employee"
        })
    }
}