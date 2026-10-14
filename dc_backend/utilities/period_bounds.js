const { zone_of, zoned_to_utc, has_offset, start_of_day_in, end_of_day_in, add_days_in, start_of_month_in, start_of_year_in, wall_clock } = require("./time_zone.js");

/**
 * Resolves the [start, end] window for a named period, the same shape as
 * backend/controllers/serivice_delivery/assigned_visitors_gender_stats.js's
 * own getPeriodBounds - "today"/"this_month"/"this_year" are fixed, "custom"
 * takes an explicit from/to (defaulting its end to now when to is omitted),
 * and "all" (used by the submissions table, not the stats chart) means no
 * bound at all. Shared by every reader so "today"/"this month"/etc. mean
 * exactly the same window everywhere.
 *
 * tz (optional) is the VIEWER'S IANA zone ("Africa/Kigali"): presets are
 * that viewer's day, week, month and year, and a custom pick without a
 * zone ("2026-10-14T16:46:11") is read as that viewer's wall clock. A
 * pick carrying an offset or Z stays absolute. Without a valid tz the
 * server's own zone is used, exactly as before.
 */
function resolve_period_bounds(period, from, to, tz) {
  const zone = zone_of(tz);
  return zone ? resolve_in_zone(period, from, to, zone) : resolve_in_server_zone(period, from, to);
}

// A pick that carries a time ("2026-09-24T14:30" or "2026-09-24T14:30:15")
// is used to the minute or to the second; a bare date still means the
// whole day.
const has_time = (text) => /T\d{2}:\d{2}/.test(String(text));
const has_seconds = (text) => /T\d{2}:\d{2}:\d{2}/.test(String(text));

// A "to" with a time means up to the END of what was picked: the end of
// that second when seconds were given, else the end of that minute - a
// range from 10:00 to 10:00 covers the minute.
const end_of_minute = (date, text) => {
  const result = new Date(date);
  if (has_seconds(text)) result.setMilliseconds(999);
  else result.setSeconds(59, 999);
  return result;
};

/** The custom window, given how a day starts and ends and how a pick is read. */
function custom_bounds(from, to, now, read, start_of_day, end_of_day) {
  const from_date = read(from);
  if (Number.isNaN(from_date.getTime())) return undefined;
  let start = has_time(from) ? from_date : start_of_day(from_date);
  let end;
  if (to) {
    const to_date = read(to);
    if (Number.isNaN(to_date.getTime())) return undefined;
    // The same moment picked twice means that whole day, not an empty window.
    if (to_date.getTime() === from_date.getTime()) {
      return { start: start_of_day(from_date), end: end_of_day(from_date) };
    }
    end = has_time(to) ? end_of_minute(to_date, to) : end_of_day(to_date);
    // A reversed pick (from after to) still means the same window - swap
    // instead of returning an empty range that reads as "no data".
    if (end < start) {
      const swapped_start = has_time(to) ? to_date : start_of_day(to_date);
      end = has_time(from) ? end_of_minute(from_date, from) : end_of_day(from_date);
      start = swapped_start;
    }
  } else {
    end = end_of_day(now);
    if (end < start) end = end_of_day(from_date);
  }
  return { start, end };
}

/** The windows in the SERVER's zone - the reading every caller without a tz has always had. */
function resolve_in_server_zone(period, from, to) {
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
    // Monday 00:00 -> Sunday 23:59:59.999 (ISO week, Monday-first)
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
    return custom_bounds(from, to, now, (text) => new Date(text), start_of_day, end_of_day);
  }
  return undefined;
}

/** The same windows in the VIEWER's zone. */
function resolve_in_zone(period, from, to, zone) {
  if (period === "all") return null;

  const now = new Date();
  const start_of_day = (date) => start_of_day_in(zone, date);
  const end_of_day = (date) => end_of_day_in(zone, date);
  // A zoneless pick is the viewer's wall clock; one with an offset or Z is absolute.
  const read = (text) => (has_offset(text) ? new Date(String(text).trim()) : zoned_to_utc(text, zone));

  if (period === "today") {
    return { start: start_of_day(now), end: end_of_day(now) };
  }
  if (period === "this_week") {
    // Monday 00:00 -> Sunday 23:59:59.999 of the viewer's week.
    const today = start_of_day(now);
    const monday = add_days_in(zone, today, -((wall_clock(zone, today).weekday + 6) % 7));
    return { start: monday, end: end_of_day(add_days_in(zone, monday, 6)) };
  }
  if (period === "this_month") {
    const start = start_of_month_in(zone, now, 0);
    return { start, end: new Date(start_of_month_in(zone, now, 1).getTime() - 1) };
  }
  if (period === "last_month") {
    const start = start_of_month_in(zone, now, -1);
    return { start, end: new Date(start_of_month_in(zone, now, 0).getTime() - 1) };
  }
  if (period === "this_year") {
    const start = start_of_year_in(zone, now, 0);
    return { start, end: new Date(start_of_year_in(zone, now, 1).getTime() - 1) };
  }
  if (period === "custom" && from) {
    return custom_bounds(from, to, now, read, start_of_day, end_of_day);
  }
  return undefined;
}

module.exports = { resolve_period_bounds };
