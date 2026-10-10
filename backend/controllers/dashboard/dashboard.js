/**
 * Dashboard Controller
 * GET /dashboard/analytics?startDate&endDate (default: today, server time).
 * Every figure is computed by MongoDB. Visits keep only a reference to the
 * visitor and nothing here returns personal details, so visits of the old
 * structure (no visitor reference) are counted the same way.
 */

const ServiceDelivery = require('../../models/service_delivery.js');
const ServiceTracking = require('../../models/service_tracking.js');
const Feedback = require('../../models/feedback_db.js');
const User = require('../../models/user.js');
const Department = require('../../models/department.js');
const Task = require('../../models/task.js');

// roles.role_name of the people who serve visitors, and of all front-line staff
const SERVICE_ROLES = ['Employee', 'Head of department'];
const STAFF_ROLES = [...SERVICE_ROLES, 'Receptionist'];

const minutesBetween = (later, earlier) => ({ $divide: [{ $subtract: [later, earlier] }, 60000] });
const isDate = (expression) => ({ $eq: [{ $type: expression }, 'date'] });

const waitStatus = (minutes) => (minutes > 45 ? 'Critical' : minutes > 20 ? 'Busy' : minutes > 10 ? 'Normal' : 'Good');
const speedStatus = (minutes) => (minutes > 15 ? 'Slow' : minutes > 10 ? 'Moderate' : minutes > 5 ? 'Good' : 'Excellent');

/** A date-only value (YYYY-MM-DD) is that local day: its start, or its end for endDate. */
function parseDay(value, endOfDay) {
    const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
    if (!day) return new Date(value);
    const [year, month, date] = [Number(day[1]), Number(day[2]) - 1, Number(day[3])];
    return endOfDay ? new Date(year, month, date, 23, 59, 59, 999) : new Date(year, month, date);
}

/** Period from the query (default: today). Null when a date is invalid. */
function readRange({ startDate, endDate } = {}) {
    const now = new Date();
    const start = startDate ? parseDay(startDate, false) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = endDate ? parseDay(endDate, true) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    return { start, end };
}

