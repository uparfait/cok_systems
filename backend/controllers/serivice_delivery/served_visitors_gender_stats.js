const ServiceDelivery = require("../../models/service_delivery.js");

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
  if (period === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
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

const getDayName = (date) => {
  return date.toLocaleDateString('en-US', { weekday: 'long' });
};

const getMonthName = (date) => {
  return date.toLocaleDateString('en-US', { month: 'long' });
};

const getHourLabel = (hour) => {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:00 ${suffix}`;
};

const generateTimeSlots = (period, bounds) => {
  const slots = [];
  if (!bounds) return slots;

  if (period === 'today') {
    for (let hour = 8; hour <= 18; hour++) {
      slots.push(getHourLabel(hour));
    }
  } else if (period === 'week') {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const current = new Date(bounds.start);
    while (current <= bounds.end) {
      slots.push(days[current.getDay() === 0 ? 6 : current.getDay() - 1]);
      current.setDate(current.getDate() + 1);
    }
  } else if (period === 'month' || period === 'last_month') {
    const current = new Date(bounds.start);
    while (current <= bounds.end) {
      slots.push(getMonthName(current) + ' ' + current.getDate());
      current.setDate(current.getDate() + 1);
    }
  } else if (period === 'year') {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    for (let m = 0; m < 12; m++) {
      slots.push(months[m]);
    }
  } else if (period === 'range') {
    const diffDays = Math.ceil((bounds.end - bounds.start) / (1000 * 60 * 60 * 24));
    if (diffDays <= 1) {
      for (let hour = 8; hour <= 18; hour++) {
        slots.push(getHourLabel(hour));
      }
    } else if (diffDays <= 31) {
      const current = new Date(bounds.start);
      while (current <= bounds.end) {
        slots.push(getMonthName(current) + ' ' + current.getDate());
        current.setDate(current.getDate() + 1);
      }
    } else if (diffDays <= 365) {
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      for (let m = 0; m < 12; m++) {
        slots.push(months[m]);
      }
    } else {
      const currentYear = bounds.start.getFullYear();
      const endYear = bounds.end.getFullYear();
      for (let y = currentYear; y <= endYear; y++) {
        slots.push(String(y));
      }
    }
  }
  return slots;
};

const { getDepartmentIdsForHead } = require('../department_flow/visitors_by_status.js');

module.exports = async function served_visitors_gender_stats(req, res, next) {
  try {
    let { period = 'month', from, to } = req.query || {};
    const bounds = getPeriodBounds(period, from, to);

    const userId = String(req.user?.id || req.user?._id || '');
    const roleName = req.user?.role_name || req.user?.role || '';

    let match;
    const roleLower = String(roleName).toLowerCase();
    const isHodRole = ['head of department', 'department manager', 'department head', 'director'].some((k) => roleLower.includes(k));
    if (isHodRole) {
      // HODs see everyone served in the department(s) they lead, not just themselves
      const departmentIds = await getDepartmentIdsForHead(req.user?.userId || userId);
      if (!departmentIds.length) {
        return res.status(403).json({ success: false, message: 'No department found for this head of department' });
      }
      match = {
        "departments_assigned": {
          $elemMatch: { department_id: { $in: departmentIds } },
        },
      };
    } else {
      match = {
        "departments_assigned": {
          $elemMatch: { provider_id: userId },
        },
      };
    }

    if (bounds) {
      match.entry_date = { $gte: bounds.start, $lte: bounds.end };
    }

    const visitors = await ServiceDelivery.find(match).lean();

    const stats = {};

    visitors.forEach((v) => {
      const entryDate = v.entry_date ? new Date(v.entry_date) : null;
      if (!entryDate || isNaN(entryDate.getTime())) return;

      let label;
      if (period === 'today') {
        const hour = entryDate.getHours();
        if (hour < 8 || hour > 18) return;
        label = getHourLabel(hour);
      } else if (period === 'week') {
        label = getDayName(entryDate);
      } else if (period === 'month' || period === 'last_month') {
        label = getMonthName(entryDate) + ' ' + entryDate.getDate();
      } else if (period === 'year') {
        label = getMonthName(entryDate);
      } else if (period === 'range') {
        const diffDays = bounds ? Math.ceil((bounds.end - bounds.start) / (1000 * 60 * 60 * 24)) : 0;
        if (diffDays <= 1) {
          const hour = entryDate.getHours();
          if (hour < 8 || hour > 18) return;
          label = getHourLabel(hour);
        } else if (diffDays <= 31) {
          label = getMonthName(entryDate) + ' ' + entryDate.getDate();
        } else if (diffDays <= 365) {
          label = getMonthName(entryDate);
        } else {
          label = String(entryDate.getFullYear());
        }
      } else {
        label = entryDate.toLocaleDateString();
      }

      if (!label) return;

      if (!stats[label]) stats[label] = { male: 0, female: 0, other: 0 };

      const gender = (v.gender || '').toLowerCase();
      if (gender === 'male' || gender === 'm') {
        stats[label].male += 1;
      } else if (gender === 'female' || gender === 'f') {
        stats[label].female += 1;
      } else {
        stats[label].other += 1;
      }
    });

    const timeSlots = generateTimeSlots(period, bounds);

    const data = timeSlots.map((label) => ({
      label,
      Male: stats[label] ? stats[label].male : 0,
      Female: stats[label] ? stats[label].female : 0,
      Other: stats[label] ? stats[label].other : 0,
    }));

    return res.status(200).json({
      success: true,
      type: "success",
      message: "Served visitors gender stats fetched successfully",
      data,
      period,
      bounds: bounds ? { start: bounds.start.toISOString(), end: bounds.end.toISOString() } : null,
    });

  } catch (error) {
    console.error("Error in served_visitors_gender_stats:", error);
    return res.status(500).json({
      success: false,
      type: "error",
      message: "Something went wrong while fetching served visitors gender stats",
      error: error.message,
    });
  }
};