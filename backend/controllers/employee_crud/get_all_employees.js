const user_model = require('../../models/user.js')
const Department = require('../../models/department.js');

module.exports = async function get_employees(req, res, next) {
    try {
        let { limit = 50, page = 1 } = req.query

        const limit_val = Math.min(parseInt(limit), 50)
        const skip_val = (parseInt(page) - 1) * limit_val

        const user_role_name = req.user?.role_name;


        let filter = {}

        // so if a user is a head of department, then we will only show the employees that are in his department and department unit if he has one, if not we will show all employees
        if (user_role_name === "Head of department") {
            // fetch the department of the head of department
            const department = await Department.findOne({ department_leader: req.user.id })
            
            if (department) {
                // if it is not a sub department add filter to be a department id
                if (!department.sub_department_mng.is_sub_department) {
                    filter.department = department._id.toString()
                } else {
                    // if it is a sub department add filter to be a department unit id
                    filter.department_unit = department._id.toString()
                }
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
            .sort({ created_date: -1 }).populate('department', 'department_name department_id')

        const total_count = await user_model.countDocuments()

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Employees",
            total: total_count,
            page: parseInt(page),
            data: employees,
            tols: employees.length
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