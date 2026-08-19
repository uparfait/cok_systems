const Feedback = require("../../models/feedback_db.js");
const UnservicedFeedback = require("../../models/unservicedfeedback_db.js");

// Same period logic as serivice_delivery/assigned_visitors_gender_stats.js
const getPeriodBounds = (period, from, to) => {
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

/**
 * List feedbacks paginated (10 per page by default) with target + period filters.
 * target: 'all' (department + general merged), 'general' (unserviced only),
 * or a department/unit id (department feedback for that id).
 */
module.exports = async function list_feedbacks(req, res) {
  try {
    let { target = 'all', period = 'month', from, to, page = 1, limit = 10 } = req.query || {};
    page = Math.max(1, parseInt(page, 10) || 1);
    limit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));

    const bounds = getPeriodBounds(period, from, to);
    const dateMatch = bounds ? { created_date: { $gte: bounds.start, $lte: bounds.end } } : {};

    let items = [];
    if (target === 'general') {
      const rows = await UnservicedFeedback.find(dateMatch).sort({ created_date: -1 }).lean();
      items = rows.map((r) => ({ ...r, source: 'general', department_name: 'General' }));
    } else if (target === 'all') {
      const [deptRows, generalRows] = await Promise.all([
        Feedback.find(dateMatch).sort({ created_date: -1 }).lean(),
        UnservicedFeedback.find(dateMatch).sort({ created_date: -1 }).lean(),
      ]);
      items = [
        ...deptRows.map((r) => ({ ...r, source: 'department' })),
        ...generalRows.map((r) => ({ ...r, source: 'general', department_name: 'General' })),
      ].sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
    } else {
      const rows = await Feedback.find({ ...dateMatch, department_id: target }).sort({ created_date: -1 }).lean();
      items = rows.map((r) => ({ ...r, source: 'department' }));
    }

    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const data = items.slice((page - 1) * limit, (page - 1) * limit + limit);

    return res.status(200).json({
      success: true,
      type: 'success',
      message: 'Feedback list retrieved successfully',
      data,
      page,
      limit,
      total,
      totalPages,
      period,
      bounds: bounds ? { start: bounds.start.toISOString(), end: bounds.end.toISOString() } : null,
    });
  } catch (error) {
    console.error('Error in list_feedbacks:', error);
    return res.status(500).json({
      success: false,
      type: 'error',
      message: 'Something went wrong while fetching feedbacks',
      error: error.message,
    });
  }
};
