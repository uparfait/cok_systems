const department_model = require('../../models/department.js')
const mongoose = require('mongoose')

module.exports = async function get_department_by_id(req, res, next) {
    try {
        const { department_id } = req.params;

        // Handle both ObjectId and string IDs
        if (!mongoose.Types.ObjectId.isValid(department_id)) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: `Invalid department ID format`
            })
        }

        // Try to find by _id first (ObjectId)
        let department = await department_model.findById(department_id)
            .populate('leader', 'full_name email title')
            .populate('department_leader', 'full_name email title')
            .populate('employees', 'full_name email')
            .populate('parent_department', 'name')

        if (!department) {
            return res.status(404).json({
                success: false,
                type: "warning",
                message: `Department not found`
            })
        }

        // Fetch sub-departments if any
        const subDepartments = await department_model.find({ 
            parent_department: department._id 
        }).populate('leader', 'full_name email title')
        .populate('department_leader', 'full_name email title')

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Department found",
            data: {
                ...department.toObject(),
                total_employees: department.total_employees || 0,
                services: department.services || []
            },
            sub_departments: subDepartments
        })

    } catch (error) {
        console.error("Error in get_department_by_id:", error)
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong, try again later",
            error: error.message
        })
    }
}
