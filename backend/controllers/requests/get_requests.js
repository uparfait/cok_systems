const Request = require('../../models/request.js');
const mongoose = require('mongoose');

const parseRange = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

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

module.exports = async function get_requests(req, res) {
  try {
    const { status, period, from, to, page = 1, limit = 20, q } = req.query;
    const periodStr = period || 'all';
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(20, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    let query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    const bounds = getPeriodBounds(periodStr, from, to);
    if (bounds) {
      query.created_at = { $gte: bounds.start, $lte: bounds.end };
    }

    if (q && typeof q === 'string' && q.trim()) {
      const regex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { 'sender.name': regex },
        { 'sender.email': regex },
        { 'subject': regex },
        { 'reference_number': regex },
        { 'recipient': regex },
        { 'orientation': regex },
        { 'remarks': regex },
      ];
    }

    const total = await Request.countDocuments(query);
    const data = await Request.find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    return res.status(200).json({
      success: true,
      type: 'success',
      message: 'Requests fetched successfully',
      data,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    });

  } catch (error) {
    console.error('Error in get_requests:', error);
    return res.status(500).json({
      success: false,
      type: 'error',
      message: 'Something went wrong while fetching requests'
    });
  }
};
