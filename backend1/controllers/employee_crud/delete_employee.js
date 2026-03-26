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
                message: "You cannot delete your own account!"
            })
        }
      
            const user = await user_model.findById(id)

            if (!user) {
                return res.status(404).json({
                    success: false,
                    type: "warning",
                    message: "Employee not found"
                })
            }

        // prevent from deleting department leader account if they are assigned as leader to any department, they need to be removed as leader first before deleting their account

        const leading_departments = await department_model.find({ department_leader: id })

        if (leading_departments && leading_departments.length > 0) {
            const dept_names = leading_departments.map(d => d.department_name).join(', ')
            return res.status(400).json({
                success: false, 
                type: "warning",
                message: `Cannot delete a Employee because he/she is department leader in: ${dept_names}`
            })
        }

          // check if user have a department and decrement employee in that department


            if(user.department && user.department !== 'Not specified') {
                const dept = await department_model.findById(user.department)
                if(dept) {
                    dept.number_of_employees = Math.max(0, (dept.number_of_employees || 1) - 1)
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