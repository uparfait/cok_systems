
const User = require('../../models/user.js');
const Department = require('../../models/department.js');
const Role = require('../../models/default_roles.js');
const EmergencyCar = require('../../models/emergency_car.js');
const EmergencyCarHistory = require('../../models/emergency_car_history.js');
const FlaggedVehicle = require('../../models/flagged_vehicle.js');
const ParkingRecord = require('../../models/parking_record.js');
const ServiceDelivery = require('../../models/service_delivery.js');
const Feedback = require('../../models/feedback_db.js');
const UnservicedFeedback = require('../../models/unservicedfeedback_db.js');
const Task = require('../../models/task.js');
const ParkingSlot = require('../../models/parking_slots.js');

/**
 * Get all available roles along with their permissions
 */
const getRolesWithPermissions = async (req, res) => {
    try {
        const roles = await Role.find({}).select('role_name permissions');

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Roles with permissions retrieved successfully',
            data: {
                total_roles: roles.length,
                roles: roles
            }
        });
    } catch (error) {
        console.error("Error in getRolesWithPermissions:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while fetching roles with permissions",
            error: error.message
        });
    }
};

/**
 * Get all departments along with their leaders
 */
const getDepartmentsWithLeaders = async (req, res) => {
    try {
        const departments = await Department.find({})
            .populate('department_leader', 'full_name email title')
            .select('department_name department_id department_leader total_employees created_date');

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Departments with leaders retrieved successfully',
            data: {
                total_departments: departments.length,
                departments: departments
            }
        });
    } catch (error) {
        console.error("Error in getDepartmentsWithLeaders:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while fetching departments with leaders",
            error: error.message
        });
    }
};

/**
 * Get employee statistics
 * Returns: total, active, inactive, activated, not activated, locked, not locked
 */
const getEmployeeStats = async (req, res) => {
    try {
        // Total employees
        const totalEmployees = await User.countDocuments({});

        // Active employees
        const activeEmployees = await User.countDocuments({ is_active: true });

        // Inactive employees
        const inactiveEmployees = await User.countDocuments({ is_active: false });

        // Activated accounts
        const activatedEmployees = await User.countDocuments({ is_account_activated: true });

        // Not activated accounts
        const notActivatedEmployees = await User.countDocuments({ is_account_activated: false });

        // Locked accounts
        const lockedEmployees = await User.countDocuments({ 'access_control.is_locked': true });

        // Not locked accounts
        const notLockedEmployees = await User.countDocuments({ 'access_control.is_locked': false });

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Employee statistics retrieved successfully',
            data: {
                total: totalEmployees,
                active: activeEmployees,
                inactive: inactiveEmployees,
                activated: activatedEmployees,
                not_activated: notActivatedEmployees,
                locked: lockedEmployees,
                not_locked: notLockedEmployees
            }
        });
    } catch (error) {
        console.error("Error in getEmployeeStats:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while fetching employee statistics",
            error: error.message
        });
    }
};

/**
 * Get emergency cars statistics
 * Returns: total active (current) and expired (history) emergency cars
 */
const getEmergencyCarsStats = async (req, res) => {
    try {
        // Get current valid emergency cars (not expired)
        const now = new Date();
        const activeEmergencyCars = await EmergencyCar.countDocuments({
            'validity.to': { $gte: now }
        });

        // Get expired emergency cars from history
        const expiredEmergencyCars = await EmergencyCar.countDocuments({
            'validity.to': { $lt: now }
        });

        // Total across both
        const totalEmergencyCars = activeEmergencyCars + expiredEmergencyCars;

        // Get additional details - count of unique plates in active
        const activePlates = await EmergencyCar.aggregate([
            { $match: { 'validity.to': { $gte: now } } },
            { $unwind: '$visitor_info' },
            { $count: 'total_vehicles' }
        ]);

        // Get additional details - count of unique plates in history
        const historyPlates = await EmergencyCar.aggregate([
            { $match: { 'validity.to': { $lt: now } } },
            { $unwind: '$visitor_info' },
            { $count: 'total_vehicles' }
        ]);

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Emergency cars statistics retrieved successfully',
            data: {
                total: totalEmergencyCars,
                active: activeEmergencyCars,
                expired: expiredEmergencyCars,
                active_vehicles_count: activePlates.length > 0 ? activePlates[0].total_vehicles : 0,
                history_vehicles_count: historyPlates.length > 0 ? historyPlates[0].total_vehicles : 0
            }
        });
    } catch (error) {
        console.error("Error in getEmergencyCarsStats:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while fetching emergency cars statistics",
            error: error.message
        });
    }
};

/**
 * Get flagged vehicles statistics
 * Returns: total currently flagged, total in history, min and max minutes
 */
const getFlaggedVehiclesStats = async (req, res) => {
    try {
        // Currently flagged vehicles (check_in_time exists but no check_out_time)
        const currentlyFlagged = await ParkingRecord.find({
            is_flagged: true
        });

        // Historical flagged vehicles (have check_out_time)
        const historyFlagged = await FlaggedVehicle.find({});

        // Calculate min and max minutes for currently flagged it might be hours or minutes
        let minMinutesCurrent = 0;
        let maxMinutesCurrent = 0;
        if (currentlyFlagged.length > 0) {
            const currentMinutes = currentlyFlagged.map(v => v.duration || 0);
            // check if includers min,mins,hour,hours and calculate accordingly
            const currentMinutesInMins = currentMinutes.map(d => {
                if (typeof d === 'string') {
                    const lower = d.toLowerCase();
                    if (lower.includes('hour')) {
                        const num = parseFloat(lower.replace('hours', '').replace('hour', '').trim());
                        return num * 60;
                    } else if (lower.includes('min')) {
                        const num = parseFloat(lower.replace('mins', '').replace('min', '').trim());
                        return num;
                    }
                }
                return 0;
            });
            minMinutesCurrent = Math.min(...currentMinutesInMins);
            maxMinutesCurrent = Math.max(...currentMinutesInMins);
        }

        // Calculate min and max minutes for history
        let minMinutesHistory = 0;
        let maxMinutesHistory = 0;
        if (historyFlagged.length > 0) {
            const historyMinutes = historyFlagged.map(v => v.flagged_duration_minutes || 0);
            minMinutesHistory = Math.min(...historyMinutes);
            maxMinutesHistory = Math.max(...historyMinutes);
        }

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Flagged vehicles statistics retrieved successfully',
            data: {
                total: currentlyFlagged.length + historyFlagged.length,
                currently_flagged: {
                    count: currentlyFlagged.length,
                    min_minutes: minMinutesCurrent,
                    max_minutes: maxMinutesCurrent
                },
                history: {
                    count: historyFlagged.length,
                    min_minutes: minMinutesHistory,
                    max_minutes: maxMinutesHistory
                }
            }
        });
    } catch (error) {
        console.error("Error in getFlaggedVehiclesStats:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while fetching flagged vehicles statistics",
            error: error.message
        });
    }
};

/**
 * Get currently parked vehicles statistics
 * Returns: total currently parked and breakdown by driver_type
 */
