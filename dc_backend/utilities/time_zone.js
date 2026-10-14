/**
 * The viewer's time zone, with Intl alone (no dependency).
 *
 * A browser in Kigali sends wall-clock picks like "2026-10-14T16:46:11"
 * with no zone, and presets like "today" mean the viewer's day, not the
 * server's. Every request may carry the viewer's IANA zone (body.tz or
 * ?tz=, e.g. "Africa/Kigali"); a missing or unknown zone falls back to
 * the server's own, which keeps every reading exactly as it was.
 *
 * Mongo takes the same zone name in $dateTrunc / $dateToString, so the
 * database buckets days and hours on the viewer's day boundaries too.
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const formatters = new Map();

function is_valid_zone(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value.trim() });
    return true;
  } catch (error) {
    return false;
  }
}

/** The zone a value names, or null. */
function zone_of(value) {
  return is_valid_zone(value) ? value.trim() : null;
}

/** The viewer's zone as a request carries it: body.tz, else ?tz=; null when absent or unknown. */
function viewer_zone(req) {
  const body = (req && req.body) || {};
  const query = (req && req.query) || {};
  return zone_of(body.tz) || zone_of(query.tz);
}

/** The zone the server itself runs in. */
function server_zone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** The viewer's zone when given, the server's otherwise. */
function zone_or_server(value) {
  return zone_of(value) || server_zone();
}

function formatter(zone) {
  if (!formatters.has(zone)) {
    formatters.set(
      zone,
      new Intl.DateTimeFormat("en-US", {
        timeZone: zone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        weekday: "short",
      }),
    );
  }
  return formatters.get(zone);
}

/** The wall clock of an instant in a zone: { year, month (1-12), day, hour, minute, second, weekday (0 = Sunday) }. */
function wall_clock(zone, date) {
  const parts = {};
  formatter(zone)
    .formatToParts(date)
    .forEach((part) => {
      if (part.type !== "literal") parts[part.type] = part.value;
    });
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAYS.indexOf(parts.weekday),
  };
}

/** How far the zone's wall clock stands from UTC at an instant, in ms. */
function zone_offset_ms(zone, date) {
  const wall = wall_clock(zone, date);
  const as_utc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  return as_utc - (date.getTime() - date.getUTCMilliseconds());
}

/**
 * The instant a wall clock names in a zone. Day and month may overflow
 * (day 32, month 13), exactly as Date.UTC lets them, which is what the
 * "next day" and "next month" steps below rely on.
 */
function wall_to_utc(zone, wall) {
  const guess = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour || 0, wall.minute || 0, wall.second || 0, wall.ms || 0);
  const first = guess - zone_offset_ms(zone, new Date(guess));
  // Around a zone transition the offset at the guess and at the answer can
  // differ; the second pass settles it.
  const second = guess - zone_offset_ms(zone, new Date(first));
  return new Date(second);
}

/** Whether a date string already says its zone ("...Z" or "...+02:00"). */
function has_offset(text) {
  return /(Z|[+-]\d{2}:?\d{2})$/i.test(String(text).trim());
}

/** "2026-10-14", "2026-10-14T16:46", "2026-10-14T16:46:11", "2026-10-14T16:46:11.250" -> wall-clock parts, or null. */
function parse_wall_clock(text) {
  const match = String(text)
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: match[4] === undefined ? 0 : Number(match[4]),
    minute: match[5] === undefined ? 0 : Number(match[5]),
    second: match[6] === undefined ? 0 : Number(match[6]),
    ms: match[7] === undefined ? 0 : Number(match[7].padEnd(3, "0")),
  };
}

/**
 * A date string as an instant: a wall clock without a zone is read in the
 * given zone; a string carrying an offset or Z is absolute; anything else
 * is left to Date itself. Invalid input gives an invalid Date.
 */
function zoned_to_utc(text, zone) {
  if (text === undefined || text === null) return new Date(NaN);
  const value = String(text).trim();
  if (has_offset(value)) return new Date(value);
  const wall = parse_wall_clock(value);
  if (!wall) return new Date(value);
  return wall_to_utc(zone, wall);
}

function start_of_day_in(zone, date) {
  const wall = wall_clock(zone, date);
  return wall_to_utc(zone, { year: wall.year, month: wall.month, day: wall.day });
}

function end_of_day_in(zone, date) {
  const wall = wall_clock(zone, date);
  return wall_to_utc(zone, { year: wall.year, month: wall.month, day: wall.day, hour: 23, minute: 59, second: 59, ms: 999 });
}

/** The same wall-clock time `days` days later (or earlier) in the zone. */
function add_days_in(zone, date, days) {
  const wall = wall_clock(zone, date);
  return wall_to_utc(zone, Object.assign({}, wall, { day: wall.day + days, ms: date.getUTCMilliseconds() }));
}

function start_of_month_in(zone, date, months_ahead) {
  const wall = wall_clock(zone, date);
  return wall_to_utc(zone, { year: wall.year, month: wall.month + (months_ahead || 0), day: 1 });
}

function start_of_year_in(zone, date, years_ahead) {
  const wall = wall_clock(zone, date);
  return wall_to_utc(zone, { year: wall.year + (years_ahead || 0), month: 1, day: 1 });
}

/** The instant with minutes, seconds and ms cleared, in the zone. */
function start_of_hour_in(zone, date) {
  const wall = wall_clock(zone, date);
  return wall_to_utc(zone, { year: wall.year, month: wall.month, day: wall.day, hour: wall.hour });
}

/** "Oct 14", "Oct 2026": the usual short labels, in the zone. */
function format_in(zone, date, options) {
  return date.toLocaleDateString("en-US", Object.assign({ timeZone: zone }, options));
}

/** "YYYY-MM" and "YYYY" keys of an instant in the zone, as $dateToString writes them with that timezone. */
function month_key_in(zone, date) {
  const wall = wall_clock(zone, date);
  return `${wall.year}-${String(wall.month).padStart(2, "0")}`;
}

function year_key_in(zone, date) {
  return String(wall_clock(zone, date).year);
}

module.exports = {
  is_valid_zone,
  zone_of,
  viewer_zone,
  server_zone,
  zone_or_server,
  wall_clock,
  wall_to_utc,
  has_offset,
  parse_wall_clock,
  zoned_to_utc,
  start_of_day_in,
  end_of_day_in,
  add_days_in,
  start_of_month_in,
  start_of_year_in,
  start_of_hour_in,
  format_in,
  month_key_in,
  year_key_in,
};
