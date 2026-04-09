

const ServiceDelivery = require('../../models/service_delivery.js');
const Department = require('../../models/department.js');

/**
 * Helper function to get department IDs for head of department
 */
const getDepartmentIdsForHead = async (userId) => {
    const department = await Department.findOne({ department_leader: userId });

    if (!department) {
        return [];
    }

    if (!department.sub_department_mng.is_sub_department) {
        // Main department - get all sub-departments too
        const subDepartments = await Department.find({
            'sub_department_mng.parent_department_id': department._id.toString()
        });

        return [
            department._id.toString(),
            ...subDepartments.map(sub => sub._id.toString())
        ];
    } else {
        // Sub-department - return only this department
        return [department._id.toString()];
    }
};

/**
 * Helper function to build date filter
 */
const buildDateFilter = (dateFilter, dateField = 'entry_date') => {
    if (!dateFilter) return {};

    const now = new Date();
    let startDate, endDate;

    switch (dateFilter) {
        case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            break;
        case 'yesterday':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
        case 'this_week':
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay());
            startDate = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            break;
        case 'last_week':
            const lastWeekStart = new Date(now);
            lastWeekStart.setDate(now.getDate() - now.getDay() - 7);
            const lastWeekEnd = new Date(now);
            lastWeekEnd.setDate(now.getDate() - now.getDay());
            startDate = new Date(lastWeekStart.getFullYear(), lastWeekStart.getMonth(), lastWeekStart.getDate());
            endDate = new Date(lastWeekEnd.getFullYear(), lastWeekEnd.getMonth(), lastWeekEnd.getDate());
            break;
        case 'this_month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            break;
        case 'last_month':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        default:
            return {};
    }

    return {
        [dateField]: {
            $gte: startDate,
            $lt: endDate
        }
    };
};

/**
 * GET /department-manager/visitors/status/:status
 * Fetch visitors by status (pending, active, transferred, completed)
 */
const getVisitorsByStatus = async (req, res, next) => {
    try {
        const { status } = req.params;
        let { limit = 20, page = 1, dateFilter } = req.query;

        const limit_val = Math.min(parseInt(limit), 50);
        const skip_val = (parseInt(page) - 1) * limit_val;

        // Validate status
        const validStatuses = ['pending', 'active', 'transferred', 'completed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                type: 'error',
                message: 'Invalid status. Must be: pending, active, transferred, completed'
            });
        }

        // Get department IDs for head of department
        const departmentIds = await getDepartmentIdsForHead(req.user.userId);
        if (departmentIds.length === 0) {
            return res.status(403).json({
                success: false,
                type: 'error',
                message: 'No departments found for this user'
            });
        }

        // Build filter based on status
        let statusFilter = {};
        let additionalFilter = {};

        switch (status) {
            case 'pending':
                statusFilter = {
                    'services_status.s_type': { $in: ['Not started'] },
                    is_still_inhouse: true
                };
                break;
            case 'active':
                statusFilter = {
                    'services_status.s_type': { $in: ['Inprogress'] },
                    is_being_served: true,
                    is_still_inhouse: true
                };
                break;
            case 'transferred':
                statusFilter = {
                    'services_status.s_type': { $in: ['Transfered', 'Transferred'] },
                    is_still_inhouse: true
                };
                break;
            case 'completed':
                statusFilter = {
                    'services_status.s_type': { $in: ['Completed'] }
                };
                // For completed requests, allow filtering by inhouse status
                if (req.query.inhouse !== undefined) {
                    additionalFilter.is_still_inhouse = req.query.inhouse === 'true';
                }
                break;
        }

        // Add department filter
        additionalFilter.departments_assigned = {
            $elemMatch: { department_id: { $in: departmentIds } }
        };

        // Add date filter if provided
        const dateFilterObj = buildDateFilter(dateFilter);
        if (Object.keys(dateFilterObj).length > 0) {
            Object.assign(additionalFilter, dateFilterObj);
        }

        const filter = { ...statusFilter, ...additionalFilter };

        const visitors = await ServiceDelivery.find(filter)
            .limit(limit_val)
            .skip(skip_val)
            .sort({ entry_date: -1 })
            .populate('departments_assigned');

        const total_count = await ServiceDelivery.countDocuments(filter);

        // Calculate current duration for active visitors
        const visitorsWithDetails = visitors.map((visitor) => {
            const visitorObj = visitor.toObject();

            if (status === 'active' && visitor.is_still_inhouse && visitor.entry_date) {
                const entryTime = new Date(visitor.entry_date);
                const currentTime = new Date();
                const durationMs = currentTime - entryTime;
                const hours = Math.floor(durationMs / (1000 * 60 * 60));
                const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

                visitorObj.current_duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes} mins`;
                visitorObj.current_duration_hours = hours + minutes / 60;
            }

            return visitorObj;
        });

        return res.status(200).json({
            success: true,
            type: 'success',
            message: `${status.charAt(0).toUpperCase() + status.slice(1)} visitors retrieved successfully`,
            total: total_count,
            page: parseInt(page),
            limit: limit_val,
            data: visitorsWithDetails
        });

    } catch (error) {
        console.error('Error in getVisitorsByStatus:', error);
        return res.status(500).json({
            success: false,
            type: 'error',
            message: 'Something went wrong while retrieving visitors',
            error: error.message
        });
    }
};

module.exports = {
    getVisitorsByStatus,
    getDepartmentIdsForHead,
    buildDateFilter
};