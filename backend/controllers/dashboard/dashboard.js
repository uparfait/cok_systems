/**
 * Dashboard Controller
 * Handles analytics and dashboard data aggregation
 */

const ServiceDelivery = require('../../models/service_delivery.js');
const ServiceTracking = require('../../models/service_tracking.js');
const Feedback = require('../../models/feedback_db.js');
const User = require('../../models/user.js');
const Department = require('../../models/department.js');
const Task = require('../../models/task.js');

/**
 * Get comprehensive dashboard analytics
 */
const getDashboardAnalytics = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Default to today if no dates provided
        const now = new Date();
        const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

        // Service Metrics
        const serviceMetrics = await calculateServiceMetrics(start, end);

        // Live Service Centers
        const liveCenters = await calculateLiveCenters(start, end);

        // Employee Performance
        const employeePerformance = await calculateEmployeePerformance(start, end);

        // Office Rankings
        const officeRankings = await calculateOfficeRankings();

        // Analytics Data
        const waitingAnalytics = await calculateWaitingAnalytics();
        const serviceDuration = await calculateServiceDuration(start, end);

        // SLA Monitoring
        const slaMonitoring = await calculateSLAMonitoring(serviceMetrics, serviceDuration);

        // Citizen Feedback
        const citizenFeedback = await calculateCitizenFeedback(start, end);

        // Service Flow
        const serviceFlow = calculateServiceFlow(serviceMetrics);

        // Task SLA
        const taskSLA = await calculateTaskSLA(start, end);

        // AI Insights
        const insights = generateInsights(liveCenters, serviceDuration, slaMonitoring);

        // Real-time Alerts
        const alerts = generateAlerts(liveCenters, slaMonitoring);

        // System Status
        const systemStatus = await calculateSystemStatus();

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Dashboard analytics retrieved successfully',
            data: {
                serviceMetrics,
                liveCenters,
                alerts,
                employeePerformance,
                officeRankings,
                waitingAnalytics,
                serviceDuration,
                slaMonitoring,
                citizenFeedback,
                serviceFlow,
                taskSLA,
                insights,
                systemStatus
            }
        });

    } catch (error) {
        console.error('Dashboard analytics error:', error);
        return res.status(500).json({
            success: false,
            type: 'error',
            message: 'Failed to fetch dashboard analytics',
            error: error.message
        });
    }
};

/**
 * Calculate service metrics
 */
const calculateServiceMetrics = async (start, end) => {
    // Citizens Served - count completed services
    const citizensServed = await ServiceDelivery.countDocuments({
        'services_status.s_type': 'Completed'
    });

    // Average Wait Time
    const waitTimeResult = await ServiceTracking.aggregate([
        {
            $match: {
                started_at: { $gte: start, $lte: end }
            }
        },
        {
            $lookup: {
                from: 'servicedeliveries',
                localField: 'provider_id',
                foreignField: 'services_status.provider_id',
                as: 'service'
            }
        },
        {
            $unwind: { path: '$service', preserveNullAndEmptyArrays: true }
        },
        {
            $unwind: { path: '$service.services_status', preserveNullAndEmptyArrays: true }
        },
        {
            $match: {
                'service.services_status.provider_id': { $exists: true }
            }
        },
        {
            $project: {
                waitTime: {
                    $divide: [
                        { $subtract: ['$started_at', '$service.services_status.assigned_time'] },
                        60000 // Convert to minutes
                    ]
                }
            }
        },
        {
            $group: {
                _id: null,
                avgWaitTime: { $avg: '$waitTime' }
            }
        }
    ]);

    const avgWaitTime = waitTimeResult[0]?.avgWaitTime ?
        Math.round(waitTimeResult[0].avgWaitTime) : 0;

    // Average Service Time
    const serviceTimeResult = await ServiceTracking.aggregate([
        {
            $match: {
                started_at: { $gte: start, $lte: end },
                ended_at: { $exists: true }
            }
        },
        {
            $project: {
                serviceTime: {
                    $divide: [
                        { $subtract: ['$ended_at', '$started_at'] },
                        60000
                    ]
                }
            }
        },
        {
            $group: {
                _id: null,
                avgServiceTime: { $avg: '$serviceTime' }
            }
        }
    ]);

    const avgServiceTime = serviceTimeResult[0]?.avgServiceTime ?
        Math.round(serviceTimeResult[0].avgServiceTime) : 0;

    // SLA Compliance (30 minutes total time)
    const totalTime = avgWaitTime + avgServiceTime;
    const slaCompliance = totalTime <= 30 ? 100 :
        Math.max(0, Math.round((30 / totalTime) * 100));

    // Satisfaction Score
    const feedbackResult = await Feedback.aggregate([
        {
            $match: {
                created_date: { $gte: start, $lte: end }
            }
        },
        {
            $group: {
                _id: null,
                avgRating: { $avg: '$rate' }
            }
        }
    ]);

    const satisfactionScore = feedbackResult[0]?.avgRating ?
        parseFloat(feedbackResult[0].avgRating.toFixed(1)) : 0;

    return {
        citizensServed,
        avgWaitTime,
        avgServiceTime,
        slaCompliance,
        satisfactionScore
    };
};

