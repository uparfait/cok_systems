

const ServiceDelivery = require('../../models/service_delivery.js');
const Department = require('../../models/department.js');
const { getDepartmentIdsForHead, buildDateFilter } = require('./visitors_by_status');

const getVisitorsByDepartment = async (req, res, next) => {
    try {
        const { departmentId } = req.params;
        let { limit = 20, page = 1, dateFilter, status, from, to } = req.query;

        const limit_val = Math.min(parseInt(limit), 50);
        const skip_val = (parseInt(page) - 1) * limit_val;

        // Get allowed department IDs for head of department
        const allowedDepartmentIds = await getDepartmentIdsForHead(req.user.userId);
        if (allowedDepartmentIds.length === 0) {
            return res.status(403).json({
                success: false,
                type: 'error',
                message: 'No departments found for this user'
            });
        }

        // Check if requested department is allowed
        if (!allowedDepartmentIds.includes(departmentId)) {
            return res.status(403).json({
                success: false,
                type: 'error',
                message: 'Access denied to this department'
            });
        }

        // Build filter
        let filter = {
            departments_assigned: {
                $elemMatch: { department_id: departmentId }
            }
        };

        // Add status filter if provided
        if (status) {
            switch (status) {
                case 'pending':
                    filter['services_status.s_type'] = { $in: ['Not started'] };
                    filter.is_still_inhouse = true;
                    break;
                case 'active':
                    filter['services_status.s_type'] = { $in: ['Inprogress'] };
                    filter.is_being_served = true;
                    filter.is_still_inhouse = true;
                    break;
                case 'transferred':
                    filter['services_status.s_type'] = { $in: ['Transfered', 'Transferred'] };
                    filter.is_still_inhouse = true;
                    break;
                case 'completed':
                    filter['services_status.s_type'] = { $in: ['Completed'] };
                    break;
            }
        }

        // Explicit from/to range takes precedence over the legacy dateFilter presets
        if (from || to) {
            const range = {};
            if (from) { const start = new Date(from); if (!isNaN(start.getTime())) { start.setHours(0, 0, 0, 0); range.$gte = start; } }
            if (to) { const end = new Date(to); if (!isNaN(end.getTime())) { end.setHours(23, 59, 59, 999); range.$lte = end; } }
            if (Object.keys(range).length > 0) filter.entry_date = range;
        } else {
            const dateFilterObj = buildDateFilter(dateFilter);
            if (Object.keys(dateFilterObj).length > 0) {
                Object.assign(filter, dateFilterObj);
            }
        }

        const visitors = await ServiceDelivery.find(filter)
            .limit(limit_val)
            .skip(skip_val)
            .sort({ entry_date: -1 })
            .populate('departments_assigned');

        const total_count = await ServiceDelivery.countDocuments(filter);

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Visitors by department retrieved successfully',
            total: total_count,
            page: parseInt(page),
            limit: limit_val,
            data: visitors
        });

    } catch (error) {
        console.error('Error in getVisitorsByDepartment:', error);
        return res.status(500).json({
            success: false,
            type: 'error',
            message: 'Something went wrong while retrieving visitors by department',
            error: error.message
        });
    }
};

module.exports = {
    getVisitorsByDepartment
};