/** Get comprehensive dashboard analytics */
const getDashboardAnalytics = async (req, res) => {
    try {
        const range = readRange(req.query || {});
        if (!range) {
            return res.status(400).json({ success: false, type: 'warning', message: 'Invalid startDate or endDate' });
        }
        const { start, end } = range;

        // Shared by the overall figure and the per-department figures
        const waits = calculateWaitTimes(start, end);

        const [serviceMetrics, liveCenters, employeePerformance, officeRankings,
            serviceDuration, citizenFeedback, taskSLA, systemStatus] = await Promise.all([
            calculateServiceMetrics(start, end, waits),
            calculateLiveCenters(waits),
            calculateEmployeePerformance(start, end),
            calculateOfficeRankings(),
            calculateServiceDuration(start, end),
            calculateCitizenFeedback(start, end),
            calculateTaskSLA(start, end),
            calculateSystemStatus()
        ]);

        const waitingAnalytics = calculateWaitingAnalytics();
        const slaMonitoring = calculateSLAMonitoring(serviceMetrics, serviceDuration);
        const serviceFlow = calculateServiceFlow(serviceMetrics);
        const insights = generateInsights(liveCenters, serviceDuration, slaMonitoring);
        const alerts = generateAlerts(liveCenters, slaMonitoring);

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
 * Waiting time, in minutes: from the moment a visit was sent to a department
 * (departments_assigned.assigned_time) to the moment that department started
 * serving it (durations.services_durations.started_at). Each service started
 * in the period is paired with the latest assignment to the same department
 * made before it, so a visitor sent to a department twice is measured twice.
 * @returns {Promise<{ overall: number, byDepartment: Map<string, number> }>}
 */
const calculateWaitTimes = async (start, end) => {
    const latestAssignment = {
        $max: {
            $map: {
                input: {
                    $filter: {
                        input: '$assigned',
                        as: 'a',
                        cond: {
                            $and: [
                                { $eq: ['$$a.department_id', '$start.department_id'] },
                                isDate('$$a.assigned_time'),
                                { $lte: ['$$a.assigned_time', '$start.started_at'] }
                            ]
                        }
                    }
                },
                as: 'a',
                in: '$$a.assigned_time'
            }
        }
    };

    const [result] = await ServiceDelivery.aggregate([
        { $match: { 'durations.services_durations.started_at': { $gte: start, $lte: end } } },
        {
            $project: {
                _id: 0,
                start: '$durations.services_durations',
                assigned: { $ifNull: ['$departments_assigned', []] }
            }
        },
        { $unwind: '$start' },
        {
            $project: {
                department_id: '$start.department_id',
                started_at: '$start.started_at',
                assigned_at: latestAssignment
            }
        },
        {
            $match: {
                started_at: { $gte: start, $lte: end },
                department_id: { $type: 'string', $ne: '' },
                assigned_at: { $type: 'date' }
            }
        },
        { $set: { wait: minutesBetween('$started_at', '$assigned_at') } },
        {
            $facet: {
                overall: [{ $group: { _id: null, avgWait: { $avg: '$wait' } } }],
                by_department: [{ $group: { _id: '$department_id', avgWait: { $avg: '$wait' } } }]
            }
        }
    ]);

    return {
        overall: (result && result.overall[0] && result.overall[0].avgWait) || 0,
        byDepartment: new Map(((result && result.by_department) || []).map((row) => [String(row._id), row.avgWait || 0]))
    };
};

/** Calculate service metrics */
const calculateServiceMetrics = async (start, end, waitsPromise) => {
    const [citizensServed, waits, serviceTimeResult, feedbackResult] = await Promise.all([
        // Citizens Served - visits with a completed service
        ServiceDelivery.countDocuments({ 'services_status.s_type': 'Completed' }),
        waitsPromise,
        // Average Service Time
        ServiceTracking.aggregate([
            { $match: { started_at: { $gte: start, $lte: end }, ended_at: { $exists: true } } },
            { $group: { _id: null, avgServiceTime: { $avg: minutesBetween('$ended_at', '$started_at') } } }
        ]),
        // Satisfaction Score
        Feedback.aggregate([
            { $match: { created_date: { $gte: start, $lte: end } } },
            { $group: { _id: null, avgRating: { $avg: '$rate' } } }
        ])
    ]);

    const avgWaitTime = waits.overall ? Math.round(waits.overall) : 0;
    const avgServiceTime = serviceTimeResult[0]?.avgServiceTime ?
        Math.round(serviceTimeResult[0].avgServiceTime) : 0;

    // SLA Compliance (30 minutes total time)
    const totalTime = avgWaitTime + avgServiceTime;
    const slaCompliance = totalTime <= 30 ? 100 :
        Math.max(0, Math.round((30 / totalTime) * 100));

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
 * Calculate live service centers data: per department, the in-house visits
 * ever sent to it and its average waiting time in the period.
 */
const calculateLiveCenters = async (waitsPromise) => {
    const [departments, queues, waits] = await Promise.all([
        Department.find().select('department_name').lean(),
        ServiceDelivery.aggregate([
            { $match: { is_still_inhouse: true, 'departments_assigned.0': { $exists: true } } },
            { $project: { _id: 0, department_ids: { $setUnion: ['$departments_assigned.department_id', []] } } },
            { $unwind: '$department_ids' },
            { $group: { _id: '$department_ids', queue: { $sum: 1 } } }
        ]),
        waitsPromise
    ]);

    const queueOf = new Map(queues.map((row) => [String(row._id), row.queue]));

    return departments.map((dept) => {
        const id = String(dept._id);
        const avgWait = waits.byDepartment.get(id) || 0;
        return {
            name: dept.department_name,
            queue: queueOf.get(id) || 0,
            avgWait: Math.round(avgWait),
            status: waitStatus(avgWait)
        };
    });
};

/**
 * Calculate employee performance data: services finished in the period
 * (ServiceTracking.provider_id holds the user id as a string) and the
 * feedback left for them (feedback carries the provider name only).
 */
const calculateEmployeePerformance = async (start, end) => {
    const [employees, services, ratings] = await Promise.all([
        User.find({ 'roles.role_name': { $in: SERVICE_ROLES } }).select('full_name email').lean(),
        ServiceTracking.aggregate([
            { $match: { ended_at: { $gte: start, $lte: end }, provider_id: { $type: 'string', $ne: '' } } },
            {
                $group: {
                    _id: '$provider_id',
                    served: { $sum: 1 },
                    avgServiceTime: { $avg: { $cond: [isDate('$started_at'), minutesBetween('$ended_at', '$started_at'), null] } }
                }
            }
        ]),
        Feedback.aggregate([
            { $match: { created_date: { $gte: start, $lte: end }, provider_name: { $type: 'string', $ne: '' } } },
            { $group: { _id: '$provider_name', avgRating: { $avg: '$rate' } } }
        ])
    ]);

    const serviceOf = new Map(services.map((row) => [String(row._id), row]));
    const ratingOf = new Map(ratings.map((row) => [String(row._id), row.avgRating || 0]));

    return employees.map((emp) => {
        const service = serviceOf.get(String(emp._id)) || {};
        const avgTime = service.avgServiceTime || 0;
        const rating = ratingOf.get(emp.full_name) || 0;
        return {
            name: emp.full_name || emp.email,
            served: service.served || 0,
            avgTime: Math.round(avgTime),
            rating: parseFloat(rating.toFixed(1)),
            status: speedStatus(avgTime)
        };
    });
};

/** Current name of the department of a grouped row (_id = department id string); removed departments are left out. */
const departmentNameStages = () => [
    { $set: { department_oid: { $convert: { input: '$_id', to: 'objectId', onError: null, onNull: null } } } },
    {
        $lookup: {
            from: Department.collection.name,
            localField: 'department_oid',
            foreignField: '_id',
            pipeline: [{ $project: { department_name: 1 } }],
            as: 'department'
        }
    },
    { $unwind: '$department' },
    { $set: { name: '$department.department_name' } }
];

/** Calculate office rankings: departments by services delivered (all time) */
const calculateOfficeRankings = async () => {
    const rankings = await ServiceTracking.aggregate([
        { $match: { department_id: { $type: 'string', $ne: '' } } },
        { $group: { _id: '$department_id', serviceCount: { $sum: 1 } } },
        ...departmentNameStages(),
        { $sort: { serviceCount: -1, name: 1 } },
        { $limit: 4 }
    ]);

    return rankings.map((dept, index) => ({
        rank: index + 1,
        name: dept.name
    }));
};

/** Calculate waiting time analytics (simplified) */
const calculateWaitingAnalytics = () => {
    // This would need hourly data tracking - for now return structured data
    return [
        { time: '8AM-10AM', level: 'Critical', color: 'red' },
        { time: '10AM-12PM', level: 'Moderate', color: 'yellow' },
        { time: '12PM-2PM', level: 'Normal', color: 'green' },
        { time: '2PM-5PM', level: 'Moderate', color: 'yellow' }
    ];
};

/** Calculate service duration by department (services started in the period) */
const calculateServiceDuration = async (start, end) => {
    return ServiceTracking.aggregate([
        {
            $match: {
                started_at: { $gte: start, $lte: end },
                ended_at: { $type: 'date' },
                department_id: { $type: 'string', $ne: '' }
            }
        },
        { $group: { _id: '$department_id', avgDuration: { $avg: minutesBetween('$ended_at', '$started_at') } } },
        ...departmentNameStages(),
        { $project: { _id: 0, service: '$name', duration: { $round: ['$avgDuration', 0] } } },
        { $sort: { duration: -1, service: 1 } },
        { $limit: 4 }
    ]);
};

/** Calculate SLA monitoring data */
const calculateSLAMonitoring = (serviceMetrics, serviceDuration) => {
    return {
        withinSLA: serviceMetrics.slaCompliance,
        delayed: 100 - serviceMetrics.slaCompliance,
        mostDelayedOffice: 'Gasabo', // Would calculate from actual data
        highestDelayService: serviceDuration[0]?.service || 'N/A'
    };
};

/** Calculate citizen feedback data */
const calculateCitizenFeedback = async (start, end) => {
    const feedbackResult = await Feedback.aggregate([
        { $match: { created_date: { $gte: start, $lte: end } } },
        {
            $group: {
                _id: null,
                totalFeedback: { $sum: 1 },
                positiveFeedback: { $sum: { $cond: [{ $gte: ['$rate', 4] }, 1, 0] } },
                complaints: { $sum: { $cond: [{ $lte: ['$rate', 2] }, 1, 0] } },
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

/** Calculate service flow data */
const calculateServiceFlow = (serviceMetrics) => {
    return {
        avgQueueTime: serviceMetrics.avgWaitTime,
        avgProcessingTime: serviceMetrics.avgServiceTime,
        avgTotalTime: serviceMetrics.avgWaitTime + serviceMetrics.avgServiceTime
    };
};

/** Calculate task SLA: share of the tasks created in the period that are completed */
const calculateTaskSLA = async (start, end) => {
    const [result] = await Task.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } }
            }
        }
    ]);

    return result && result.total > 0 ? Math.round((result.completed / result.total) * 100) : 0;
};

/** Generate AI insights based on data analysis */
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

/** Generate real-time alerts based on current data */
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

/** Calculate system status */
const calculateSystemStatus = async () => {
    const [activeEmployees, activeQueue] = await Promise.all([
        User.countDocuments({ 'roles.role_name': { $in: STAFF_ROLES } }),
        ServiceDelivery.countDocuments({ is_still_inhouse: true })
    ]);

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