const getCurrentlyParkedStats = async (req, res) => {
    try {
        // Total currently parked (status = active)
        const totalParked = await ParkingRecord.countDocuments({ status: 'active' });

        // Breakdown by driver type
        const parkedByDriverType = await ParkingRecord.aggregate([
            { $match: { status: 'active' } },
            { $group: { _id: '$driver_type', count: { $sum: 1 } } }
        ]);

        // Format the driver type breakdown
        const driverTypeBreakdown = {};
        parkedByDriverType.forEach(item => {
            driverTypeBreakdown[item._id || 'Unknown'] = item.count;
        });

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Currently parked statistics retrieved successfully',
            data: {
                total: totalParked,
                by_driver_type: driverTypeBreakdown
            }
        });
    } catch (error) {
        console.error("Error in getCurrentlyParkedStats:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while fetching currently parked statistics",
            error: error.message
        });
    }
};

/**
 * Get service delivery statistics
 * Returns: total inhouse, breakdown by status, breakdown by department
 */
const getServiceDeliveryStats = async (req, res) => {
    try {
        // Total inhouse (is_still_inhouse = true)
        const totalInhouse = await ServiceDelivery.countDocuments({ is_still_inhouse: true });

        // Total completed (is_still_inhouse = false)
        const totalCompleted = await ServiceDelivery.countDocuments({ is_still_inhouse: false });

        // Overall total
        const total = await ServiceDelivery.countDocuments({});

        // Breakdown by status (from services_status array)
        const statusBreakdown = await ServiceDelivery.aggregate([
            { $match: { is_still_inhouse: true } },
            { $unwind: '$services_status' },
            { $group: { _id: '$services_status.s_type', count: { $sum: 1 } } }
        ]);

        // Format status breakdown
        const statusCounts = {};
        statusBreakdown.forEach(item => {
            statusCounts[item._id || 'Unknown'] = item.count;
        });

        // Breakdown by department (from departments_assigned)
        const departmentBreakdown = await ServiceDelivery.aggregate([
            { $match: { is_still_inhouse: true } },
            { $unwind: '$departments_assigned' },
            { $group: { _id: '$departments_assigned.department_name', count: { $sum: 1 } } }
        ]);

        // Format department breakdown
        const departmentCounts = {};
        departmentBreakdown.forEach(item => {
            if (item._id) {
                departmentCounts[item._id] = item.count;
            }
        });

        // Breakdown by department over ALL services (inhouse + completed),
        // so charts can match the overall total
        const departmentBreakdownTotal = await ServiceDelivery.aggregate([
            { $unwind: '$departments_assigned' },
            { $group: { _id: '$departments_assigned.department_name', count: { $sum: 1 } } }
        ]);

        const departmentCountsTotal = {};
        departmentBreakdownTotal.forEach(item => {
            if (item._id) {
                departmentCountsTotal[item._id] = item.count;
            }
        });

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Service delivery statistics retrieved successfully',
            data: {
                total: total,
                inhouse: totalInhouse,
                completed: totalCompleted,
                by_status: statusCounts,
                by_department: departmentCounts,
                by_department_total: departmentCountsTotal
            }
        });
    } catch (error) {
        console.error("Error in getServiceDeliveryStats:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while fetching service delivery statistics",
            error: error.message
        });
    }
};

/**
 * Get feedback totals
 * Returns: total feedback and breakdown by department
 */
const getFeedbackTotals = async (req, res) => {
    try {
        // Optional period filter (today/week/month/last_month/year/range) — no params keeps all-time behavior
        const { period, from, to } = req.query || {};
        const bounds = getActivityPeriodBounds(period, from, to);
        const dateMatch = bounds ? { created_date: { $gte: bounds.start, $lte: bounds.end } } : {};

        // Total feedback = department feedback + general (unserviced) feedback
        const totalDepartmentFeedback = await Feedback.countDocuments(dateMatch);
        const totalGeneralFeedback = await UnservicedFeedback.countDocuments(dateMatch);
        const totalFeedback = totalDepartmentFeedback + totalGeneralFeedback;

        // Breakdown by department
        const feedbackByDepartment = await Feedback.aggregate([
            ...(bounds ? [{ $match: dateMatch }] : []),
            { $group: { _id: '$department_name', count: { $sum: 1 } } }
        ]);

        // Format department breakdown
        const departmentCounts = {};
        feedbackByDepartment.forEach(item => {
            if (item._id) {
                departmentCounts[item._id] = item.count;
            }
        });

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Feedback totals retrieved successfully',
            data: {
                total: totalFeedback,
                department_total: totalDepartmentFeedback,
                general_total: totalGeneralFeedback,
                by_department: departmentCounts
            }
        });
    } catch (error) {
        console.error("Error in getFeedbackTotals:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while fetching feedback totals",
            error: error.message
        });
    }
};

/**
 * Get feedback average rate by department
 * Returns: average rating for each department
 */
const getFeedbackAverageByDepartment = async (req, res) => {
    try {
        // Optional period filter (today/week/month/last_month/year/range) — no params keeps all-time behavior
        const { period, from, to } = req.query || {};
        const bounds = getActivityPeriodBounds(period, from, to);
        const dateMatch = bounds ? [{ $match: { created_date: { $gte: bounds.start, $lte: bounds.end } } }] : [];

        // Calculate average by department
        const averageByDepartment = await Feedback.aggregate([
            ...dateMatch,
            {
                $group: {
                    _id: '$department_name',
                    averageRate: { $avg: '$rate' },
                    totalFeedback: { $sum: 1 },
                    avgRateOutOf: { $avg: '$rate_out_of' }
                }
            }
        ]);

        // Format the results
        const departmentAverages = {};
        averageByDepartment.forEach(item => {
            if (item._id) {
                departmentAverages[item._id] = {
                    average_rating: item.averageRate ? parseFloat(item.averageRate.toFixed(2)) : 0,
                    total_feedback: item.totalFeedback,
                    average_out_of: item.avgRateOutOf ? parseFloat(item.avgRateOutOf.toFixed(2)) : 5
                };
            }
        });

        // Overall average
        const overallAverage = await Feedback.aggregate([
            ...dateMatch,
            {
                $group: {
                    _id: null,
                    averageRate: { $avg: '$rate' },
                    totalFeedback: { $sum: 1 }
                }
            }
        ]);

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Feedback average by department retrieved successfully',
            data: {
                by_department: departmentAverages,
                overall_average: overallAverage.length > 0 ? {
                    average_rating: overallAverage[0].averageRate ? parseFloat(overallAverage[0].averageRate.toFixed(2)) : 0,
                    total_feedback: overallAverage[0].totalFeedback
                } : { average_rating: 0, total_feedback: 0 }
            }
        });
    } catch (error) {
        console.error("Error in getFeedbackAverageByDepartment:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while fetching feedback average by department",
            error: error.message
        });
    }
};

/**
 * Get feedback sentiment per department plus general (unserviced) feedback,
 * optionally limited to a created_date range (?from=ISO&to=ISO).
 * Sentiment thresholds mirror the frontend: ratio >= 0.7 positive, >= 0.4 neutral, else negative.
 */
