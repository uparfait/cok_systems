
const Audit = require('../../models/audit.js');
const User = require('../../models/user.js');
const { getDepartmentIdsForHead } = require('./visitors_by_status');

// User ids (as strings, matching Audit.user_id) of everyone in the managed departments, plus the head
const getAuditScopeUserIds = async (userId) => {
    const departmentIds = await getDepartmentIdsForHead(userId);
    if (departmentIds.length === 0) return { departmentIds: [], userIds: [] };

    const members = await User.find({ department: { $in: departmentIds } }).select('_id');
    const userIds = members.map(m => m._id.toString());
    const selfId = userId.toString();
    if (!userIds.includes(selfId)) userIds.push(selfId);

    return { departmentIds, userIds };
};

/**
 * GET /department-manager/audit/logs
 * Audit trail limited to activity of the managed departments' members.
 */
const getDepartmentAuditLogs = async (req, res, next) => {
    try {
        let { limit = 20, page = 1, action, resource, start_date, end_date } = req.query;

        const limit_val = Math.min(parseInt(limit) || 20, 100);
        const skip_val = ((parseInt(page) || 1) - 1) * limit_val;

        const { userIds } = await getAuditScopeUserIds(req.user.userId);
        if (userIds.length === 0) {
            return res.status(403).json({
                success: false,
                type: 'error',
                message: 'No departments found for this user'
            });
        }

        const filter = { user_id: { $in: userIds } };

        if (action) filter.action = action;
        if (resource) filter.resource = resource;

        if (start_date || end_date) {
            filter.time = {};
            if (start_date) filter.time.$gte = new Date(start_date);
            if (end_date) {
                const end = new Date(end_date);
                // Date-only input means "through the end of that day"
                if (/^\d{4}-\d{2}-\d{2}$/.test(end_date)) end.setHours(23, 59, 59, 999);
                filter.time.$lte = end;
            }
        }

        const logs = await Audit.find(filter)
            .limit(limit_val)
            .skip(skip_val)
            .sort({ time: -1 });

        const total_count = await Audit.countDocuments(filter);

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Department audit logs retrieved successfully',
            total: total_count,
            page: parseInt(page) || 1,
            limit: limit_val,
            data: logs
        });

    } catch (error) {
        console.error('Error in getDepartmentAuditLogs:', error);
        return res.status(500).json({
            success: false,
            type: 'error',
            message: 'Something went wrong while retrieving audit logs',
            error: error.message
        });
    }
};

/**
 * GET /department-manager/audit/stats
 * Compliance summary (action/resource breakdown, most active members, recent errors)
 * for the managed departments over the last N days.
 */
const getDepartmentAuditStats = async (req, res, next) => {
    try {
        const days = Math.min(parseInt(req.query.days) || 30, 365);
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const { userIds } = await getAuditScopeUserIds(req.user.userId);
        if (userIds.length === 0) {
            return res.status(403).json({
                success: false,
                type: 'error',
                message: 'No departments found for this user'
            });
        }

        const match = { user_id: { $in: userIds }, time: { $gte: since } };

        const [total_logs, actionBreakdown, resourceBreakdown, topUsers, recentErrors] = await Promise.all([
            Audit.countDocuments(match),
            Audit.aggregate([
                { $match: match },
                { $group: { _id: '$action', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            Audit.aggregate([
                { $match: match },
                { $group: { _id: '$resource', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            Audit.aggregate([
                { $match: match },
                { $group: { _id: '$user_id', user_name: { $last: '$user_name' }, user_email: { $last: '$user_email' }, count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]),
            Audit.find({ ...match, action: 'ERROR' }).sort({ time: -1 }).limit(5)
        ]);

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Department audit statistics retrieved successfully',
            data: {
                period_days: days,
                total_logs,
                action_breakdown: actionBreakdown,
                resource_breakdown: resourceBreakdown,
                top_users: topUsers,
                recent_errors: recentErrors
            }
        });

    } catch (error) {
        console.error('Error in getDepartmentAuditStats:', error);
        return res.status(500).json({
            success: false,
            type: 'error',
            message: 'Something went wrong while retrieving audit statistics',
            error: error.message
        });
    }
};

module.exports = {
    getDepartmentAuditLogs,
    getDepartmentAuditStats
};
