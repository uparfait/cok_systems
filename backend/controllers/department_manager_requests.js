/**
 * Department Manager Requests
 * Comprehensive API endpoints for department manager functionality
 */

const ServiceDelivery = require('../models/service_delivery.js');
const Department = require('../models/department.js');
const User = require('../models/user.js');
const Feedback = require('../models/feedback_db.js');

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

/**
 * GET /department-manager/visitors/provider/:providerId
 * Fetch visitors by provider with pagination
 */
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

/**
 * GET /department-manager/visitors/department/:departmentId
 * Fetch visitors by department with date filtering
 */
const getVisitorsByDepartment = async (req, res, next) => {
    try {
        const { departmentId } = req.params;
        let { limit = 20, page = 1, dateFilter, status } = req.query;

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

/**
 * GET /department-manager/departments
 * Get departments managed by head of department
 */
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

/**
 * PUT /department-manager/departments/:departmentId
 * Update department details (name, response time)
 */
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

        // Update department
        const updateData = {
            department_name: department_name.trim()
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

/**
 * GET /department-manager/analytics/response-time
 * Get average response time per provider for department
 */
const getResponseTimeAnalytics = async (req, res, next) => {
    try {
        // Get department IDs for head of department
        const departmentIds = await getDepartmentIdsForHead(req.user.userId);
        if (departmentIds.length === 0) {
            return res.status(403).json({
                success: false,
                type: 'error',
                message: 'No departments found for this user'
            });
        }

        // Get departments with response times > 0
        const departments = await Department.find({
            _id: { $in: departmentIds },
            department_response_time_in_minutes: { $gt: 0 }
        });

        // Calculate average response time per provider
        const analytics = [];

        for (const dept of departments) {
            // Get all services for this department
            const services = await ServiceDelivery.find({
                'services_status.department_id': dept._id.toString(),
                'durations.services_durations': { $exists: true, $ne: [] }
            });

            const providerStats = {};

            services.forEach(service => {
                const deptServices = service.services_status?.filter(s =>
                    s.department_id === dept._id.toString()
                ) || [];

                deptServices.forEach(serviceStatus => {
                    const providerId = serviceStatus.provider_id;
                    const providerName = serviceStatus.provider_name;

                    if (providerId && providerName) {
                        if (!providerStats[providerId]) {
                            providerStats[providerId] = {
                                provider_id: providerId,
                                provider_name: providerName,
                                total_services: 0,
                                total_response_time: 0,
                                average_response_time: 0
                            };
                        }

                        // Find service duration for this provider
                        const duration = service.durations?.services_durations?.find(d =>
                            d.provider_id === providerId
                        );

                        if (duration && duration.started_at) {
                            const serviceStart = new Date(duration.started_at);
                            const entryTime = new Date(service.entry_date || service.createdAt);
                            const responseTimeMinutes = Math.max(0,
                                (serviceStart.getTime() - entryTime.getTime()) / (1000 * 60)
                            );

                            providerStats[providerId].total_services++;
                            providerStats[providerId].total_response_time += responseTimeMinutes;
                        }
                    }
                });
            });

            // Calculate averages
            Object.values(providerStats).forEach((stat: any) => {
                if (stat.total_services > 0) {
                    stat.average_response_time = stat.total_response_time / stat.total_services;
                }
            });

            analytics.push({
                department_id: dept._id,
                department_name: dept.department_name,
                expected_response_time: dept.department_response_time_in_minutes,
                provider_stats: Object.values(providerStats)
            });
        }

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Response time analytics retrieved successfully',
            data: analytics
        });

    } catch (error) {
        console.error('Error in getResponseTimeAnalytics:', error);
        return res.status(500).json({
            success: false,
            type: 'error',
            message: 'Something went wrong while retrieving analytics',
            error: error.message
        });
    }
};

/**
 * GET /department-manager/feedback
 * Get feedback for managed departments
 */
const getDepartmentFeedback = async (req, res, next) => {
    try {
        let { limit = 20, page = 1, dateFilter, rating } = req.query;

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
            department_id: { $in: departmentIds }
        };

        // Add rating filter if provided
        if (rating) {
            const ratingNum = parseInt(rating);
            if (!isNaN(ratingNum) && ratingNum >= 1 && ratingNum <= 10) {
                filter.rate = ratingNum;
            }
        }

        // Add date filter if provided
        const dateFilterObj = buildDateFilter(dateFilter, 'created_date');
        if (Object.keys(dateFilterObj).length > 0) {
            Object.assign(filter, dateFilterObj);
        }

        const feedback = await Feedback.find(filter)
            .limit(limit_val)
            .skip(skip_val)
            .sort({ created_date: -1 });

        const total_count = await Feedback.countDocuments(filter);

        // Calculate average rating
        const ratingStats = await Feedback.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    average_rating: { $avg: '$rate' },
                    total_feedback: { $sum: 1 },
                    rating_distribution: {
                        $push: '$rate'
                    }
                }
            }
        ]);

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Department feedback retrieved successfully',
            total: total_count,
            page: parseInt(page),
            limit: limit_val,
            data: feedback,
            analytics: ratingStats[0] || {
                average_rating: 0,
                total_feedback: 0,
                rating_distribution: []
            }
        });

    } catch (error) {
        console.error('Error in getDepartmentFeedback:', error);
        return res.status(500).json({
            success: false,
            type: 'error',
            message: 'Something went wrong while retrieving feedback',
            error: error.message
        });
    }
};

module.exports = {
    getVisitorsByStatus,
    getVisitorsByProvider,
    getVisitorsByDepartment,
    getManagedDepartments,
    updateDepartment,
    getResponseTimeAnalytics,
    getDepartmentFeedback
};