const getFeedbackSentiment = async (req, res) => {
    try {
        const { from, to } = req.query;
        const dateMatch = {};
        if (from) dateMatch.$gte = new Date(from);
        if (to) dateMatch.$lte = new Date(to);
        const match = Object.keys(dateMatch).length ? { created_date: dateMatch } : {};

        // ratio guards against rate_out_of being missing or zero (defaults to /10)
        const sentimentPipeline = (groupId) => ([
            { $match: match },
            {
                $addFields: {
                    ratio: {
                        $cond: [
                            { $gt: [{ $ifNull: ['$rate_out_of', 10] }, 0] },
                            { $divide: [{ $ifNull: ['$rate', 0] }, { $ifNull: ['$rate_out_of', 10] }] },
                            0
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: groupId,
                    average_rating: { $avg: '$rate' },
                    count: { $sum: 1 },
                    positive: { $sum: { $cond: [{ $gte: ['$ratio', 0.7] }, 1, 0] } },
                    neutral: { $sum: { $cond: [{ $and: [{ $gte: ['$ratio', 0.4] }, { $lt: ['$ratio', 0.7] }] }, 1, 0] } },
                    negative: { $sum: { $cond: [{ $lt: ['$ratio', 0.4] }, 1, 0] } }
                }
            }
        ]);

        const [byDepartment, generalAgg] = await Promise.all([
            Feedback.aggregate(sentimentPipeline('$department_name')),
            UnservicedFeedback.aggregate(sentimentPipeline(null))
        ]);

        const departments = byDepartment
            .filter(d => d._id)
            .map(d => ({
                name: d._id,
                average_rating: d.average_rating ? parseFloat(d.average_rating.toFixed(2)) : 0,
                count: d.count,
                positive: d.positive,
                neutral: d.neutral,
                negative: d.negative
            }));

        const g = generalAgg[0];
        const general = g
            ? {
                average_rating: g.average_rating ? parseFloat(g.average_rating.toFixed(2)) : 0,
                count: g.count,
                positive: g.positive,
                neutral: g.neutral,
                negative: g.negative
            }
            : { average_rating: 0, count: 0, positive: 0, neutral: 0, negative: 0 };

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Feedback sentiment retrieved successfully',
            data: { departments, general }
        });
    } catch (error) {
        console.error("Error in getFeedbackSentiment:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while fetching feedback sentiment",
            error: error.message
        });
    }
};

/**
 * Get hourly parking statistics for the same day
 * Returns: check-in and check-out counts for each hour
 */

