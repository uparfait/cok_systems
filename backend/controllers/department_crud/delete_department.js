const department_model = require('../../models/department.js')
const user_model = require('../../models/user.js')
const mongoose = require('mongoose')

/** People in a department or unit, counted from the employee accounts (not the stored total). */
async function count_employees(department) {
    const id = department._id
    const name = department.department_name || ''
    return user_model.countDocuments({
        $or: [
            { department: id },
            { department_unit: String(id) },
            ...(name ? [{ department_unit: name }] : []),
        ],
    })
}

module.exports = async function delete_department(req, res, next) {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: `Invalid department ID format`
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

        // Avoid deleting a department which has sub-departments
        const sub_dept = await department_model.findOne({
            $or: [
                { parent_department: id },
                { 'sub_department_mng.is_sub_department': true, 'sub_department_mng.parent_department_id': String(id) },
            ],
        })
        if (sub_dept) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: "Cannot delete department with existing sub-departments. Please delete or reassign sub-departments first."
            })
        }

        // Avoid deleting a department which still has people in it
        const employees = await count_employees(department)
        if (employees > 0) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: `Cannot delete department with ${employees} assigned employee${employees === 1 ? '' : 's'}. Please reassign or remove employees first.`
            })
        }

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
            message: "Something went wrong while deleting the department. Please try again or contact the system administrator."
        })
    }
}
