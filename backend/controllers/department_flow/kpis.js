
const ServiceDelivery = require('../../models/service_delivery.js');
const Feedback = require('../../models/feedback_db.js');
const Department = require('../../models/department.js');
const Task = require('../../models/task.js');
const User = require('../../models/user.js');
const { getDepartmentIdsForHead } = require('./visitors_by_status');

// Kigali is UTC+2; mirrors the timezone shim used by the global statistics controller
const TZ_OFFSET_MS = 2 * 60 * 60 * 1000;

const parseRange = (from, to) => {
    let fromDate = from ? new Date(from) : null;
    let toDate = to ? new Date(to) : null;
    if (fromDate && isNaN(fromDate.getTime())) fromDate = null;
    if (toDate && isNaN(toDate.getTime())) toDate = null;
    // Date-only "to" means "through the end of that day"
    if (toDate && /^\d{4}-\d{2}-\d{2}$/.test(to)) toDate.setHours(23, 59, 59, 999);
    return { fromDate, toDate };
};

/**
 * GET /department-manager/analytics/kpis?from=&to=
 * Departmental KPI dashboard data, scoped to the departments the authenticated
 * head of department manages. Parking data is intentionally excluded (it has no department).
 */
const getDepartmentKpis = async (req, res, next) => {
    try {
        const departmentIds = await getDepartmentIdsForHead(req.user.userId);
        if (departmentIds.length === 0) {
            return res.status(403).json({
                success: false,
                type: 'error',
                message: 'No departments found for this user'
            });
        }

        const { fromDate, toDate } = parseRange(req.query.from, req.query.to);

        const deptFilter = {
            departments_assigned: { $elemMatch: { department_id: { $in: departmentIds } } }
        };

        const dateFilter = {};
        if (fromDate || toDate) {
            dateFilter.entry_date = {};
            if (fromDate) dateFilter.entry_date.$gte = fromDate;
            if (toDate) dateFilter.entry_date.$lte = toDate;
        }

        const baseFilter = { ...deptFilter, ...dateFilter };

        // ---- Visitor counts by status (same status semantics as visitors_by_status) ----
        const [total, pending, active, transferred, completed] = await Promise.all([
            ServiceDelivery.countDocuments(baseFilter),
            ServiceDelivery.countDocuments({ ...baseFilter, 'services_status.s_type': { $in: ['Not started'] }, is_still_inhouse: true }),
            ServiceDelivery.countDocuments({ ...baseFilter, 'services_status.s_type': { $in: ['Inprogress'] }, is_being_served: true, is_still_inhouse: true }),
            ServiceDelivery.countDocuments({ ...baseFilter, 'services_status.s_type': { $in: ['Transfered', 'Transferred'] }, is_still_inhouse: true }),
            ServiceDelivery.countDocuments({ ...baseFilter, 'services_status.s_type': { $in: ['Completed'] } })
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
        const serviceRecords = await ServiceDelivery.find(baseFilter)
            .select('departments_assigned durations entry_date');

        const waitingByDept = {};
        const idSet = new Set(departmentIds);

        serviceRecords.forEach(record => {
            (record.durations?.services_durations || []).forEach(duration => {
                if (!idSet.has(duration.department_id)) return;
                if (!duration.started_at || !duration.ended_at) return;

                const minutes = Math.round((new Date(duration.ended_at) - new Date(duration.started_at)) / 60000);
                if (minutes <= 0) return;

                const key = duration.department_id;
                if (!waitingByDept[key]) {
                    waitingByDept[key] = { department_name: duration.department_name || 'Unknown', times: [] };
                }
                waitingByDept[key].times.push(minutes);
            });
        });

        const service_times = Object.values(waitingByDept).map(dept => {
            const avg = Math.round(dept.times.reduce((s, t) => s + t, 0) / dept.times.length);
            let status = 'Normal';
            if (avg > 60) status = 'Critical';
            else if (avg > 30) status = 'Moderate';
            return {
                department_name: dept.department_name,
                avg_minutes: avg,
                max_minutes: Math.max(...dept.times),
                min_minutes: Math.min(...dept.times),
                total_cases: dept.times.length,
                status
            };
        }).sort((a, b) => b.avg_minutes - a.avg_minutes);

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
        const members = await User.find({ department: { $in: departmentIds } }).select('_id is_active');
        const memberIds = members.map(m => m._id);

        const taskAgg = memberIds.length > 0 ? await Task.aggregate([
            { $match: { incharge: { $in: memberIds } } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]) : [];
        const tasks = { 'Under-review': 0, 'In-progress': 0, 'Completed': 0, total: 0 };
        taskAgg.forEach(t => {
            if (tasks[t._id] !== undefined) tasks[t._id] = t.count;
            tasks.total += t.count;
        });

        const departments = await Department.find({ _id: { $in: departmentIds } })
            .select('name department_response_time_in_minutes total_employees');

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Department KPIs retrieved successfully',
            data: {
                departments: departments.map(d => ({
                    _id: d._id,
                    name: d.name,
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
                    total_members: members.length,
                    active_members: members.filter(m => m.is_active).length,
                    tasks
                }
            }
        });

    } catch (error) {
        console.error('Error in getDepartmentKpis:', error);
        return res.status(500).json({
            success: false,
            type: 'error',
            message: 'Something went wrong while retrieving department KPIs',
            error: error.message
        });
    }
};

/**
 * GET /department-manager/analytics/response-time
 * Average service time per day (last 14 days) versus the department's configured target.
 */
const getResponseTimeAnalytics = async (req, res, next) => {
    try {
        const departmentIds = await getDepartmentIdsForHead(req.user.userId);
        if (departmentIds.length === 0) {
            return res.status(403).json({
                success: false,
                type: 'error',
                message: 'No departments found for this user'
            });
        }

        const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        const idSet = new Set(departmentIds);

        const records = await ServiceDelivery.find({
            departments_assigned: { $elemMatch: { department_id: { $in: departmentIds } } },
            entry_date: { $gte: since }
        }).select('durations entry_date');

        const byDay = {};
        records.forEach(record => {
            (record.durations?.services_durations || []).forEach(duration => {
                if (!idSet.has(duration.department_id)) return;
                if (!duration.started_at || !duration.ended_at) return;
                const minutes = Math.round((new Date(duration.ended_at) - new Date(duration.started_at)) / 60000);
                if (minutes <= 0) return;
                const day = new Date(new Date(duration.started_at).getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
                if (!byDay[day]) byDay[day] = [];
                byDay[day].push(minutes);
            });
        });

        const series = Object.keys(byDay).sort().map(day => ({
            date: day,
            avg_minutes: Math.round(byDay[day].reduce((s, t) => s + t, 0) / byDay[day].length),
            cases: byDay[day].length
        }));

        const departments = await Department.find({ _id: { $in: departmentIds } })
            .select('name department_response_time_in_minutes');

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Response time analytics retrieved successfully',
            data: {
                targets: departments.map(d => ({
                    department_name: d.name,
                    target_minutes: d.department_response_time_in_minutes || 0
                })),
                series
            }
        });

    } catch (error) {
        console.error('Error in getResponseTimeAnalytics:', error);
        return res.status(500).json({
            success: false,
            type: 'error',
            message: 'Something went wrong while retrieving response time analytics',
            error: error.message
        });
    }
};

module.exports = {
    getDepartmentKpis,
    getResponseTimeAnalytics
};