const getHourlyParkingStats = async (req, res) => {
    try {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        const tzOffset = -now.getTimezoneOffset() * 60 * 1000;

        const checkInsByHour = await ParkingRecord.aggregate([
            {
                $match: {
                    check_in: { $gte: startOfDay, $lte: endOfDay }
                }
            },
            {
                $group: {
                    _id: { $hour: { $add: ['$check_in', tzOffset] } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const checkOutsByHour = await ParkingRecord.aggregate([
            {
                $match: {
                    check_out: { $gte: startOfDay, $lte: endOfDay }
                }
            },
            {
                $group: {
                    _id: { $hour: { $add: ['$check_out', tzOffset] } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Format into hourly array (0-23)
        const hourlyStats = [];
        for (let hour = 0; hour < 24; hour++) {
            const checkIn = checkInsByHour.find(item => item._id === hour);
            const checkOut = checkOutsByHour.find(item => item._id === hour);
            
            const checkInCount = checkIn ? checkIn.count : 0;
            const checkOutCount = checkOut ? checkOut.count : 0;
            
            // For hours 0-8: only include if either check_in or check_out is not 0
            // For hours 9-23: always include (even if both are 0)
            if (hour < 9) {
                if (checkInCount !== 0 || checkOutCount !== 0) {
                    hourlyStats.push({
                        hour: hour,
                        check_in: checkInCount,
                        check_out: checkOutCount
                    });
                }
            } else {
                hourlyStats.push({
                    hour: hour,
                    check_in: checkInCount,
                    check_out: checkOutCount
                });
            }
        }

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Hourly parking statistics retrieved successfully',
            data: {
                date: now.toISOString().split('T')[0],
                hourly: hourlyStats,
                total_check_in: checkInsByHour.reduce((sum, item) => sum + item.count, 0),
                total_check_out: checkOutsByHour.reduce((sum, item) => sum + item.count, 0)
            }
        });
    } catch (error) {
        console.error("Error in getHourlyParkingStats:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while fetching hourly parking statistics",
            error: error.message
        });
    }
};

/**
 * Get hourly service delivery statistics for the same day
 * Returns: checked in visitors per hour
 */
const getHourlyServiceDeliveryStats = async (req, res) => {
    try {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        const tzOffset = -now.getTimezoneOffset() * 60 * 1000;

        const checkInsByHour = await ServiceDelivery.aggregate([
            {
                $match: {
                    entry_date: { $gte: startOfDay, $lte: endOfDay }
                }
            },
            {
                $group: {
                    _id: { $hour: { $add: ['$entry_date', tzOffset] } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Format into hourly array (0-23)
        const hourlyStats = [];
        for (let hour = 0; hour < 24; hour++) {
            const checkIn = checkInsByHour.find(item => item._id === hour);
            const visitorsCheckedIn = checkIn ? checkIn.count : 0;
            
            // For hours 0-8: only include if visitors_checked_in is not 0
            // For hours 9-23: always include (even if it's 0)
            if (hour < 9) {
                if (visitorsCheckedIn !== 0) {
                    hourlyStats.push({
                        hour: hour,
                        visitors_checked_in: visitorsCheckedIn
                    });
                }
            } else {
                hourlyStats.push({
                    hour: hour,
                    visitors_checked_in: visitorsCheckedIn
                });
            }
        }

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Hourly service delivery statistics retrieved successfully',
            data: {
                date: now.toISOString().split('T')[0],
                hourly: hourlyStats,
                total_visitors: checkInsByHour.reduce((sum, item) => sum + item.count, 0)
            }
        });
    } catch (error) {
        console.error("Error in getHourlyServiceDeliveryStats:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while fetching hourly service delivery statistics",
            error: error.message
        });
    }
};

/**
 * Get employee performance based on tasks completed
 * Returns: employee name, total tasks completed, average service time, rating
 */
const getEmployeePerformanceByTasks = async (req, res) => {
    try {
        // Get all service delivery records to calculate employee performance
        const serviceRecords = await ServiceDelivery.find({ is_still_inhouse: false }); // Only completed tasks
        
        // Group by provider (employee)
        const employeePerformance = {};
        
        serviceRecords.forEach(record => {
            record.departments_assigned.forEach(dept => {
                const providerName = dept.provider_name || 'Unknown';
                const providerId = dept.provider_id || 'unknown';
                
                if (!employeePerformance[providerId]) {
                    employeePerformance[providerId] = {
                        employee_name: providerName,
                        total_tasks: 0,
                        total_service_time: 0,
                        ratings: []
                    };
                }
                
                employeePerformance[providerId].total_tasks += 1;
                
                // Calculate service time from durations
                record.durations.services_durations.forEach(duration => {
                    if (duration.department_id === dept.department_id && duration.provider_id === dept.provider_id) {
                        // Parse duration string (e.g., "30 mins", "2 hours")
                        let minutes = 0;
                        if (typeof duration.duration === 'string') {
                            const lower = duration.duration.toLowerCase();
                            if (lower.includes('hour')) {
                                const num = parseFloat(lower.replace('hours', '').replace('hour', '').trim());
                                minutes = num * 60;
                            } else if (lower.includes('min')) {
                                const num = parseFloat(lower.replace('mins', '').replace('min', '').trim());
                                minutes = num;
                            }
                        }
                        employeePerformance[providerId].total_service_time += minutes;
                        
                        // Add rating based on service time (excellent < 15min, good 15-30min, slow > 30min)
                        if (minutes < 15) {
                            employeePerformance[providerId].ratings.push('Excellent');
                        } else if (minutes <= 30) {
                            employeePerformance[providerId].ratings.push('Good');
                        } else {
                            employeePerformance[providerId].ratings.push('Slow');
                        }
                    }
                });
            });
        });
        
        // Format results
        const formattedPerformance = Object.values(employeePerformance).map(emp => {
            const avgServiceTime = emp.total_tasks > 0 ? Math.round(emp.total_service_time / emp.total_tasks) : 0;
            
            // Determine overall rating based on average
            let rating = 'Slow';
            if (emp.ratings.length > 0) {
                const excellentCount = emp.ratings.filter(r => r === 'Excellent').length;
                const goodCount = emp.ratings.filter(r => r === 'Good').length;
                const slowCount = emp.ratings.filter(r => r === 'Slow').length;
                
                if (excellentCount >= goodCount && excellentCount >= slowCount) {
                    rating = 'Excellent';
                } else if (goodCount >= excellentCount && goodCount >= slowCount) {
                    rating = 'Good';
                } else {
                    rating = 'Slow';
                }
            }
            
            return {
                employee_name: emp.employee_name,
                total_tasks: emp.total_tasks,
                avg_service_time: `${avgServiceTime} mins`,
                rating: rating
            };
        });
        
        // Sort by total tasks descending
        formattedPerformance.sort((a, b) => b.total_tasks - a.total_tasks);
        
        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Employee performance by tasks retrieved successfully',
            data: formattedPerformance
        });
    } catch (error) {
        console.error("Error in getEmployeePerformanceByTasks:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while fetching employee performance by tasks",
            error: error.message
        });
    }
};

/**
 * Get waiting time analytics for each department
 * Returns: waiting time data categorized by Critical/Moderate/Normal
 */
const getWaitingTimeAnalytics = async (req, res) => {
    try {
        // Get all service delivery records
        const serviceRecords = await ServiceDelivery.find({});
        
        // Group by department
        const departmentWaitingTimes = {};
        
        serviceRecords.forEach(record => {
            record.departments_assigned.forEach(dept => {
                const deptId = dept.department_id || 'unknown';
                const deptName = dept.department_name || 'Unknown';
                
                if (!departmentWaitingTimes[deptId]) {
                    departmentWaitingTimes[deptId] = {
                        department_name: deptName,
                        waiting_times: [],
                        assigned_times: []
                    };
                }
                
                // Calculate waiting time from assigned_time to reached_in
                if (dept.assigned_time) {
                    const assignedTime = new Date(dept.assigned_time);
                    let reachedTime = null;
                    
                    // If reached_in is true, use entry_date or current time
                    if (dept.reached_in) {
                        reachedTime = new Date(record.entry_date);
                    } else {
                        // Still waiting, use current time
                        reachedTime = new Date();
                    }
                    
                    const waitTimeMs = reachedTime - assignedTime;
                    const waitTimeMinutes = Math.round(waitTimeMs / (1000 * 60));
                    
                    departmentWaitingTimes[deptId].waiting_times.push(waitTimeMinutes);
                    departmentWaitingTimes[deptId].assigned_times.push(assignedTime);
                }
            });
            
            // Also calculate from durations services_durations
            record.durations.services_durations.forEach(duration => {
                const deptId = duration.department_id || 'unknown';
                const deptName = duration.department_name || 'Unknown';
                
                if (!departmentWaitingTimes[deptId]) {
                    departmentWaitingTimes[deptId] = {
                        department_name: deptName,
                        waiting_times: [],
                        assigned_times: []
                    };
                }
                
                // Parse duration from services_durations
                if (duration.started_at && duration.ended_at) {
                    const startedAt = new Date(duration.started_at);
                    const endedAt = new Date(duration.ended_at);
                    const waitTimeMs = endedAt - startedAt;
                    const waitTimeMinutes = Math.round(waitTimeMs / (1000 * 60));
                    
                    departmentWaitingTimes[deptId].waiting_times.push(waitTimeMinutes);
                    departmentWaitingTimes[deptId].assigned_times.push(startedAt);
                }
            });
        });
        
        // Format results with status categorization
        const formattedAnalytics = Object.values(departmentWaitingTimes).map(dept => {
            const waitingTimes = dept.waiting_times.filter(t => t > 0); // Filter out zero or negative times
            
            if (waitingTimes.length === 0) {
                return {
                    department_name: dept.department_name,
                    avg_wait_time: 0,
                    max_wait_time: 0,
                    min_wait_time: 0,
                    status: 'Normal',
                    total_cases: 0
                };
            }
            
            const avgWaitTime = Math.round(waitingTimes.reduce((sum, t) => sum + t, 0) / waitingTimes.length);
            const maxWaitTime = Math.max(...waitingTimes);
            const minWaitTime = Math.min(...waitingTimes);
            
            // Categorize status based on average wait time
            let status = 'Normal';
            if (avgWaitTime > 60) { // More than 1 hour
                status = 'Critical';
            } else if (avgWaitTime > 30) { // More than 30 minutes
                status = 'Moderate';
            } else {
                status = 'Normal';
            }
            
            return {
                department_name: dept.department_name,
                avg_wait_time: `${avgWaitTime} mins`,
                max_wait_time: `${maxWaitTime} mins`,
                min_wait_time: `${minWaitTime} mins`,
                status: status,
                total_cases: waitingTimes.length
            };
        });
        
        // Sort by average wait time descending
        formattedAnalytics.sort((a, b) => 
            parseFloat(b.avg_wait_time) - parseFloat(a.avg_wait_time)
        );
        
        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Waiting time analytics retrieved successfully',
            data: formattedAnalytics
        });
    } catch (error) {
        console.error("Error in getWaitingTimeAnalytics:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while fetching waiting time analytics",
            error: error.message
        });
    }
};

/**
 * Get employee performance based on service
 * Returns: employee name, citizens served, avg service time, rating based on department response time
 */
const getEmployeePerformanceByService = async (req, res) => {
    try {
        // Get all departments to get their response times
        const departments = await Department.find({});
        const deptResponseTimes = {};
        
        departments.forEach(dept => {
            let responseTime = dept.department_response_time_in_minutes || 10; // Default 10 mins if 0
            if (responseTime === 0) {
                responseTime = 10; // Default to 10 minutes above as requested
            }
            deptResponseTimes[dept.department_id] = {
                department_name: dept.department_name,
                response_time: responseTime
            };
        });
        
        // Get all service delivery records
        const serviceRecords = await ServiceDelivery.find({ is_still_inhouse: false }); // Only completed tasks
        
        // Group by provider (employee)
        const employeePerformance = {};
        
        serviceRecords.forEach(record => {
            record.departments_assigned.forEach(dept => {
                const providerName = dept.provider_name || 'Unknown';
                const providerId = dept.provider_id || 'unknown';
                const deptId = dept.department_id;
                
                if (!employeePerformance[providerId]) {
                    employeePerformance[providerId] = {
                        employee_name: providerName,
                        citizens_served: 0,
                        total_service_time: 0,
                        department_ratings: []
                    };
                }
                
                employeePerformance[providerId].citizens_served += 1;
                
                // Get department response time for rating
                const deptInfo = deptResponseTimes[deptId] || { response_time: 10 };
                const expectedTime = deptInfo.response_time;
                
                // Calculate actual service time from durations
                record.durations.services_durations.forEach(duration => {
                    if (duration.department_id === dept.department_id && duration.provider_id === dept.provider_id) {
                        // Parse duration string
                        let minutes = 0;
                        if (typeof duration.duration === 'string') {
                            const lower = duration.duration.toLowerCase();
                            if (lower.includes('hour')) {
                                const num = parseFloat(lower.replace('hours', '').replace('hour', '').trim());
                                minutes = num * 60;
                            } else if (lower.includes('min')) {
                                const num = parseFloat(lower.replace('mins', '').replace('min', '').trim());
                                minutes = num;
                            }
                        }
                        employeePerformance[providerId].total_service_time += minutes;
                        
                        // Rate based on comparison with expected time
                        const timeRatio = minutes / expectedTime;
                        if (timeRatio <= 0.8) { // 20% faster than expected
                            employeePerformance[providerId].department_ratings.push('Excellent');
                        } else if (timeRatio <= 1.2) { // Within 20% of expected
                            employeePerformance[providerId].department_ratings.push('Good');
                        } else { // More than 20% slower than expected
                            employeePerformance[providerId].department_ratings.push('Slow');
                        }
                    }
                });
            });
        });
        
        // Format results
        const formattedPerformance = Object.values(employeePerformance).map(emp => {
            const avgServiceTime = emp.citizens_served > 0 ? 
                Math.round(emp.total_service_time / emp.citizens_served) : 0;
            
            // Determine overall rating based on department ratings
            let rating = 'Slow';
            if (emp.department_ratings.length > 0) {
                const excellentCount = emp.department_ratings.filter(r => r === 'Excellent').length;
                const goodCount = emp.department_ratings.filter(r => r === 'Good').length;
                const slowCount = emp.department_ratings.filter(r => r === 'Slow').length;
                
                if (excellentCount >= goodCount && excellentCount >= slowCount) {
                    rating = 'Excellent';
                } else if (goodCount >= excellentCount && goodCount >= slowCount) {
                    rating = 'Good';
                } else {
                    rating = 'Slow';
                }
            }
            
            return {
                employee_name: emp.employee_name,
                citizens_served: emp.citizens_served,
                avg_service_time: `${avgServiceTime} mins`,
                rating: rating
            };
        });
        
        // Sort by citizens served descending
        formattedPerformance.sort((a, b) => b.citizens_served - a.citizens_served);
        
        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Employee performance by service retrieved successfully',
            data: formattedPerformance
        });
    } catch (error) {
        console.error("Error in getEmployeePerformanceByService:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while fetching employee performance by service",
            error: error.message
        });
    }
};

