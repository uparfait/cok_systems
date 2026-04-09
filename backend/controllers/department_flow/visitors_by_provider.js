
const ServiceDelivery = require('../../models/service_delivery.js');
const Department = require('../../models/department.js');
const { getDepartmentIdsForHead, buildDateFilter } = require('./visitors_by_status');

const getVisitorsByProvider = async (req, res, next) => {
    try {
        const { providerId } = req.params;
        let { limit = 20, page = 1, dateFilter } = req.query;

        const limit_val = Math.min(parseInt(limit), 50);
        const skip_val = (parseInt(page) - 1) * limit_val;

        // Get department IDs for head of department
        const departmentIds = await getDepartmentIdsForHead(req.user.userId);
        if (departmentIds.length === 0) {
            return res.status(403).json({
                success: false,
                type: 'error',
                message: 'No departments found for this user'
            });
        }

        // Build filter
        let filter = {
            $or: [
                { 'services_status.provider_id': providerId },
                { 'departments_assigned.provider_id': providerId }
            ],
            departments_assigned: {
                $elemMatch: { department_id: { $in: departmentIds } }
            }
        };

        // Add date filter if provided
        const dateFilterObj = buildDateFilter(dateFilter);
        if (Object.keys(dateFilterObj).length > 0) {
            Object.assign(filter, dateFilterObj);
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
            message: 'Visitors by provider retrieved successfully',
            total: total_count,
            page: parseInt(page),
            limit: limit_val,
            data: visitors
        });

    } catch (error) {
        console.error('Error in getVisitorsByProvider:', error);
        return res.status(500).json({
            success: false,
            type: 'error',
            message: 'Something went wrong while retrieving visitors by provider',
            error: error.message
        });
    }
};

module.exports = {
    getVisitorsByProvider
};