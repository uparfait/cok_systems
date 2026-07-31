const Request = require('../../models/request.js');

const getPeriodBounds = (period, from, to) => {
  const now = new Date();
  const startOfDay = (d) => { const r = new Date(d); r.setHours(0,0,0,0); return r; };
  const endOfDay = (d) => { const r = new Date(d); r.setHours(23,59,59,999); return r; };

  if (period === 'today') {
    return { start: startOfDay(now), end: endOfDay(now) };
  }
  if (period === 'week') {
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    monday.setHours(0,0,0,0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23,59,59,999);
    return { start: monday, end: sunday };
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    end.setHours(23,59,59,999);
    return { start, end };
  }
  if (period === 'year') {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    end.setHours(23,59,59,999);
    return { start, end };
  }
  if (period === 'range' && from) {
    const start = startOfDay(from);
    const end = to ? endOfDay(to) : endOfDay(now);
    return { start, end };
  }
  return null;
};

module.exports = async function get_statistics(req, res) {
  try {
    const { period, from, to } = req.query;
    const bounds = getPeriodBounds(period || 'all', from, to);

    let match = {};
    if (bounds) {
      match.created_at = { $gte: bounds.start, $lte: bounds.end };
    }

    const stats = await Request.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const result = {
      Pending: 0,
      Inprogress: 0,
      Completed: 0,
      Archived: 0,
      Overdue: 0,
      total: 0
    };

    stats.forEach(s => {
      if (result.hasOwnProperty(s._id)) {
        result[s._id] = s.count;
      }
      result.total += s.count;
    });

    return res.status(200).json({
      success: true,
      type: 'success',
      message: 'Statistics fetched successfully',
      data: result
    });

  } catch (error) {
    console.error('Error in get_statistics:', error);
    return res.status(500).json({
      success: false,
      type: 'error',
      message: 'Something went wrong while fetching statistics'
    });
  }
};
