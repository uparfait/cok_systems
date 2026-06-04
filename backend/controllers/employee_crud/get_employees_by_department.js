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

        // If department_id is provided, use it directly
        if (department_id) {
            filter.$or = [
                { department: department_id },
                { department_unit: department_id }
            ];
        } 
        // If department_name is provided, find the department first
        else if (department_name) {
            const department = await Department.findOne({ 
                $or: [
                    { name: department_name },
                    { name: { $regex: department_name, $options: 'i' } }
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
        if (is_active !== null && is_active !== undefined) {
            filter.is_active = is_active === 'true' || is_active === true;
        }

        // Filter by is_account_activated if provided
        if (is_account_activated !== null && is_account_activated !== undefined) {
            filter.is_account_activated = is_account_activated === 'true' || is_account_activated === true;
        }

        // Fetch employees with the filter
        const employees = await User.find(filter)
            .select('-password -auth')
            .limit(limit_val)
            .skip(skip_val)
            .sort({ created_date: -1 })
            .populate('department', 'name department_id _id')
            .populate('roles', 'role_name');

        const total_count = await User.countDocuments(filter);

        // Get department info if filtering by department
        let department_info = null;
        if (filter.department) {
            department_info = await Department.findById(filter.department)
                .select('name _id total_employees');
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
