const Router = require('express').Router();
const Audit = require('../../models/audit');

/**
 * System audit API. Rows are written only by the response-audit middleware
 * of each backend (every response that is not a 200/201), so this router
 * only reads, exports and cleans up. Mounted behind authenticate +
 * authorize(ADMIN_AUDIT) in routes/routes.js.
 */

// Documents written by the previous audit design (action/resource/
// status_code fields, success rows included) - offered for a one-time
// clean-up from the audit page.
const LEGACY_FILTER = { $or: [{ action: { $exists: true } }, { status: { $exists: false } }] };

const SEARCH_FIELDS = ['user_email', 'user_name', 'endpoint', 'description', 'message', 'error', 'ip_address'];

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function dayEnd(value) {
  const end = new Date(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Builds the Mongo filter shared by the list and the export: exact status,
 * method, source, free-text search over the row's text fields, date range.
 */
function buildFilter(query) {
  const { status, method, source, search, start_date, end_date } = query;
  const filter = {};
  if (status !== undefined && status !== '') {
    const code = parseInt(status, 10);
    if (!Number.isNaN(code)) filter.status = code;
  }
  if (method) filter.method = String(method).toUpperCase();
  if (source) filter.source = String(source);
  if (search && String(search).trim()) {
    const regex = new RegExp(escapeRegex(String(search).trim()), 'i');
    filter.$or = SEARCH_FIELDS.map((field) => ({ [field]: regex }));
  }
  if (start_date || end_date) {
    filter.time = {};
    if (start_date) filter.time.$gte = new Date(start_date);
    if (end_date) filter.time.$lte = dayEnd(end_date);
  }
  return filter;
}

Router.get('/logs', async (req, res) => {
  try {
    const { page = 1, limit = 20, sort = '-time' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;
    const filter = buildFilter(req.query);

    const [total, audits] = await Promise.all([
      Audit.countDocuments(filter),
      Audit.find(filter).sort(sort).skip(skip).limit(limitNum).lean(),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Audit logs retrieved successfully',
      data: audits,
      pagination: {
        current_page: pageNum,
        per_page: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum),
        has_next: pageNum * limitNum < total,
        has_prev: pageNum > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve audit logs', error: error.message });
  }
});

// Every status code that actually occurs in the stored rows, with counts -
// the page's status filter lists exactly these.
Router.get('/statuses', async (req, res) => {
  try {
    const rows = await Audit.aggregate([
      { $match: { status: { $exists: true } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    return res.status(200).json({
      success: true,
      message: 'Audit statuses retrieved successfully',
      data: rows.map((row) => ({ status: row._id, count: row.count })),
    });
  } catch (error) {
    console.error('Error fetching audit statuses:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve audit statuses', error: error.message });
  }
});

Router.get('/export', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
      return res.status(400).json({ success: false, message: 'Both start_date and end_date are required for export' });
    }
    const start = new Date(start_date);
    const end = dayEnd(end_date);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date range provided' });
    }
    if (end < start) {
      return res.status(400).json({ success: false, message: 'End date must be after the start date' });
    }

    const filter = buildFilter(req.query);
    filter.time = { $gte: start, $lte: end };
    const audits = await Audit.find(filter).sort('-time').limit(50000).lean();
    if (!audits.length) {
      return res.status(404).json({ success: false, message: 'No audit logs found in the selected date range' });
    }

    const esc = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = ['Time', 'Status', 'Method', 'User Email', 'Description', 'Message', 'Error', 'Endpoint', 'IP Address', 'Source'];
    const lines = [header.map(esc).join(',')];
    for (const row of audits) {
      lines.push([
        row.time ? new Date(row.time).toISOString().replace('T', ' ').slice(0, 19) : '',
        row.status ?? '',
        row.method || '',
        row.user_email || '',
        row.description || '',
        row.message || '',
        row.error || '',
        row.endpoint || '',
        row.ip_address || '',
        row.source || '',
      ].map(esc).join(','));
    }
    const csv = '﻿' + lines.join('\r\n');
    const fileName = `audit_logs_${String(start_date).slice(0, 10)}_to_${String(end_date).slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.status(200).send(csv);
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    return res.status(500).json({ success: false, message: 'Failed to export audit logs', error: error.message });
  }
});

Router.get('/stats', async (req, res) => {
  try {
    const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const match = { time: { $gte: startDate }, status: { $exists: true } };

    const [totalLogs, statusStats, userStats, recentServerErrors] = await Promise.all([
      Audit.countDocuments(match),
      Audit.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Audit.aggregate([
        { $match: Object.assign({}, match, { user_email: { $nin: [null, ''] } }) },
        { $group: { _id: '$user_email', user_name: { $last: '$user_name' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      Audit.find(Object.assign({}, match, { status: { $gte: 500 } })).sort({ time: -1 }).limit(5).lean(),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Audit statistics retrieved successfully',
      data: {
        period_days: days,
        total_logs: totalLogs,
        status_breakdown: statusStats.map((row) => ({ status: row._id, count: row.count })),
        top_users: userStats.map((row) => ({ user_email: row._id, user_name: row.user_name, count: row.count })),
        recent_server_errors: recentServerErrors,
      },
    });
  } catch (error) {
    console.error('Error fetching audit stats:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve audit statistics', error: error.message });
  }
});

// How many rows still follow the previous audit structure (the page only
// shows its clean-up button when this is above zero).
Router.get('/legacy', async (req, res) => {
  try {
    const count = await Audit.collection.countDocuments(LEGACY_FILTER);
    return res.status(200).json({ success: true, message: 'Legacy audit rows counted', data: { legacy_count: count } });
  } catch (error) {
    console.error('Error counting legacy audit rows:', error);
    return res.status(500).json({ success: false, message: 'Failed to count legacy audit rows', error: error.message });
  }
});

Router.delete('/legacy', async (req, res) => {
  try {
    const result = await Audit.collection.deleteMany(LEGACY_FILTER);
    return res.status(200).json({
      success: true,
      message: `Removed ${result.deletedCount} old-format audit rows`,
      data: { deleted_count: result.deletedCount },
    });
  } catch (error) {
    console.error('Error deleting legacy audit rows:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete legacy audit rows', error: error.message });
  }
});

Router.delete('/logs/:id', async (req, res) => {
  try {
    const auditLog = await Audit.findById(req.params.id);
    if (!auditLog) {
      return res.status(404).json({ success: false, message: 'Audit log not found' });
    }
    await Audit.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true, message: 'Audit log deleted successfully' });
  } catch (error) {
    console.error('Error deleting audit log:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete audit log', error: error.message });
  }
});

module.exports = Router;