/**
 * Get employee performance based on completed tasks
 * Uses the Task model to calculate performance metrics based on startDate, dueDate, and completion time
 * Returns: employee name, total tasks completed, expected completion time, actual completion time, rating
 */
const getEmployeePerformanceByTasksDone = async (req, res) => {
    try {
        // Get all completed tasks
        const completedTasks = await Task.find({ status: 'Completed' });

       // console.log(completedTasks)
        
        // Group by incharge (employee responsible for the task)
        const employeePerformance = {};
        
        completedTasks.forEach(task => {
            // Get the employee name from incharge (we'll need to populate this)
            const inchargeId = task.incharge;
            
            if (!employeePerformance[inchargeId]) {
                employeePerformance[inchargeId] = {
                    employee_name: 'Unknown', // Will be populated after we fetch user details
                    total_tasks: 0,
                    total_expected_time: 0,
                    total_actual_time: 0,
                    tasks_with_expected: 0,
                    tasks_with_actual: 0
                };
            }
            
            employeePerformance[inchargeId].total_tasks += 1;
            
            // Calculate expected completion time (dueDate - startDate)
            if ((task.dueDate || task.completedAt || task.updatedAt) && (task.startDate || task.createdAt)) {
                const expectedTimeMs = (task.dueDate?.getTime() || task.completedAt?.getTime() || task.updatedAt?.getTime()) - (task.startDate?.getTime() || task.createdAt?.getTime());
                const expectedTimeHours = (expectedTimeMs / (1000 * 60 * 60)).toFixed(2); // Convert to hours
                
                if (expectedTimeHours >= 0) { // Only count positive time differences
                    employeePerformance[inchargeId].total_expected_time += parseFloat(expectedTimeHours);
                    employeePerformance[inchargeId].tasks_with_expected += 1;
                }
            }
            
            // Calculate actual completion time (completedAt/updatedAt - startDate)
            const completionDate = task.completedAt || task.updatedAt;
            if (completionDate && (task.startDate || task.createdAt)) {
                console.log(completionDate, (task.startDate || task.createdAt))
                const actualTimeMs = completionDate?.getTime() - (task.startDate?.getTime() || task.createdAt?.getTime());
                const actualTimeHours = (actualTimeMs / (1000 * 60 * 60)).toFixed(2); // Convert to hours
                
                if (actualTimeHours >= 0) { // Only count positive time differences
                    employeePerformance[inchargeId].total_actual_time += parseFloat(actualTimeHours);
                    employeePerformance[inchargeId].tasks_with_actual += 1;
                }
            }
        });
        
        // Now populate employee names by fetching user details
        const employeeIds = Object.keys(employeePerformance).filter(id => id !== undefined && id !== null);
        if (employeeIds.length > 0) {
            const users = await User.find({ '_id': { $in: employeeIds } });
            
            users.forEach(user => {
                const userId = user._id.toString();
                if (employeePerformance[userId]) {
                    employeePerformance[userId].employee_name = user.full_name || 'Unknown';
                }
            });
        }
        
        // Format results
        const formattedPerformance = Object.values(employeePerformance).map(emp => {
            // Skip entries without valid employee names
            if (!emp.employee_name || emp.employee_name === 'Unknown') {
                return null;
            }
            
            const avgExpectedTime = emp.tasks_with_expected > 0 ? 
                (emp.total_expected_time / emp.tasks_with_expected) : 0;
            
            const avgActualTime = emp.tasks_with_actual > 0 ? 
                (emp.total_actual_time / emp.tasks_with_actual) : 0;
            
            // Determine rating based on comparison of actual vs expected time
            // Excellent: actual <= expected * 0.8 (20% faster than expected)
            // Good: actual <= expected * 1.2 (within 20% of expected)
            // Slow: actual > expected * 1.2 (more than 20% slower than expected)
            let rating = 'Slow';
            if (emp.tasks_with_expected > 0 && emp.tasks_with_actual > 0) {
                const timeRatio = emp.total_actual_time / emp.total_expected_time;
                if (timeRatio <= 0.8) { // 20% faster than expected
                    rating = 'Excellent';
                } else if (timeRatio <= 1.2) { // Within 20% of expected
                    rating = 'Good';
                }
            } else if (emp.tasks_with_actual > 0) {
                // If we have actual time but no expected time, just check if tasks are completing
                rating = emp.total_actual_time > 0 ? 'Good' : 'Slow';
            }
            
            return {
                employee_name: emp.employee_name,
                total_tasks: emp.total_tasks,
                avg_expected_time: `${avgExpectedTime.toFixed(2)} hours`,
                avg_actual_time: `${avgActualTime.toFixed(2)} hours`,
                rating: rating
            };
        }).filter(Boolean); // Remove null entries
        
        // Sort by total tasks descending
        formattedPerformance.sort((a, b) => b.total_tasks - a.total_tasks);
        
        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Employee performance by completed tasks retrieved successfully',
            data: formattedPerformance
        });
    } catch (error) {
        console.error("Error in getEmployeePerformanceByTasksDone:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while fetching employee performance by completed tasks",
            error: error.message
        });
    }
};

