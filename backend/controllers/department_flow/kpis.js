const ServiceDelivery = require('../../models/service_delivery.js');
const Feedback = require('../../models/feedback_db.js');
const Department = require('../../models/department.js');
const Task = require('../../models/task.js');
const User = require('../../models/user.js');
const { sendError } = require('../../utilities/visitors');
const { visitScopeFor, assignedTo, statusFilter, noDepartments } = require('./visitors_by_status');

// Kigali is UTC+2; mirrors the timezone shim used by the global statistics controller
const TZ_OFFSET_MS = 2 * 60 * 60 * 1000;

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

const parseRange = (from, to) => {
    let fromDate = from ? new Date(from) : null;
    let toDate = to ? new Date(to) : null;
    if (fromDate && isNaN(fromDate.getTime())) fromDate = null;
    if (toDate && isNaN(toDate.getTime())) toDate = null;
    // Date-only "to" means "through the end of that day"
    if (toDate && /^\d{4}-\d{2}-\d{2}$/.test(to)) toDate.setHours(23, 59, 59, 999);
    return { fromDate, toDate };
};

/** Math.round for a numeric expression (MongoDB $round rounds halves to even). */
const roundExpr = (expr) => ({ $floor: { $add: [expr, 0.5] } });

/**
 * Finished service timers (durations.services_durations, closed for
 * completed and transferred services alike) of the given departments in the
 * matched visits, as { d: timer, minutes } with minutes > 0.
 */
const finishedTimers = (match, departmentIds) => ([
    { $match: match },
    { $unwind: '$durations.services_durations' },
    { $project: { d: '$durations.services_durations' } },
    { $match: { 'd.department_id': { $in: departmentIds }, 'd.started_at': { $type: 'date' }, 'd.ended_at': { $type: 'date' } } },
    { $addFields: { minutes: roundExpr({ $divide: [{ $subtract: ['$d.ended_at', '$d.started_at'] }, 60000] }) } },
    { $match: { minutes: { $gt: 0 } } },
]);

/** Average, longest and shortest service per department, slowest first. */
const serviceTimesPipeline = (match, departmentIds) => ([
    ...finishedTimers(match, departmentIds),
    {
        $group: {
            _id: '$d.department_id',
            department_name: { $first: '$d.department_name' },
            avg: { $avg: '$minutes' },
            max_minutes: { $max: '$minutes' },
            min_minutes: { $min: '$minutes' },
            total_cases: { $sum: 1 }
        }
    },
    {
        $project: {
            _id: 0,
            department_name: { $cond: [{ $eq: [{ $ifNull: ['$department_name', ''] }, ''] }, 'Unknown', '$department_name'] },
            avg_minutes: roundExpr('$avg'),
            max_minutes: 1,
            min_minutes: 1,
            total_cases: 1
        }
    },
    {
        $addFields: {
            status: {
                $switch: {
                    branches: [
                        { case: { $gt: ['$avg_minutes', 60] }, then: 'Critical' },
                        { case: { $gt: ['$avg_minutes', 30] }, then: 'Moderate' }
                    ],
                    default: 'Normal'
                }
            }
        }
    },
    { $sort: { avg_minutes: -1 } }
]);

const departmentsOf = (departmentIds, fields) => Department.find({ _id: { $in: departmentIds.filter((id) => OBJECT_ID.test(id)) } })
    .select(fields)
    .lean();

/**
 * GET /department-manager/analytics/kpis?from=&to=
 * Departmental KPI dashboard data, scoped to the departments the authenticated
 * head of department manages. Parking data is intentionally excluded (it has no department).
 * Visitor statuses are decided on the managed departments' own service
 * entries; a transferred entry counts as finished (completed) for that department.
 */
