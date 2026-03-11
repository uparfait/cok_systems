
const User = require('../../models/user.js');
const Department = require('../../models/department.js');
const Role = require('../../models/default_roles.js');
const EmergencyCar = require('../../models/emergency_car.js');
const EmergencyCarHistory = require('../../models/emergency_car_history.js');
const FlaggedVehicle = require('../../models/flagged_vehicle.js');
const ParkingRecord = require('../../models/parking_record.js');
const ServiceDelivery = require('../../models/service_delivery.js');
const Feedback = require('../../models/feedback_db.js');

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
        const expiredEmergencyCars = await EmergencyCarHistory.countDocuments({});

        // Total across both
        const totalEmergencyCars = activeEmergencyCars + expiredEmergencyCars;

        // Get additional details - count of unique plates in active
        const activePlates = await EmergencyCar.aggregate([
            { $match: { 'validity.to': { $gte: now } } },
            { $unwind: '$visitor_info' },
            { $count: 'total_vehicles' }
        ]);

        // Get additional details - count of unique plates in history
        const historyPlates = await EmergencyCarHistory.aggregate([
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
        const currentlyFlagged = await FlaggedVehicle.find({
            check_out_time: { $exists: false }
        });

        // Historical flagged vehicles (have check_out_time)
        const historyFlagged = await FlaggedVehicle.find({
            check_out_time: { $exists: true }
        });

        // Calculate min and max minutes for currently flagged
        let minMinutesCurrent = 0;
        let maxMinutesCurrent = 0;
        if (currentlyFlagged.length > 0) {
            const currentMinutes = currentlyFlagged.map(v => v.flagged_duration_minutes || 0);
            minMinutesCurrent = Math.min(...currentMinutes);
            maxMinutesCurrent = Math.max(...currentMinutes);
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

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Service delivery statistics retrieved successfully',
            data: {
                total: total,
                inhouse: totalInhouse,
                completed: totalCompleted,
                by_status: statusCounts,
                by_department: departmentCounts
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
        // Total feedback
        const totalFeedback = await Feedback.countDocuments({});

        // Breakdown by department
        const feedbackByDepartment = await Feedback.aggregate([
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
        // Calculate average by department
        const averageByDepartment = await Feedback.aggregate([
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
 * Get hourly parking statistics for the same day
 * Returns: check-in and check-out counts for each hour
 */
const getHourlyParkingStats = async (req, res) => {
    try {
        // Get start and end of today
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        // Get check-ins by hour for today
        const checkInsByHour = await ParkingRecord.aggregate([
            {
                $match: {
                    check_in: { $gte: startOfDay, $lte: endOfDay }
                }
            },
            {
                $group: {
                    _id: { $hour: '$check_in' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Get check-outs by hour for today
        const checkOutsByHour = await ParkingRecord.aggregate([
            {
                $match: {
                    check_out: { $gte: startOfDay, $lte: endOfDay }
                }
            },
            {
                $group: {
                    _id: { $hour: '$check_out' },
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

            hourlyStats.push({
                hour: hour,
                check_in: checkIn ? checkIn.count : 0,
                check_out: checkOut ? checkOut.count : 0
            });
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
        // Get start and end of today
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        // Get service deliveries checked in today (entry_date is within today)
        const checkInsByHour = await ServiceDelivery.aggregate([
            {
                $match: {
                    entry_date: { $gte: startOfDay, $lte: endOfDay }
                }
            },
            {
                $group: {
                    _id: { $hour: '$entry_date' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Format into hourly array (0-23)
        const hourlyStats = [];
        for (let hour = 0; hour < 24; hour++) {
            const checkIn = checkInsByHour.find(item => item._id === hour);

            hourlyStats.push({
                hour: hour,
                visitors_checked_in: checkIn ? checkIn.count : 0
            });
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
    getHourlyParkingStats,
    getHourlyServiceDeliveryStats
};
