const ServiceDelivery = require("../../models/service_delivery.js");
const { userIdOf, sendError } = require("../../utilities/visitors");

/**
 * Visits by gender over time, for the gender charts (this endpoint and
 * served_visitors_gender_stats.js, which reuses genderSeries). The period
 * gives the x-axis (hours, week days, days, months or years, in server-local
 * time like the period bounds); MongoDB counts the visits of every slot and
 * the gender is the one of the visitor each visit references (visits of the
 * old structure keep their own gender field). Male and Female are counted
 * as such, anything else as "Not specified" (also returned as Other, the key
 * the charts read).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const FIRST_HOUR = 8;
const LAST_HOUR = 18;
const NOT_SPECIFIED = "Not specified";
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MALE_VALUES = ["male", "m"];
const FEMALE_VALUES = ["female", "f"];

const getPeriodBounds = (period, from, to) => {
  const now = new Date();
  const startOfDay = (d) => { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; };
  const endOfDay = (d) => { const r = new Date(d); r.setHours(23, 59, 59, 999); return r; };

  if (period === "today") {
    return { start: startOfDay(now), end: endOfDay(now) };
  }
  if (period === "week") {
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { start: monday, end: sunday };
  }
  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (period === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (period === "year") {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (period === "range" && from) {
    const start = startOfDay(from);
    const end = to ? endOfDay(to) : endOfDay(now);
    return { start, end };
  }
  return null;
};

const isValidDate = (date) => date instanceof Date && !Number.isNaN(date.getTime());

const getHourLabel = (hour) => {
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:00 ${suffix}`;
};

const HOUR_LABELS = Array.from({ length: 24 }, (_, hour) => getHourLabel(hour));

/** Slot size of a period: hour, weekday, day, month or year. */
function slotUnit(period, bounds) {
  if (!bounds) return null;
  if (period === "today") return "hour";
  if (period === "week") return "weekday";
  if (period === "month" || period === "last_month") return "day";
  if (period === "year") return "month";
  if (period === "range") {
    const diffDays = Math.ceil((bounds.end - bounds.start) / DAY_MS);
    if (diffDays <= 1) return "hour";
    if (diffDays <= 31) return "day";
    if (diffDays <= 365) return "month";
    return "year";
  }
  return null;
}

/** The zero-filled x-axis of the chart. */
function timeSlots(unit, bounds) {
  if (unit === "hour") return HOUR_LABELS.slice(FIRST_HOUR, LAST_HOUR + 1);
  if (unit === "month") return [...MONTH_NAMES];
  if (unit === "year") {
    const years = [];
    for (let year = bounds.start.getFullYear(); year <= bounds.end.getFullYear(); year += 1) years.push(String(year));
    return years;
  }
  const slots = [];
  const current = new Date(bounds.start);
  while (current <= bounds.end) {
    slots.push(unit === "weekday"
      ? DAY_NAMES[(current.getDay() + 6) % 7]
      : `${MONTH_NAMES[current.getMonth()]} ${current.getDate()}`);
    current.setDate(current.getDate() + 1);
  }
  return slots;
}

/** The server UTC offset in the form MongoDB date operators take ("+02:00"). */
function serverTimezone(date = new Date()) {
  const minutes = -date.getTimezoneOffset();
  const abs = Math.abs(minutes);
  const pad = (value) => String(value).padStart(2, "0");
  return `${minutes < 0 ? "-" : "+"}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** MongoDB expression giving the slot label of a visit, from its entry_date. */
function slotLabelExpression(unit, timezone) {
  const part = (operator) => ({ [operator]: { date: "$entry_date", timezone } });
  const monthName = { $arrayElemAt: [MONTH_NAMES, { $subtract: [part("$month"), 1] }] };
  if (unit === "hour") return { $arrayElemAt: [HOUR_LABELS, part("$hour")] };
  if (unit === "weekday") return { $arrayElemAt: [DAY_NAMES, { $subtract: [part("$isoDayOfWeek"), 1] }] };
  if (unit === "day") return { $concat: [monthName, " ", { $toString: part("$dayOfMonth") }] };
  if (unit === "month") return monthName;
  return { $toString: part("$year") };
}

const countGender = (values) => ({ $sum: { $cond: [{ $in: ["$gender", values] }, 1, 0] } });

const genderCounts = (groupId) => [
  { $group: { _id: groupId, Male: countGender(MALE_VALUES), Female: countGender(FEMALE_VALUES), total: { $sum: 1 } } },
  { $set: { not_specified: { $subtract: ["$total", { $add: ["$Male", "$Female"] }] } } },
];

const countsOf = (row) => {
  const notSpecified = row ? row.not_specified : 0;
  return { Male: row ? row.Male : 0, Female: row ? row.Female : 0, Other: notSpecified, [NOT_SPECIFIED]: notSpecified };
};

/**
 * Gender counts per time slot of a period.
 * @param {object|null} options.match  the visits to count (null = none)
 * @returns {Promise<{ bounds, data: [{ label, Male, Female, Other, 'Not specified' }], totals }>}
 */
async function genderSeries({ match, period, from, to }) {
  const found = getPeriodBounds(period, from, to);
  const bounds = found && isValidDate(found.start) && isValidDate(found.end) ? found : null;
  const unit = slotUnit(period, bounds);
  const slots = unit ? timeSlots(unit, bounds) : [];

  let result = { series: [], totals: [] };
  if (match && slots.length) {
    [result] = await ServiceDelivery.aggregate([
      { $match: { ...match, entry_date: { $gte: bounds.start, $lte: bounds.end } } },
      {
        $lookup: {
          from: "visitors",
          localField: "visitor",
          foreignField: "_id",
          pipeline: [{ $project: { _id: 0, gender: 1 } }],
          as: "person",
        },
      },
      {
        $project: {
          _id: 0,
          label: slotLabelExpression(unit, serverTimezone()),
          gender: { $toLower: { $ifNull: [{ $arrayElemAt: ["$person.gender", 0] }, { $ifNull: ["$gender", ""] }] } },
        },
      },
      { $match: { label: { $in: slots } } },
      { $facet: { series: genderCounts("$label"), totals: genderCounts(null) } },
    ]);
  }

  const bySlot = new Map(result.series.map((row) => [row._id, row]));
  const totals = result.totals[0] || null;
  return {
    bounds,
    data: slots.map((label) => ({ label, ...countsOf(bySlot.get(label)) })),
    totals: { ...countsOf(totals), total: totals ? totals.total : 0 },
  };
}

const boundsView = (bounds) => (bounds ? { start: bounds.start.toISOString(), end: bounds.end.toISOString() } : null);

/**
 * GET /servicedelivery/assigned-visitors/gender-stats ?period&from&to
 * Visits the caller sent to a department, by gender.
 */
async function assigned_visitors_gender_stats(req, res) {
  try {
    const { period = "month", from, to } = req.query || {};
    const { bounds, data, totals } = await genderSeries({
      match: { "departments_assigned.assigned_by.user_id": userIdOf(req.user) },
      period,
      from,
      to,
    });

    return res.status(200).json({
      success: true,
      type: "success",
      message: "Gender stats fetched successfully",
      data,
      totals,
      period,
      bounds: boundsView(bounds),
    });
  } catch (error) {
    return sendError(res, error, "Something went wrong while fetching gender stats");
  }
}

module.exports = assigned_visitors_gender_stats;
module.exports.genderSeries = genderSeries;
module.exports.boundsView = boundsView;
