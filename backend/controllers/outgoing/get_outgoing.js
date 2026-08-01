const Outgoing = require('../../models/outgoing.js');
const mongoose = require('mongoose');
const Request = require('../../models/request.js');

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

module.exports = async function get_outgoing(req, res) {
  try {
    const { page = 1, limit = 20, q, period, from, to } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    let query = {};

    const bounds = getPeriodBounds(period, from, to);
    if (bounds) {
      query.date_of_recording = { $gte: bounds.start, $lte: bounds.end };
    }

    if (q && typeof q === 'string' && q.trim()) {
      const regex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const parentMatch = {
        $or: [
          { reference_number: regex },
          { 'sender.name': regex },
          { 'sender.email': regex },
          { subject: regex }
        ]
      };
      const parentRequests = await Request.find(parentMatch).select('_id').lean();
      const parentIds = parentRequests.map(r => r._id);
      
      query.$or = [
        { 'reference_number': regex },
        { 'department_number': regex },
        { 'destination': regex },
        { 'subject': regex },
        { 'sign_by': regex },
        
        { 'request_id': { $in: parentIds } }
      ];
    }

    const total = await Outgoing.countDocuments(query);
    const data = await Outgoing.find(query)
      .sort({ date_of_recording: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    if (q && q.trim()) {
      const parentIds = data.map(d => d.request_id).filter(Boolean);
      const parentRequests = await Request.find({ _id: { $in: parentIds } }).lean();
      const parentMap = new Map(parentRequests.map(r => [r._id.toString(), r]));

      data.forEach(outgoing => {
        const parent = parentMap.get(outgoing.request_id?.toString());
        if (parent) {
          outgoing.parent = parent;
        }
      });
    }

    return res.status(200).json({
      success: true,
      type: 'success',
      message: 'Outgoing correspondences fetched successfully',
      data,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    });

  } catch (error) {
    console.error('Error in get_outgoing:', error);
    return res.status(500).json({
      success: false,
      type: 'error',
      message: 'Something went wrong while fetching outgoing correspondences'
    });
  }
};