const getDepartmentKpis = async (req, res, next) => {
    try {
        const departmentIds = await visitScopeFor(req);
        if (departmentIds.length === 0) return noDepartments(res);

        const { fromDate, toDate } = parseRange(req.query.from, req.query.to);

        const deptFilter = assignedTo(departmentIds);

        const dateFilter = {};
        if (fromDate || toDate) {
            dateFilter.entry_date = {};
            if (fromDate) dateFilter.entry_date.$gte = fromDate;
            if (toDate) dateFilter.entry_date.$lte = toDate;
        }

        const baseFilter = { ...deptFilter, ...dateFilter };
        const countStatus = (status) => ServiceDelivery.countDocuments({ ...baseFilter, ...statusFilter(status, departmentIds) });

        // ---- Visitor counts by status (same status semantics as visitors_by_status) ----
        const [total, pending, active, transferred, completed] = await Promise.all([
            ServiceDelivery.countDocuments(baseFilter),
            countStatus('pending'),
            countStatus('active'),
            countStatus('transferred'),
            countStatus('completed')
        ]);

        // ---- Daily visitors over the selected range (default: last 30 days) ----
        const dailyFrom = fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const dailyTo = toDate || new Date();
        const dailyVisitors = await ServiceDelivery.aggregate([
            { $match: { ...deptFilter, entry_date: { $gte: dailyFrom, $lte: dailyTo } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: { $add: ['$entry_date', TZ_OFFSET_MS] } } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // ---- Hourly visitors today ----
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        const hourlyAgg = await ServiceDelivery.aggregate([
            { $match: { ...deptFilter, entry_date: { $gte: startOfDay, $lte: endOfDay } } },
            { $group: { _id: { $hour: { $add: ['$entry_date', TZ_OFFSET_MS] } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);
        const hourly_today = Array.from({ length: 24 }, (_, hour) => ({
            hour,
            visitors: hourlyAgg.find(h => h._id === hour)?.count || 0
        }));

        // ---- Waiting/service time for the managed departments ----
        const service_times = await ServiceDelivery.aggregate(serviceTimesPipeline(baseFilter, departmentIds));

        // ---- Feedback (scoped to the managed departments) ----
        const feedbackFilter = { department_id: { $in: departmentIds } };
        if (fromDate || toDate) {
            feedbackFilter.created_date = {};
            if (fromDate) feedbackFilter.created_date.$gte = fromDate;
            if (toDate) feedbackFilter.created_date.$lte = toDate;
        }

        const [feedbackStats] = await Feedback.aggregate([
            { $match: feedbackFilter },
            {
                $group: {
                    _id: null,
                    average_rating: { $avg: '$rate' },
                    total_feedback: { $sum: 1 },
                    average_out_of: { $avg: '$rate_out_of' }
                }
            }
        ]);

        const ratingDistribution = await Feedback.aggregate([
            { $match: feedbackFilter },
            { $group: { _id: '$rate', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        // ---- Team & task summary ----
        const memberFilter = { department: { $in: departmentIds.filter((id) => OBJECT_ID.test(id)) } };
        const [memberIds, activeMembers] = await Promise.all([
            User.distinct('_id', memberFilter),
            User.countDocuments({ ...memberFilter, is_active: true })
        ]);

        const taskAgg = memberIds.length > 0 ? await Task.aggregate([
            { $match: { incharge: { $in: memberIds } } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]) : [];
        const tasks = { 'Under-review': 0, 'In-progress': 0, 'Completed': 0, total: 0 };
        taskAgg.forEach(t => {
            if (tasks[t._id] !== undefined) tasks[t._id] = t.count;
            tasks.total += t.count;
        });

        const departments = await departmentsOf(departmentIds, 'department_name department_response_time_in_minutes total_employees');

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Department KPIs retrieved successfully',
            data: {
                departments: departments.map(d => ({
                    _id: d._id,
                    name: d.department_name,
                    department_name: d.department_name,
                    response_time_target_minutes: d.department_response_time_in_minutes || 0
                })),
                visitors: { total, pending, active, transferred, completed },
                daily_visitors: dailyVisitors.map(d => ({ date: d._id, count: d.count })),
                hourly_today,
                service_times,
                feedback: {
                    total: feedbackStats?.total_feedback || 0,
                    average_rating: feedbackStats?.average_rating ? Math.round(feedbackStats.average_rating * 10) / 10 : 0,
                    average_out_of: feedbackStats?.average_out_of || 10,
                    rating_distribution: ratingDistribution.map(r => ({ rating: r._id, count: r.count }))
                },
                team: {
                    total_members: memberIds.length,
                    active_members: activeMembers,
                    tasks
                }
            }
        });

    } catch (error) {
        return sendError(res, error, 'Something went wrong while retrieving department KPIs');
    }
};

/**
 * GET /department-manager/analytics/response-time
 * Average service time per day (last 14 days) versus the department's configured target.
 */
const getResponseTimeAnalytics = async (req, res, next) => {
    try {
        const departmentIds = await visitScopeFor(req);
        if (departmentIds.length === 0) return noDepartments(res);

        const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

        const [series, departments] = await Promise.all([
            ServiceDelivery.aggregate([
                ...finishedTimers({ ...assignedTo(departmentIds), entry_date: { $gte: since } }, departmentIds),
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: { $add: ['$d.started_at', TZ_OFFSET_MS] } } },
                        avg: { $avg: '$minutes' },
                        cases: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } },
                { $project: { _id: 0, date: '$_id', avg_minutes: roundExpr('$avg'), cases: 1 } }
            ]),
            departmentsOf(departmentIds, 'department_name department_response_time_in_minutes')
        ]);

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Response time analytics retrieved successfully',
            data: {
                targets: departments.map(d => ({
                    department_name: d.department_name,
                    target_minutes: d.department_response_time_in_minutes || 0
                })),
                series
            }
        });

    } catch (error) {
        return sendError(res, error, 'Something went wrong while retrieving response time analytics');
    }
};

module.exports = {
    getDepartmentKpis,
    getResponseTimeAnalytics
};
