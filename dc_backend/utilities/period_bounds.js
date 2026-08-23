/**
 * Resolves the [start, end] window for a named period, the same shape as
 * backend/controllers/serivice_delivery/assigned_visitors_gender_stats.js's
 * own getPeriodBounds - "today"/"this_month"/"this_year" are fixed, "custom"
 * takes an explicit from/to (defaulting its end to now when to is omitted),
 * and "all" (used by the submissions table, not the stats chart) means no
 * bound at all. Shared by the submissions-stats chart and the submissions
 * list endpoint so "today"/"this month"/etc. mean exactly the same window
 * in both places.
 */
function resolve_period_bounds(period, from, to) {
  if (period === "all") return null;

  const now = new Date();
  const start_of_day = (date) => {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  };
  const end_of_day = (date) => {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  };

  if (period === "today") {
    return { start: start_of_day(now), end: end_of_day(now) };
  }
  if (period === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (period === "this_year") {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (period === "custom" && from) {
    const start = start_of_day(new Date(from));
    const end = to ? end_of_day(new Date(to)) : end_of_day(now);
    return { start, end };
  }
  return undefined;
}

module.exports = { resolve_period_bounds };