/**
 * Calculate live service centers data
 */
const calculateLiveCenters = async (start, end) => {
    const departments = await Department.find();

    const centers = await Promise.all(departments.map(async (dept) => {
        // Current active visitors
        const currentQueue = await ServiceDelivery.countDocuments({
            'departments_assigned.department_id': dept._id,
            is_still_inhouse: true
        });

        // Average wait time
        const waitTimeResult = await ServiceTracking.aggregate([
            {
                $match: {
                    department_id: dept._id,
                    started_at: { $gte: start, $lte: end }
                }
            },
            {
                $lookup: {
                    from: 'servicedeliveries',
                    localField: 'provider_id',
                    foreignField: 'services_status.provider_id',
                    as: 'service'
                }
            },
            {
                $unwind: { path: '$service', preserveNullAndEmptyArrays: true }
            },
            {
                $unwind: { path: '$service.services_status', preserveNullAndEmptyArrays: true }
            },
            {
                $match: {
                    'service.services_status.provider_id': { $exists: true }
                }
            },
            {
                $project: {
                    waitTime: {
                        $divide: [
                            { $subtract: ['$started_at', '$service.services_status.assigned_time'] },
                            60000
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    avgWait: { $avg: '$waitTime' }
                }
            }
        ]);

        const avgWait = waitTimeResult[0]?.avgWait || 0;
        const status = avgWait > 45 ? 'Critical' :
                      avgWait > 20 ? 'Busy' :
                      avgWait > 10 ? 'Normal' : 'Good';

        return {
            name: dept.name,
            queue: currentQueue,
            avgWait: Math.round(avgWait),
            status
        };
    }));

    return centers;
};

/**
 * Calculate employee performance data
 */
const calculateEmployeePerformance = async (start, end) => {
    const employees = await User.find({
        role: { $in: ['Department Employee', 'Department Manager'] }
    });

    const performance = await Promise.all(employees.map(async (emp) => {
        // Services completed
        const served = await ServiceTracking.countDocuments({
            provider_id: emp._id,
            ended_at: { $gte: start, $lte: end }
        });

        // Average service time
        const serviceTimeResult = await ServiceTracking.aggregate([
            {
                $match: {
                    provider_id: emp._id,
                    ended_at: { $gte: start, $lte: end },
                    started_at: { $exists: true }
                }
            },
            {
                $project: {
                    serviceTime: {
                        $divide: [
                            { $subtract: ['$ended_at', '$started_at'] },
                            60000
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    avgServiceTime: { $avg: '$serviceTime' }
                }
            }
        ]);

        // Employee rating from feedback
        const feedbackResult = await Feedback.aggregate([
            {
                $match: {
                    provider_id: emp._id,
                    created_date: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: null,
                    avgRating: { $avg: '$rate' }
                }
            }
        ]);

        const avgTime = serviceTimeResult[0]?.avgServiceTime || 0;
        const rating = feedbackResult[0]?.avgRating || 0;

        const status = avgTime > 15 ? 'Slow' :
                      avgTime > 10 ? 'Moderate' :
                      avgTime > 5 ? 'Good' : 'Excellent';

        return {
            name: `${emp.personalInfo?.firstName || ''} ${emp.personalInfo?.lastName || ''}`.trim() || emp.email,
            served,
            avgTime: Math.round(avgTime),
            rating: parseFloat(rating.toFixed(1)),
            status
        };
    }));

    return performance;
};

/**
 * Calculate office rankings
 */
const calculateOfficeRankings = async () => {
    const rankings = await Department.aggregate([
        {
            $lookup: {
                from: 'servicetrackings',
                localField: '_id',
                foreignField: 'department_id',
                as: 'services'
            }
        },
        {
            $project: {
                name: 1,
                serviceCount: { $size: '$services' }
            }
        },
        { $sort: { serviceCount: -1 } },
        { $limit: 4 }
    ]);

    return rankings.map((dept, index) => ({
        rank: index + 1,
        name: dept.name
    }));
};

/**
 * Calculate waiting time analytics (simplified)
 */
const calculateWaitingAnalytics = async () => {
    // This would need hourly data tracking - for now return structured data
    return [
        { time: '8AM-10AM', level: 'Critical', color: 'red' },
        { time: '10AM-12PM', level: 'Moderate', color: 'yellow' },
        { time: '12PM-2PM', level: 'Normal', color: 'green' },
        { time: '2PM-5PM', level: 'Moderate', color: 'yellow' }
    ];
};

/**
 * Calculate service duration by department
 */
const calculateServiceDuration = async (start, end) => {
    const durations = await Department.aggregate([
        {
            $lookup: {
                from: 'servicetrackings',
                localField: '_id',
                foreignField: 'department_id',
                as: 'services'
            }
        },
        {
            $unwind: { path: '$services', preserveNullAndEmptyArrays: true }
        },
        {
            $match: {
                'services.started_at': { $gte: start, $lte: end },
                'services.ended_at': { $exists: true }
            }
        },
        {
            $project: {
                name: 1,
                duration: {
                    $divide: [
                        { $subtract: ['$services.ended_at', '$services.started_at'] },
                        60000
                    ]
                }
            }
        },
        {
            $group: {
                _id: '$name',
                avgDuration: { $avg: '$duration' }
            }
        },
        {
            $project: {
                service: '$_id',
                duration: { $round: ['$avgDuration', 0] }
            }
        },
        { $sort: { duration: -1 } },
        { $limit: 4 }
    ]);

    return durations;
};

/**
 * Calculate SLA monitoring data
 */
const calculateSLAMonitoring = async (serviceMetrics, serviceDuration) => {
    return {
        withinSLA: serviceMetrics.slaCompliance,
        delayed: 100 - serviceMetrics.slaCompliance,
        mostDelayedOffice: 'Gasabo', // Would calculate from actual data
        highestDelayService: serviceDuration[0]?.service || 'N/A'
    };
};

/**
 * Calculate citizen feedback data
 */
const calculateCitizenFeedback = async (start, end) => {
    const feedbackResult = await Feedback.aggregate([
        {
            $match: {
                created_date: { $gte: start, $lte: end }
            }
        },
        {
            $group: {
                _id: null,
                totalFeedback: { $sum: 1 },
                positiveFeedback: {
                    $sum: { $cond: [{ $gte: ['$rate', 4] }, 1, 0] }
                },
                complaints: {
                    $sum: { $cond: [{ $lte: ['$rate', 2] }, 1, 0] }
                },
                avgRating: { $avg: '$rate' }
            }
        }
    ]);

    const data = feedbackResult[0] || { totalFeedback: 0, positiveFeedback: 0, complaints: 0, avgRating: 0 };

    return {
        positive: data.totalFeedback > 0 ? Math.round((data.positiveFeedback / data.totalFeedback) * 100) : 0,
        complaints: data.complaints,
        abandonmentRate: 6, // Would need separate tracking
        avgRating: parseFloat((data.avgRating || 0).toFixed(1))
    };
};

/**
 * Calculate service flow data
 */
const calculateServiceFlow = (serviceMetrics) => {
    return {
        avgQueueTime: serviceMetrics.avgWaitTime,
        avgProcessingTime: serviceMetrics.avgServiceTime,
        avgTotalTime: serviceMetrics.avgWaitTime + serviceMetrics.avgServiceTime
    };
};

/**
 * Calculate task SLA
 */
const calculateTaskSLA = async (start, end) => {
    const tasks = await Task.find({
        createdAt: { $gte: start, $lte: end }
    });

    const completedTasks = tasks.filter(t => t.status === 'Completed').length;
    return tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
};

/**
 * Generate AI insights based on data analysis
 */
const generateInsights = (liveCenters, serviceDuration, slaMonitoring) => {
    const insights = [];

    const criticalCenters = liveCenters.filter(c => c.status === 'Critical');
    if (criticalCenters.length > 0) {
        insights.push(`Increase staffing at ${criticalCenters[0].name} during peak hours`);
    }

    if (serviceDuration.length > 0) {
        const slowestService = serviceDuration[0];
        insights.push(`${slowestService.service} processing causing delays - consider optimization`);
    }

    if (slaMonitoring.delayed > 20) {
        insights.push('High SLA violation rate detected - review service processes');
    }

    insights.push('Monitor employee performance metrics for continuous improvement');
    insights.push('Consider implementing appointment system to reduce wait times');

    return insights;
};

/**
 * Generate real-time alerts based on current data
 */
const generateAlerts = (liveCenters, slaMonitoring) => {
    const alerts = [];

    liveCenters.forEach(center => {
        if (center.status === 'Critical') {
            alerts.push(`${center.name} waiting time exceeded 45 minutes`);
        }
        if (center.queue > 50) {
            alerts.push(`Queue overflow at ${center.name}`);
        }
    });

    if (slaMonitoring.delayed > 20) {
        alerts.push(`${slaMonitoring.delayed}% SLA violations detected`);
    }

    if (alerts.length === 0) {
        alerts.push('All systems operating within normal parameters');
    }

    return alerts;
};

/**
 * Calculate system status
 */
const calculateSystemStatus = async () => {
    const activeEmployees = await User.countDocuments({
        role: { $in: ['Department Employee', 'Department Manager', 'Receptionist'] }
    });

    const activeQueue = await ServiceDelivery.countDocuments({
        is_still_inhouse: true
    });

    return {
        status: 'ONLINE',
        activeEmployees,
        activeQueue,
        lastSync: new Date().toLocaleTimeString()
    };
};

module.exports = {
    getDashboardAnalytics
};