/**
 * Get served statistics for the mayor overview, aggregated server-side.
 * Query params: from, to (ISO dates, both optional; omitted = all records).
 * A service record's effective date is its started_at, falling back to the
 * visitor's entry_date — the same rule the dashboard previously applied client-side.
 * Returns: total_visitors, hourly check-ins, last check-in, served counts by
 * department (with the busiest employee) and by employee (with visitor names).
 */
const getServedStatistics = async (req, res) => {
    try {
        const { from, to } = req.query;
        const fromDate = from ? new Date(from) : null;
        let toDate = to ? new Date(to) : null;
        if (toDate && !isNaN(toDate.getTime()) && to.length <= 10) {
            // Date-only "to" means the whole day inclusive
            toDate.setHours(23, 59, 59, 999);
        }
        const inRange = (d) => {
            if (!d) return false;
            const t = new Date(d);
            if (isNaN(t.getTime())) return false;
            if (fromDate && t < fromDate) return false;
            if (toDate && t > toDate) return false;
            return true;
        };
        const noFilter = !fromDate && !toDate;

        // Only pull docs that can contribute a record in the range
        const dateQuery = noFilter ? {} : {
            $or: [
                { entry_date: { ...(fromDate && { $gte: fromDate }), ...(toDate && { $lte: toDate }) } },
                { 'durations.services_durations.started_at': { ...(fromDate && { $gte: fromDate }), ...(toDate && { $lte: toDate }) } },
            ],
        };

        const [visitorsDocs, users] = await Promise.all([
            ServiceDelivery.find(dateQuery)
                .select('full_name entry_date durations.services_durations services_status departments_assigned')
                .lean(),
            User.find({}).select('full_name department department_name').populate('department', 'department_name').lean(),
        ]);

        let totalVisitors = 0;
        const hourlyCounts = {};
        let lastCheckin = null;

        // department -> served count (visitors who actually received a service)
        const servedByDept = {};
        // department -> assigned count (visitors who were oriented/assigned to the dept)
        const assignedByDept = {};
        const perDeptProvider = {};
        // provider key (id or name) -> { name, dept, count, visitors }
        const providerCounts = {};

        const addRecord = (department, providerId, providerName, visitorName) => {
            servedByDept[department] = (servedByDept[department] || 0) + 1;
            const provider = providerName || 'Unknown provider';
            if (!perDeptProvider[department]) perDeptProvider[department] = {};
            perDeptProvider[department][provider] = (perDeptProvider[department][provider] || 0) + 1;
            const key = providerId || providerName;
            if (!key) return;
            if (!providerCounts[key]) providerCounts[key] = { name: providerName || 'Unknown provider', dept: department, count: 0, visitors: [] };
            providerCounts[key].count += 1;
            providerCounts[key].visitors.push({ visitor: visitorName, department });
        };

        const addAssigned = (department, visitorName) => {
            assignedByDept[department] = (assignedByDept[department] || 0) + 1;
        };

        for (const v of visitorsDocs) {
            const visitorName = v.full_name || 'Unknown visitor';
            const entryInRange = noFilter || inRange(v.entry_date);

            if (entryInRange && v.entry_date) {
                totalVisitors += 1;
                const t = new Date(v.entry_date);
                if (!isNaN(t.getTime())) {
                    hourlyCounts[t.getHours()] = (hourlyCounts[t.getHours()] || 0) + 1;
                    if (!lastCheckin || t > lastCheckin) lastCheckin = t;
                }
            }

            // Count visitors assigned to each department (from departments_assigned)
            const assignments = v.departments_assigned || [];
            for (const a of assignments) {
                if (!a?.department_name) continue;
                const effectiveDate = a.assigned_time || v.entry_date;
                if (!noFilter && !inRange(effectiveDate)) continue;
                addAssigned(a.department_name, visitorName);
            }

            const durations = v.durations?.services_durations || [];
            for (const s of durations) {
                if (!s?.department_name) continue;
                const effectiveDate = s.started_at || v.entry_date;
                if (!noFilter && !inRange(effectiveDate)) continue;
                addRecord(s.department_name, s.provider_id, s.provider_name, visitorName);
            }
            for (const s of v.services_status || []) {
                if (!s?.department_name || (!s.provider_id && !s.provider_name)) continue;
                const already = durations.some(
                    (d) => d.department_id === s.department_id && (d.provider_id || '') === (s.provider_id || '')
                );
                if (already) continue;
                if (!noFilter && !inRange(v.entry_date)) continue;
                addRecord(s.department_name, s.provider_id, s.provider_name, visitorName);
            }
        }

        // Busiest provider per department
        const topEmpByDept = {};
        for (const [dept, providers] of Object.entries(perDeptProvider)) {
            const [topName, topCount] = Object.entries(providers).sort((a, b) => b[1] - a[1])[0];
            topEmpByDept[dept] = { name: topName, served: topCount };
        }
        const byDepartment = Object.entries(servedByDept)
            .map(([name, served]) => ({ name, served, assigned: assignedByDept[name] || 0, not_served: Math.max(0, (assignedByDept[name] || 0) - served), top_employee: topEmpByDept[name] || null }))
            .sort((a, b) => b.assigned - a.assigned);

        // Every employee gets a row (0 when they served no one), then any provider
        // from the records who has no matching account is appended
        const used = new Set();
        const byEmployee = users.map((u) => {
            const id = String(u._id);
            const name = u.full_name || 'Unknown';
            let served = 0;
            let servedDept;
            const visitors = [];
            if (providerCounts[id]) { served += providerCounts[id].count; servedDept = providerCounts[id].dept; visitors.push(...providerCounts[id].visitors); used.add(id); }
            if (providerCounts[name]) { served += providerCounts[name].count; servedDept = servedDept || providerCounts[name].dept; visitors.push(...providerCounts[name].visitors); used.add(name); }
            const accountDept = u.department?.department_name || u.department?.name || u.department_name;
            return { id, name, department: accountDept || servedDept || null, served, visitors };
        });
        for (const [key, p] of Object.entries(providerCounts)) {
            if (!used.has(key)) byEmployee.push({ id: null, name: p.name, department: p.dept || null, served: p.count, visitors: p.visitors });
        }
        byEmployee.sort((a, b) => b.served - a.served);

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Served statistics retrieved successfully',
            data: {
                total_visitors: totalVisitors,
                hourly: Object.entries(hourlyCounts).map(([hour, count]) => ({ hour: Number(hour), count })).sort((a, b) => a.hour - b.hour),
                last_checkin: lastCheckin ? lastCheckin.toISOString() : null,
                by_department: byDepartment,
                assigned_by_department: Object.entries(assignedByDept)
                    .map(([name, assigned]) => ({ name, assigned }))
                    .sort((a, b) => b.assigned - a.assigned),
                by_employee: byEmployee,
            },
        });
    } catch (error) {
        console.error('Error in getServedStatistics:', error);
        return res.status(500).json({
            success: false,
            type: 'error',
            message: 'Something went wrong while fetching served statistics',
            error: error.message,
        });
    }
};

