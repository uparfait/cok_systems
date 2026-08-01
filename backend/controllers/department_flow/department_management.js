

const Department = require('../../models/department.js');
const { getDepartmentIdsForHead } = require('./visitors_by_status');

const getManagedDepartments = async (req, res, next) => {
    try {
        const departmentIds = await getDepartmentIdsForHead(req.user.userId);
        if (departmentIds.length === 0) {
            return res.status(403).json({
                success: false,
                type: 'error',
                message: 'No departments found for this user'
            });
        }

        const departments = await Department.find({
            _id: { $in: departmentIds }
        }).populate('department_leader', 'full_name email');

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Managed departments retrieved successfully',
            data: departments
        });

    } catch (error) {
        console.error('Error in getManagedDepartments:', error);
        return res.status(500).json({
            success: false,
            type: 'error',
            message: 'Something went wrong while retrieving departments',
            error: error.message
        });
    }
};


const updateDepartment = async (req, res, next) => {
    try {
        const { departmentId } = req.params;
        const { department_name, department_response_time_in_minutes } = req.body;

        // Get allowed department IDs for head of department
        const allowedDepartmentIds = await getDepartmentIdsForHead(req.user.userId);
        if (!allowedDepartmentIds.includes(departmentId)) {
            return res.status(403).json({
                success: false,
                type: 'error',
                message: 'Access denied to this department'
            });
        }

        // Validate input
        if (!department_name || typeof department_name !== 'string' || department_name.trim().length === 0) {
            return res.status(400).json({
                success: false,
                type: 'error',
                message: 'Department name is required and cannot be empty'
            });
        }

        if (department_response_time_in_minutes !== undefined &&
            (typeof department_response_time_in_minutes !== 'number' || department_response_time_in_minutes < 0)) {
            return res.status(400).json({
                success: false,
                type: 'error',
                message: 'Response time must be a positive number'
            });
        }

        // Update department (schema field is `name`; API accepts `department_name`)
        const updateData = {
            name: department_name.trim()
        };

        if (department_response_time_in_minutes !== undefined) {
            updateData.department_response_time_in_minutes = department_response_time_in_minutes;
        }

        const department = await Department.findByIdAndUpdate(
            departmentId,
            updateData,
            { new: true, runValidators: true }
        );

        if (!department) {
            return res.status(404).json({
                success: false,
                type: 'error',
                message: 'Department not found'
            });
        }

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Department updated successfully',
            data: department
        });

    } catch (error) {
        console.error('Error in updateDepartment:', error);
        return res.status(500).json({
            success: false,
            type: 'error',
            message: 'Something went wrong while updating department',
            error: error.message
        });
    }
};

module.exports = {
    getManagedDepartments,
    updateDepartment
};