const department_model = require('../../models/department.js')

module.exports = async function get_department_sub_departments(req, res, next) {
    try {
        const { departmentId } = req.params;

        if (!departmentId) {
            return res.status(400).json({
                success: false,
                type: "error",
                message: "Department ID is required"
            });
        }

        // Get sub-departments for the specified department
        const subDepartments = await department_model.find({
            'sub_department_mng.parent_department_id': departmentId,
            'sub_department_mng.is_sub_department': true
        }).populate('department_leader', 'full_name email title picture');

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Sub-departments retrieved successfully",
            data: subDepartments
        });

    } catch (error) {
        console.error("Error in get_department_sub_departments:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while retrieving sub-departments",
            error: error.message
        });
    }
};