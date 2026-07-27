
const User = require('../../models/user.js');
const Department = require('../../models/department.js');
const Role = require('../../models/default_roles.js');
const EmergencyCar = require('../../models/emergency_car.js');
const EmergencyCarHistory = require('../../models/emergency_car_history.js');
const FlaggedVehicle = require('../../models/flagged_vehicle.js');
const ParkingRecord = require('../../models/parking_record.js');
const ServiceDelivery = require('../../models/service_delivery.js');
const Feedback = require('../../models/feedback_db.js');
const Task = require('../../models/task.js');

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
    getHourlyServiceDeliveryStats,
    getEmployeePerformanceByTasks,
    getWaitingTimeAnalytics,
    getEmployeePerformanceByService,
    getEmployeePerformanceByTasksDone
};
