
const User = require('../../models/user.js');
const Department = require('../../models/department.js');

/**
 * Get employees filtered by department
 */
module.exports = async function get_employees_by_department(req, res, next) {
    try {
        let { 
            department_id = null, 
            department_name = null,
            is_active = null,
            is_account_activated = null,
            limit = 50, 
            page = 1 
        } = req.query || {};

        const limit_val = Math.min(parseInt(limit), 50);
        const skip_val = (parseInt(page) - 1) * limit_val;

        // Build filter object
        let filter = {};

        // If department_id is provided, use it directly and department_unit
        if (department_id) {
            
            
     // filter where department field matches the provided department_id or department_unit matches the provided department_id (in case department_id is actually a department unit id)
            filter.$or = [
                { department: department_id },
                { department_unit: department_id }
            ];

        } 
        // If department_name is provided, first find the department
        else if (department_name) {
            const department = await Department.findOne({ 
                $or: [
                    { department_name: department_name },
                    { department_name: { $regex: department_name, $options: 'i' } }
                ]
            });
            
            if (department) {
                filter.department = department._id;
            } else {
                return res.status(404).json({
                    success: false,
                    type: 'warning',
                    message: `Department with name "${department_name}" not found`
                });
            }
        }

        // Filter by is_active if provided
        if (is_active !== null) {
            if (is_active === 'true' || is_active === true) {
                filter.is_active = true;
            } else if (is_active === 'false' || is_active === false) {
                filter.is_active = false;
            }
        }

        // Filter by is_account_activated if provided
        if (is_account_activated !== null) {
            if (is_account_activated === 'true' || is_account_activated === true) {
                filter.is_account_activated = true;
            } else if (is_account_activated === 'false' || is_account_activated === false) {
                filter.is_account_activated = false;
            }
        }

        // Fetch employees with the filter
        const employees = await User.find(filter)
            .select('-password -auth')
            .limit(limit_val)
            .skip(skip_val)
            .sort({ created_date: -1 })
            .populate('department', 'department_name department_id');

            

        const total_count = await User.countDocuments(filter);

        // Get department info if filtering by department
        let department_info = null;
        if (filter.department) {
            department_info = await Department.findById(filter.department)
                .select('department_name department_id total_employees');
        }

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Employees retrieved successfully',
            department: department_info,
            total: total_count,
            page: parseInt(page),
            data: employees
        });

    } catch (error) {
        console.error("Error in get_employees_by_department:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while retrieving employees by department",
            error: error.message
        });
    }
};
