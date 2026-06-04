const user_model = require('../../models/user.js')
const Department = require('../../models/department.js');

module.exports = async function get_employees(req, res, next) {
    try {
        let { limit = 50, page = 1 } = req.query

        const limit_val = Math.min(parseInt(limit), 50)
        const skip_val = (parseInt(page) - 1) * limit_val

        const user_role_name = req.user?.role_name;

        let filter = {}

        // If a user is a head of department, only show employees in their department
        if (user_role_name === "Head of department") {
            const department = await Department.findOne({ department_leader: req.user.id })
            
            if (department) {
                filter.department = department._id.toString()
            }
            else {
                return res.status(200).json({
                    success: true,
                    type: "success",
                    message: "Employees list",
                    total: 0,
                    page: parseInt(page),
                    data: []
                })
            }
        }

        // Fetch users while explicitly excluding sensitive fields
        const employees = await user_model.find(filter)
            .select('-password -auth') 
            .limit(limit_val)
            .skip(skip_val)
            .sort({ created_date: -1 })
            .populate('department', 'name department_id _id')
            .populate('roles', 'role_name')

        const total_count = await user_model.countDocuments(filter)

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Employees",
            total: total_count,
            page: parseInt(page),
            data: employees
        })

    } catch (error) {
        console.error("Error in get_employees:", error)
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong, while retrieving employees try again later",
            error: error.message
        })
    }
}
