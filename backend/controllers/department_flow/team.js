
const User = require('../../models/user.js');
const { getDepartmentIdsForHead } = require('./visitors_by_status');

/**
 * GET /department-manager/team
 * List employees belonging to the departments managed by the authenticated head of department.
 */
const getTeamMembers = async (req, res, next) => {
    try {
        let { limit = 20, page = 1, search, is_active } = req.query;

        const limit_val = Math.min(parseInt(limit) || 20, 100);
        const skip_val = ((parseInt(page) || 1) - 1) * limit_val;

        const departmentIds = await getDepartmentIdsForHead(req.user.userId);
        if (departmentIds.length === 0) {
            return res.status(403).json({
                success: false,
                type: 'error',
                message: 'No departments found for this user'
            });
        }

        const filter = { department: { $in: departmentIds } };

        if (is_active !== undefined) {
            filter.is_active = is_active === 'true';
        }

        if (search && search.trim().length > 0) {
            const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [
                { full_name: regex },
                { email: regex },
                { telephone: regex },
                { title: regex }
            ];
        }

        const members = await User.find(filter)
            .select('full_name email telephone gender title department department_unit roles.role_name is_active is_account_activated created_date picture')
            .populate('department', 'name department_id')
            .limit(limit_val)
            .skip(skip_val)
            .sort({ full_name: 1 });

        const total_count = await User.countDocuments(filter);

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Team members retrieved successfully',
            total: total_count,
            page: parseInt(page) || 1,
            limit: limit_val,
            data: members
        });

    } catch (error) {
        console.error('Error in getTeamMembers:', error);
        return res.status(500).json({
            success: false,
            type: 'error',
            message: 'Something went wrong while retrieving team members',
            error: error.message
        });
    }
};

module.exports = {
    getTeamMembers
};
