const department_model = require('../../models/department.js')
const mongoose = require('mongoose')

module.exports = async function delete_department(req, res, next) {
    try {
        const { id } = req.params

        // Validate if the ID is a valid MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: `Invalid department ID format`
            })
        }

        // Check if department exists first
        const find_employees = await department_model.findById(id)

        if(!find_employees) {
            return res.status(404).json({
                success: false,                
                type: "warning",
                message: "Department not found"
            })
        }

        // Avoid deleting a department which has sub-departments
        const sub_dept = await department_model.findOne({ parent_department: id })
        if (sub_dept) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: "Cannot delete department with existing sub-departments. Please delete or reassign sub-departments first."
            })
        }

        // Avoid deleting a department which has employees
        const total_employees = find_employees.total_employees || 0
        if (total_employees > 0) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: `Cannot delete department with ${total_employees} assigned employees. Please reassign or remove employees first.`
            })
        }

        // Delete using the MongoDB internal _id
        const deleted_dept = await department_model.findByIdAndDelete(id)

        if (!deleted_dept) {
            return res.status(404).json({
                success: false,
                type: "warning",
                message: "Department not found"
            })
        }

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Department deleted successfully",
            data: { id: deleted_dept._id, name: deleted_dept.department_name }
        })

    } catch (error) {
        console.error("Error in delete_department:", error)
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong during deletion",
            error: error.message
        })
    }
}
