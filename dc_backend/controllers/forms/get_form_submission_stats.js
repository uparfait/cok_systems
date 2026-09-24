const submissions_model = require("../../models/submissions_model.js");
const project_access = require("../../utilities/project_access.js");
const { resolve_period_bounds } = require("../../utilities/period_bounds.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

const WEEK_START_DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

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

  const span_days = Math.max(1, Math.ceil((bounds.end - bounds.start) / (1000 * 60 * 60 * 24)));
  if (span_days <= 1) return "hour";
  if (span_days <= 31) return "day";
  if (span_days <= 180) return "week";
  if (span_days <= 730) return "month";
  return "year";
}

function truncate_to_bucket_start(date, granularity, week_anchor) {
  const result = new Date(date);
  if (granularity === "hour") {
    result.setMinutes(0, 0, 0);
    return result;
  }
  if (granularity === "day") {
    result.setHours(0, 0, 0, 0);
    return result;
  }
  if (granularity === "week") {
    // Weekly buckets are anchored on the RANGE'S OWN first day, not ISO
    // Mondays - a custom "Aug 1 - Sep 15" must chart as Aug 1, Aug 8, ...,
    // never as a "Jul 27" week that starts before what was picked.
    const day_ms = 24 * 60 * 60 * 1000;
    const day_start = new Date(result);
    day_start.setHours(0, 0, 0, 0);
    const offset_days = Math.round((day_start - week_anchor) / day_ms);
    const bucket_index = Math.floor(offset_days / 7);
    const bucket_start = new Date(week_anchor);
    bucket_start.setDate(bucket_start.getDate() + bucket_index * 7);
    return bucket_start;
  }
  if (granularity === "month") {
    return new Date(result.getFullYear(), result.getMonth(), 1);
  }
  return new Date(result.getFullYear(), 0, 1);
}

function advance_bucket(date, granularity) {
  const result = new Date(date);
  if (granularity === "hour") result.setHours(result.getHours() + 1);
  else if (granularity === "day") result.setDate(result.getDate() + 1);
  else if (granularity === "week") result.setDate(result.getDate() + 7);
  else if (granularity === "month") result.setMonth(result.getMonth() + 1);
  else result.setFullYear(result.getFullYear() + 1);
  return result;
}

function format_bucket_label(date, granularity) {
  if (granularity === "hour") {
    const hour = date.getHours();
    const suffix = hour >= 12 ? "PM" : "AM";
    const display_hour = hour % 12 || 12;
    return `${display_hour}:00 ${suffix}`;
  }
  if (granularity === "day") {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (granularity === "week") {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (granularity === "month") {
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
  return String(date.getFullYear());
}

/**
 * Submissions collected for one form, bucketed into a time series whose
 * granularity (hour/day/week/month/year) is chosen from the selected
 * period exactly like the reference gender-stats controller does for its
 * own "range" period - every bucket between the bounds is included even
 * when empty, so the chart's x-axis is continuous rather than skipping
 * gaps, and the total is the true count within the window (not just the
 * sum of plotted points, though they're the same number).
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

    const bounds = resolve_period_bounds(period, from, to);
    if (!bounds) {
      return res.status(400).json(warning_response(req, "VALIDATION_FAILED"));
    }

    const granularity = resolve_granularity(period, bounds);
    const week_anchor = new Date(bounds.start);
    week_anchor.setHours(0, 0, 0, 0);

    // Counted in the database, one row per bucket - a year of records is
    // a dozen numbers coming back, not a dozen numbers computed from
    // every timestamp the year holds.
    const { buckets, total } = await submissions_model.count_submissions_over_time(
      form_group_id,
      bounds.start,
      bounds.end,
      granularity,
      -bounds.start.getTimezoneOffset(),
      WEEK_START_DAYS[week_anchor.getDay()],
    );

    // Re-keyed against the same local-time bucket starts the axis below
    // walks, so a bucket the database returned always finds its column.
    const counts_by_bucket_key = new Map();
    buckets.forEach((bucket) => {
      const at = bucket.at instanceof Date ? bucket.at : new Date(bucket.at);
      if (Number.isNaN(at.getTime())) return;
      const bucket_key = truncate_to_bucket_start(at, granularity, week_anchor).getTime();
      counts_by_bucket_key.set(bucket_key, (counts_by_bucket_key.get(bucket_key) || 0) + bucket.count);
    });

    const data = [];
    let cursor = truncate_to_bucket_start(bounds.start, granularity, week_anchor);
    const end_cursor = truncate_to_bucket_start(bounds.end, granularity, week_anchor);
    while (cursor <= end_cursor) {
      const bucket_key = cursor.getTime();
      data.push({ label: format_bucket_label(cursor, granularity), count: counts_by_bucket_key.get(bucket_key) || 0 });
      cursor = advance_bucket(cursor, granularity);
    }

    return res.status(200).json(
      success_response(req, "FORM_STATS_FETCHED", {
        data,
        total,
        period,
        granularity,
        bounds: { start: bounds.start.toISOString(), end: bounds.end.toISOString() },
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_form_submission_stats;
