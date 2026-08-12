

const ServiceDelivery = require('../../models/service_delivery.js');
const Department = require('../../models/department.js');
const User = require('../../models/user.js');

const HOD_ROLE_KEYWORDS = ['department manager', 'department head', 'head of department', 'director'];

/**
 * Helper function to get department IDs for head of department
 * Supports both the current schema (is_unit + parent_department) and the
 * legacy document format (sub_department_mng), and users leading multiple departments.
 * Users with an HOD-type role also manage the department their own account belongs to,
 * even when no department document points at them as leader (matches frontend gating).
 */
const getDepartmentIdsForHead = async (userId) => {
    const ledDepartments = await Department.find({
        $or: [{ department_leader: userId }, { leader: userId }]
    });

    const self = await User.findById(userId).select('department roles.role_name');
    const roleName = (self?.roles?.role_name || '').toLowerCase();
    if (self?.department && HOD_ROLE_KEYWORDS.some(keyword => roleName.includes(keyword))) {
        const ownDepartment = await Department.findById(self.department);
        if (ownDepartment) ledDepartments.push(ownDepartment);
    }

    if (ledDepartments.length === 0) {
        return [];
    }

    const ids = new Set();

    for (const department of ledDepartments) {
        ids.add(department._id.toString());

        const isSubDepartment = department.is_unit === true ||
            department.sub_department_mng?.is_sub_department === true;

        if (!isSubDepartment) {
            // Main department - include its sub-departments (new + legacy format)
            const subDepartments = await Department.find({
                $or: [
                    { parent_department: department._id },
                    { 'sub_department_mng.parent_department_id': department._id.toString() }
                ]
            });
            subDepartments.forEach(sub => ids.add(sub._id.toString()));
        }
    }

    return Array.from(ids);
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