/**
 * Visitor check-ins bucketed over a period for the mayor's timeline chart.
 * Query: from, to (ISO dates), granularity: 'hour' | 'day' | 'week' | 'month'.
 * Buckets use local server time; keys are '%Y-%m-%dT%H' / '%Y-%m-%d' / '%G-W%V' / '%Y-%m'.
 */
const getVisitorsTimeline = async (req, res) => {
    try {
        const { from, to, granularity = 'day' } = req.query;
        const now = new Date();
        const fromDate = from ? new Date(from) : new Date(now.getFullYear(), 0, 1);
        const toDate = to ? new Date(to) : now;
        if (isNaN(fromDate) || isNaN(toDate)) {
            return res.status(400).json({ success: false, message: 'Invalid from/to date' });
        }
        const tzOffset = -now.getTimezoneOffset() * 60 * 1000;

        const FORMATS = {
            hour: '%Y-%m-%dT%H',
            day: '%Y-%m-%d',
            week: '%G-W%V',
            month: '%Y-%m'
        };
        const format = FORMATS[granularity] || FORMATS.day;

        const rows = await ServiceDelivery.aggregate([
            { $match: { entry_date: { $gte: fromDate, $lte: toDate } } },
            {
                $group: {
                    _id: { $dateToString: { format, date: { $add: ['$entry_date', tzOffset] } } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        return res.status(200).json({
            success: true,
            data: {
                granularity: FORMATS[granularity] ? granularity : 'day',
                from: fromDate,
                to: toDate,
                total: rows.reduce((s, r) => s + r.count, 0),
                buckets: rows.map(r => ({ bucket: r._id, count: r.count }))
            }
        });
    } catch (error) {
        console.error('Error in getVisitorsTimeline:', error);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong while fetching the visitors timeline',
            error: error.message
        });
    }
};

// Period bucketing helpers — same logic as serivice_delivery/assigned_visitors_gender_stats.js
const getActivityPeriodBounds = (period, from, to) => {
    const now = new Date();
    const startOfDay = (d) => { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; };
    const endOfDay = (d) => { const r = new Date(d); r.setHours(23, 59, 59, 999); return r; };

    if (period === 'today') {
        return { start: startOfDay(now), end: endOfDay(now) };
    }
    if (period === 'week') {
        const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        return { start: monday, end: sunday };
    }
    if (period === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }
    if (period === 'last_month') {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }
    if (period === 'year') {
        const start = new Date(now.getFullYear(), 0, 1);
        const end = new Date(now.getFullYear(), 11, 31);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }
    if (period === 'range' && from) {
        const start = startOfDay(from);
        const end = to ? endOfDay(to) : endOfDay(now);
        return { start, end };
    }
    return null;
};

const activityDayName = (date) => date.toLocaleDateString('en-US', { weekday: 'long' });
const activityMonthName = (date) => date.toLocaleDateString('en-US', { month: 'long' });
const activityHourLabel = (hour) => {
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:00 ${suffix}`;
};

const generateActivityTimeSlots = (period, bounds) => {
    const slots = [];
    if (!bounds) return slots;

    if (period === 'today') {
        for (let hour = 8; hour <= 18; hour++) slots.push(activityHourLabel(hour));
    } else if (period === 'week') {
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const current = new Date(bounds.start);
        while (current <= bounds.end) {
            slots.push(days[current.getDay() === 0 ? 6 : current.getDay() - 1]);
            current.setDate(current.getDate() + 1);
        }
    } else if (period === 'month' || period === 'last_month') {
        const current = new Date(bounds.start);
        while (current <= bounds.end) {
            slots.push(activityMonthName(current) + ' ' + current.getDate());
            current.setDate(current.getDate() + 1);
        }
    } else if (period === 'year') {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        for (let m = 0; m < 12; m++) slots.push(months[m]);
    } else if (period === 'range') {
        const diffDays = Math.ceil((bounds.end - bounds.start) / (1000 * 60 * 60 * 24));
        if (diffDays <= 1) {
            for (let hour = 8; hour <= 18; hour++) slots.push(activityHourLabel(hour));
        } else if (diffDays <= 31) {
            const current = new Date(bounds.start);
            while (current <= bounds.end) {
                slots.push(activityMonthName(current) + ' ' + current.getDate());
                current.setDate(current.getDate() + 1);
            }
        } else if (diffDays <= 365) {
            const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            for (let m = 0; m < 12; m++) slots.push(months[m]);
        } else {
            const currentYear = bounds.start.getFullYear();
            const endYear = bounds.end.getFullYear();
            for (let y = currentYear; y <= endYear; y++) slots.push(String(y));
        }
    }
    return slots;
};

const activityLabelForDate = (date, period, bounds) => {
    if (period === 'today') {
        const hour = date.getHours();
        if (hour < 8 || hour > 18) return null;
        return activityHourLabel(hour);
    }
    if (period === 'week') return activityDayName(date);
    if (period === 'month' || period === 'last_month') return activityMonthName(date) + ' ' + date.getDate();
    if (period === 'year') return activityMonthName(date);
    if (period === 'range') {
        const diffDays = bounds ? Math.ceil((bounds.end - bounds.start) / (1000 * 60 * 60 * 24)) : 0;
        if (diffDays <= 1) {
            const hour = date.getHours();
            if (hour < 8 || hour > 18) return null;
            return activityHourLabel(hour);
        }
        if (diffDays <= 31) return activityMonthName(date) + ' ' + date.getDate();
        if (diffDays <= 365) return activityMonthName(date);
        return String(date.getFullYear());
    }
    return date.toLocaleDateString();
};

/**
 * Get parking + service delivery activity bucketed over a period
 * (today = per hour, week = per day name, month = per date, year = per month, range = auto)
 * Parking counts all cars checked in/out; service delivery counts all visitors checked in.
 */
const getActivityTimeline = async (req, res) => {
    try {
        const { period = 'today', from, to } = req.query || {};
        const bounds = getActivityPeriodBounds(period, from, to);

        const dateFilter = bounds ? { $gte: bounds.start, $lte: bounds.end } : undefined;

        const [parkingIn, parkingOut, serviceIn] = await Promise.all([
            ParkingRecord.find(dateFilter ? { check_in: dateFilter } : {}).select('check_in').lean(),
            ParkingRecord.find(dateFilter ? { check_out: dateFilter } : { check_out: { $ne: null } }).select('check_out').lean(),
            ServiceDelivery.find(dateFilter ? { entry_date: dateFilter } : {}).select('entry_date').lean(),
        ]);

        const stats = {};
        const bump = (rawDate, key) => {
            const d = rawDate ? new Date(rawDate) : null;
            if (!d || isNaN(d.getTime())) return;
            const label = activityLabelForDate(d, period, bounds);
            if (!label) return;
            if (!stats[label]) stats[label] = { parking_check_in: 0, parking_check_out: 0, service_checked_in: 0 };
            stats[label][key] += 1;
        };

        parkingIn.forEach((r) => bump(r.check_in, 'parking_check_in'));
        parkingOut.forEach((r) => bump(r.check_out, 'parking_check_out'));
        serviceIn.forEach((r) => bump(r.entry_date, 'service_checked_in'));

        const timeSlots = generateActivityTimeSlots(period, bounds);
        const data = timeSlots.map((label) => ({
            label,
            parking_check_in: stats[label] ? stats[label].parking_check_in : 0,
            parking_check_out: stats[label] ? stats[label].parking_check_out : 0,
            service_checked_in: stats[label] ? stats[label].service_checked_in : 0,
        }));

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Activity timeline retrieved successfully',
            data,
            period,
            bounds: bounds ? { start: bounds.start.toISOString(), end: bounds.end.toISOString() } : null,
            totals: {
                parking_check_in: data.reduce((s, d) => s + d.parking_check_in, 0),
                parking_check_out: data.reduce((s, d) => s + d.parking_check_out, 0),
                service_checked_in: data.reduce((s, d) => s + d.service_checked_in, 0),
            },
        });
    } catch (error) {
        console.error('Error in getActivityTimeline:', error);
        return res.status(500).json({
            success: false,
            type: 'error',
            message: 'Something went wrong while fetching the activity timeline',
            error: error.message,
        });
    }
};

// Generate slot windows (label + start/end bounds) matching the activity timeline bucketing
const generateOccupancySlotWindows = (period, bounds) => {
    const windows = [];
    if (!bounds) return windows;
    const pushDay = (day) => {
        const start = new Date(day); start.setHours(0, 0, 0, 0);
        const end = new Date(day); end.setHours(23, 59, 59, 999);
        windows.push({ label: activityMonthName(day) + ' ' + day.getDate(), start, end });
    };
    const diffDays = Math.ceil((bounds.end - bounds.start) / (1000 * 60 * 60 * 24));
    const useHours = period === 'today' || (period === 'range' && diffDays <= 1);
    const useMonths = period === 'year' || (period === 'range' && diffDays > 31 && diffDays <= 365);
    const useYears = period === 'range' && diffDays > 365;

    if (useHours) {
        const base = new Date(bounds.start);
        for (let hour = 8; hour <= 18; hour++) {
            const start = new Date(base); start.setHours(hour, 0, 0, 0);
            const end = new Date(base); end.setHours(hour, 59, 59, 999);
            windows.push({ label: activityHourLabel(hour), start, end });
        }
    } else if (useMonths) {
        const year = bounds.start.getFullYear();
        for (let m = 0; m < 12; m++) {
            const start = new Date(year, m, 1, 0, 0, 0, 0);
            const end = new Date(year, m + 1, 0, 23, 59, 59, 999);
            windows.push({ label: activityMonthName(start), start, end });
        }
    } else if (useYears) {
        for (let y = bounds.start.getFullYear(); y <= bounds.end.getFullYear(); y++) {
            windows.push({ label: String(y), start: new Date(y, 0, 1), end: new Date(y, 11, 31, 23, 59, 59, 999) });
        }
    } else if (period === 'week') {
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const current = new Date(bounds.start);
        while (current <= bounds.end) {
            const start = new Date(current); start.setHours(0, 0, 0, 0);
            const end = new Date(current); end.setHours(23, 59, 59, 999);
            windows.push({ label: days[current.getDay() === 0 ? 6 : current.getDay() - 1], start, end });
            current.setDate(current.getDate() + 1);
        }
    } else {
        const current = new Date(bounds.start);
        while (current <= bounds.end) {
            pushDay(new Date(current));
            current.setDate(current.getDate() + 1);
        }
    }
    return windows;
};

/**
 * Parking occupancy over a period: percentage of slots occupied per time bucket.
 * For 'today' also returns the live snapshot so the client can render the donut unchanged.
 * All numbers are computed here; the client only renders labels and values.
 */
const getOccupancyTimeline = async (req, res) => {
    try {
        const { period = 'month', from, to } = req.query || {};
        const bounds = getActivityPeriodBounds(period, from, to);

        const slotConfig = await ParkingSlot.findOne({ UnChangedId: 'parking_slots' }).lean();
        const totalSlots = Number(slotConfig?.totalSlots) || 0;

        const records = bounds ? await ParkingRecord.find({
            check_in: { $lte: bounds.end },
            $or: [{ check_out: null }, { check_out: { $gte: bounds.start } }],
        }).select('check_in check_out').lean() : [];

        const windows = generateOccupancySlotWindows(period, bounds);
        const HOUR_MS = 60 * 60 * 1000;
        const nowMs = Date.now();

        // Peak hourly occupancy per bucket: within each bucket, count the cars present
        // during each hour and keep the hour with the most cars. A car still parked
        // (no check_out) counts as present up to now.
        const data = windows.map((w) => {
            const winStart = w.start.getTime();
            const winEnd = Math.min(w.end.getTime(), nowMs);
            if (winEnd < winStart) return { label: w.label, occupied: 0, percentage: 0 };

            const hourCount = Math.max(1, Math.ceil((winEnd - winStart + 1) / HOUR_MS));
            const diff = new Array(hourCount + 1).fill(0);
            let hasAny = false;

            for (const r of records) {
                const checkIn = r.check_in ? new Date(r.check_in).getTime() : NaN;
                if (isNaN(checkIn) || checkIn > winEnd) continue;
                let checkOut = r.check_out ? new Date(r.check_out).getTime() : nowMs;
                if (isNaN(checkOut)) checkOut = nowMs;
                if (checkOut < winStart) continue;

                const startIdx = Math.max(0, Math.floor((Math.max(checkIn, winStart) - winStart) / HOUR_MS));
                const endIdx = Math.min(hourCount - 1, Math.floor((Math.min(checkOut, winEnd) - winStart) / HOUR_MS));
                if (endIdx < startIdx) continue;
                diff[startIdx] += 1;
                diff[endIdx + 1] -= 1;
                hasAny = true;
            }

            let peak = 0;
            if (hasAny) {
                let running = 0;
                for (let i = 0; i < hourCount; i++) {
                    running += diff[i];
                    if (running > peak) peak = running;
                }
            }

            const percentage = totalSlots > 0 ? Math.min(100, Math.round((peak / totalSlots) * 1000) / 10) : 0;
            return { label: w.label, occupied: peak, percentage };
        });

        const currentlyOccupied = await ParkingRecord.countDocuments({ status: 'active' });
        const currentPercentage = totalSlots > 0 ? Math.min(100, Math.round((currentlyOccupied / totalSlots) * 1000) / 10) : 0;

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Occupancy timeline retrieved successfully',
            data,
            period,
            totalSlots,
            current: { occupied: currentlyOccupied, totalSlots, percentage: currentPercentage },
            bounds: bounds ? { start: bounds.start.toISOString(), end: bounds.end.toISOString() } : null,
        });
    } catch (error) {
        console.error('Error in getOccupancyTimeline:', error);
        return res.status(500).json({
            success: false,
            type: 'error',
            message: 'Something went wrong while fetching the occupancy timeline',
            error: error.message,
        });
    }
};

module.exports = {
    getRolesWithPermissions,
    getDepartmentsWithLeaders,
    getEmployeeStats,
    getEmergencyCarsStats,
    getFlaggedVehiclesStats,
    getCurrentlyParkedStats,
    getServiceDeliveryStats,
    getFeedbackTotals,
    getFeedbackAverageByDepartment,
    getFeedbackSentiment,
    getHourlyParkingStats,
    getHourlyServiceDeliveryStats,
    getEmployeePerformanceByTasks,
    getWaitingTimeAnalytics,
    getEmployeePerformanceByService,
    getEmployeePerformanceByTasksDone,
    getServedStatistics,
    getVisitorsTimeline,
    getActivityTimeline,
    getOccupancyTimeline
};
