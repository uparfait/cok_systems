const submissions_model = require("../../models/submissions_model.js");
const forms_model = require("../../models/forms_model.js");
const project_access = require("../../utilities/project_access.js");
const { resolve_period_bounds } = require("../../utilities/period_bounds.js");
const { viewer_zone, zone_or_server, wall_clock, start_of_hour_in, start_of_day_in, add_days_in, start_of_month_in, start_of_year_in, format_in, year_key_in } = require("../../utilities/time_zone.js");
const { is_enabled: is_tracking_enabled } = require("../../utilities/tracking.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

const WEEK_START_DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Same dynamic idea as the reference file's generateTimeSlots() "range"
 * branch (hour/day/month/year by how wide the span is), extended with a
 * "week" tier between day and month so a many-months custom range doesn't
 * jump straight from one point per day to one point per month.
 */
function resolve_granularity(period, bounds) {
  if (period === "today") return "hour";
  if (period === "this_month") return "day";
  if (period === "this_year") return "month";

  const span_days = Math.max(1, Math.ceil((bounds.end - bounds.start) / DAY_MS));
  if (span_days <= 1) return "hour";
  if (span_days <= 31) return "day";
  if (span_days <= 180) return "week";
  if (span_days <= 730) return "month";
  return "year";
}

/**
 * The start of the bucket an instant falls in, in the viewer's zone (see
 * utilities/time_zone.js) - the same boundaries $dateTrunc used with that
 * zone, so a bucket the database returned always finds its column.
 */
function truncate_to_bucket_start(date, granularity, week_anchor, zone) {
  if (granularity === "hour") return start_of_hour_in(zone, date);
  if (granularity === "day") return start_of_day_in(zone, date);
  if (granularity === "week") {
    // Weekly buckets are anchored on the RANGE'S OWN first day, not ISO
    // Mondays - a custom "Aug 1 - Sep 15" must chart as Aug 1, Aug 8, ...,
    // never as a "Jul 27" week that starts before what was picked.
    const day_start = start_of_day_in(zone, date);
    const offset_days = Math.round((day_start - week_anchor) / DAY_MS);
    return add_days_in(zone, week_anchor, Math.floor(offset_days / 7) * 7);
  }
  if (granularity === "month") return start_of_month_in(zone, date, 0);
  return start_of_year_in(zone, date, 0);
}

function advance_bucket(date, granularity, zone) {
  if (granularity === "hour") return new Date(date.getTime() + 60 * 60 * 1000);
  if (granularity === "day") return add_days_in(zone, date, 1);
  if (granularity === "week") return add_days_in(zone, date, 7);
  if (granularity === "month") return start_of_month_in(zone, date, 1);
  return start_of_year_in(zone, date, 1);
}

function format_bucket_label(date, granularity, zone) {
  if (granularity === "hour") {
    const hour = wall_clock(zone, date).hour;
    const suffix = hour >= 12 ? "PM" : "AM";
    const display_hour = hour % 12 || 12;
    return `${display_hour}:00 ${suffix}`;
  }
  if (granularity === "day" || granularity === "week") {
    return format_in(zone, date, { month: "short", day: "numeric" });
  }
  if (granularity === "month") {
    return format_in(zone, date, { month: "short", year: "numeric" });
  }
  return year_key_in(zone, date);
}

/**
 * Submissions collected for one form, bucketed into a time series whose
 * granularity (hour/day/week/month/year) is chosen from the selected
 * period exactly like the reference gender-stats controller does for its
 * own "range" period - every bucket between the bounds is included even
 * when empty, so the chart's x-axis is continuous rather than skipping
 * gaps, and the total is the true count within the window (not just the
 * sum of plotted points, though they're the same number). Days and hours
 * are the viewer's (?tz=), the server's when none is given.
 */
async function get_form_submission_stats(req, res) {
  try {
    const { form_group_id } = req.params;
    const { period = "this_month", from, to } = req.query || {};

    if (!form_group_id) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }

    const access = await project_access.can_view_form_group(req.user, form_group_id);
    if (access.found && !access.allowed) {
      return res.status(403).json(warning_response(req, "ACCESS_DENIED"));
    }

    const zone = zone_or_server(viewer_zone(req));
    const bounds = resolve_period_bounds(period, from, to, zone);
    if (!bounds) {
      return res.status(400).json(warning_response(req, "VALIDATION_FAILED"));
    }

    const granularity = resolve_granularity(period, bounds);
    const week_anchor = start_of_day_in(zone, bounds.start);

    // Counted over the same records the table lists, read the over-time
    // way (one row per stage moment on a tracked form).
    const active_version = await forms_model.get_active_version(form_group_id);
    const tracking = active_version && is_tracking_enabled(active_version.tracking) ? active_version.tracking : null;

    // Counted in the database, one row per bucket - a year of records is
    // a dozen numbers coming back, not a dozen numbers computed from
    // every timestamp the year holds.
    const { buckets, total } = await submissions_model.count_submissions_over_time(
      form_group_id,
      bounds.start,
      bounds.end,
      granularity,
      zone,
      WEEK_START_DAYS[wall_clock(zone, week_anchor).weekday],
      tracking,
    );

    // Re-keyed against the same bucket starts the axis below walks, so a
    // bucket the database returned always finds its column.
    const counts_by_bucket_key = new Map();
    buckets.forEach((bucket) => {
      const at = bucket.at instanceof Date ? bucket.at : new Date(bucket.at);
      if (Number.isNaN(at.getTime())) return;
      const bucket_key = truncate_to_bucket_start(at, granularity, week_anchor, zone).getTime();
      counts_by_bucket_key.set(bucket_key, (counts_by_bucket_key.get(bucket_key) || 0) + bucket.count);
    });

    const data = [];
    let cursor = truncate_to_bucket_start(bounds.start, granularity, week_anchor, zone);
    const end_cursor = truncate_to_bucket_start(bounds.end, granularity, week_anchor, zone);
    while (cursor <= end_cursor) {
      const bucket_key = cursor.getTime();
      data.push({ label: format_bucket_label(cursor, granularity, zone), count: counts_by_bucket_key.get(bucket_key) || 0 });
      cursor = advance_bucket(cursor, granularity, zone);
    }

    return res.status(200).json(
      success_response(req, "FORM_STATS_FETCHED", {
        data,
        total,
        period,
        granularity,
        timezone: zone,
        bounds: { start: bounds.start.toISOString(), end: bounds.end.toISOString() },
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_form_submission_stats;
