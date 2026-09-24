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
  if (period === "this_week") {
    // Monday 00:00 → Sunday 23:59:59.999 (ISO week, Monday-first)
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { start: monday, end: sunday };
  }
  if (period === "this_month") {
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
  if (period === "this_year") {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (period === "custom" && from) {
    // A pick that carries a time ("2026-09-24T14:30") is used to the
    // minute; a bare date still means the whole day.
    const has_time = (text) => /T\d{2}:\d{2}/.test(String(text));
    // The pickers give minutes, so a "to" with a time means up to the END
    // of that minute - a range from 10:00 to 10:00 covers the minute.
    const end_of_minute = (date) => {
      const result = new Date(date);
      result.setSeconds(59, 999);
      return result;
    };
    const from_date = new Date(from);
    if (Number.isNaN(from_date.getTime())) return undefined;
    let start = has_time(from) ? from_date : start_of_day(from_date);
    let end;
    if (to) {
      const to_date = new Date(to);
      if (Number.isNaN(to_date.getTime())) return undefined;
      // The same moment picked twice means that whole day, not an empty window.
      if (to_date.getTime() === from_date.getTime()) {
        return { start: start_of_day(from_date), end: end_of_day(from_date) };
      }
      end = has_time(to) ? end_of_minute(to_date) : end_of_day(to_date);
      // A reversed pick (from after to) still means the same window - swap
      // instead of returning an empty range that reads as "no data".
      if (end < start) {
        const swapped_start = has_time(to) ? to_date : start_of_day(to_date);
        end = has_time(from) ? end_of_minute(from_date) : end_of_day(from_date);
        start = swapped_start;
      }
    } else {
      end = end_of_day(now);
      if (end < start) end = end_of_day(from_date);
    }
    return { start, end };
  }
  return undefined;
}

module.exports = { resolve_period_bounds };
