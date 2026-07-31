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

    // Per-orientation and per-assignee status breakdowns for the mayor dashboard.
    // Archived requests are excluded; anything not completed and older than 24h
    // counts as overdue.
    const DAY_MS = 24 * 60 * 60 * 1000;
    const docs = await Request.find({ ...match, status: { $ne: 'Archived' } })
      .select('status orientation assigned_by.name created_at')
      .lean();

    const emptyCounts = () => ({ pending: 0, inprogress: 0, completed: 0, overdue: 0, total: 0 });
    const orientationMap = {};
    const assigneeMap = {};
    for (const r of docs) {
      const ageMs = r.created_at ? Date.now() - new Date(r.created_at).getTime() : 0;
      const bucket =
        r.status === 'Completed' ? 'completed'
        : ageMs > DAY_MS ? 'overdue'
        : r.status === 'Inprogress' ? 'inprogress'
        : 'pending';
      const orientation = (r.orientation || '').trim() || 'Unspecified';
      const assignee = (r.assigned_by?.name || '').trim() || 'Unassigned';
      if (!orientationMap[orientation]) orientationMap[orientation] = emptyCounts();
      orientationMap[orientation][bucket] += 1;
      orientationMap[orientation].total += 1;
      if (!assigneeMap[assignee]) assigneeMap[assignee] = emptyCounts();
      assigneeMap[assignee][bucket] += 1;
      assigneeMap[assignee].total += 1;
    }
    const toRows = (m) => Object.entries(m)
      .map(([name, counts]) => ({ name, ...counts }))
      .sort((a, b) => b.total - a.total);

    result.by_orientation = toRows(orientationMap);
    result.by_assignee = toRows(assigneeMap);

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
