
const Feedback = require('../../models/feedback_db.js');
const UnservicedFeedback = require('../../models/unservicedfeedback_db.js');
const { getDepartmentIdsForHead, buildDateFilter } = require('./visitors_by_status');

// Build a created_date range from explicit from/to (preferred) or a legacy dateFilter preset
const buildCreatedDateRange = (from, to, dateFilter) => {
    if (from || to) {
        const range = {};
        if (from) {
            const start = new Date(from);
            if (!isNaN(start.getTime())) { start.setHours(0, 0, 0, 0); range.$gte = start; }
        }
        if (to) {
            const end = new Date(to);
            if (!isNaN(end.getTime())) { end.setHours(23, 59, 59, 999); range.$lte = end; }
        }
        return Object.keys(range).length > 0 ? { created_date: range } : {};
    }
    return buildDateFilter(dateFilter, 'created_date');
};

/**
 * Feedback scoped to the departments/units the requester leads.
 * target: 'all' (led departments + units + general feedback), 'general' (unserviced only),
 * 'departments' (led departments + units only), or one specific led department/unit id.
 */
const getDepartmentFeedback = async (req, res, next) => {
    try {
        let { limit = 20, page = 1, dateFilter, rating, from, to, target = 'departments' } = req.query;

        const limit_val = Math.min(parseInt(limit) || 20, 50);
        const page_val = Math.max(1, parseInt(page) || 1);
        const skip_val = (page_val - 1) * limit_val;

        const departmentIds = await getDepartmentIdsForHead(req.user.userId);
        if (departmentIds.length === 0) {
            return res.status(403).json({
                success: false,
                type: 'error',
                message: 'No departments found for this user'
            });
        }

        const dateMatch = buildCreatedDateRange(from, to, dateFilter);

        let deptScope = null;
        if (target === 'all' || target === 'departments') {
            deptScope = { $in: departmentIds };
        } else if (target !== 'general') {
            if (!departmentIds.includes(target)) {
                return res.status(403).json({
                    success: false,
                    type: 'error',
                    message: 'You do not lead this department'
                });
            }
            deptScope = target;
        }

        let deptFilter = null;
        if (deptScope) {
            deptFilter = { department_id: deptScope, ...dateMatch };
            if (rating) {
                const ratingNum = parseInt(rating);
                if (!isNaN(ratingNum) && ratingNum >= 1 && ratingNum <= 10) deptFilter.rate = ratingNum;
            }
        }

        const includeGeneral = target === 'all' || target === 'general';

        const [deptRows, generalRows] = await Promise.all([
            deptFilter ? Feedback.find(deptFilter).sort({ created_date: -1 }).lean() : Promise.resolve([]),
            includeGeneral ? UnservicedFeedback.find(dateMatch).sort({ created_date: -1 }).lean() : Promise.resolve([]),
        ]);

        const items = [
            ...deptRows.map((r) => ({ ...r, source: 'department' })),
            ...generalRows.map((r) => ({ ...r, source: 'general', department_name: 'General' })),
        ].sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));

        const total_count = items.length;
        const totalPages = Math.max(1, Math.ceil(total_count / limit_val));
        const data = items.slice(skip_val, skip_val + limit_val);

        const rated = deptRows.filter((r) => typeof r.rate === 'number');
        const sentiment = { positive: 0, neutral: 0, negative: 0 };
        for (const item of items) {
            const ratio = (item.rate || 0) / (item.rate_out_of || 10);
            if (ratio >= 0.7) sentiment.positive += 1;
            else if (ratio >= 0.4) sentiment.neutral += 1;
            else sentiment.negative += 1;
        }
        const analytics = {
            average_rating: rated.length ? rated.reduce((s, r) => s + r.rate, 0) / rated.length : 0,
            total_feedback: deptRows.length,
            general_feedback: generalRows.length,
            sentiment,
        };

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Department feedback retrieved successfully',
            total: total_count,
            totalPages,
            page: page_val,
            limit: limit_val,
            data,
            analytics
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
    getDepartmentFeedback
};
