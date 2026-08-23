const submissions_model = require("../../models/submissions_model.js");
const project_access = require("../../utilities/project_access.js");
const { resolve_period_bounds } = require("../../utilities/period_bounds.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

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

function truncate_to_bucket_start(date, granularity) {
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
    const day_index_from_monday = (result.getDay() + 6) % 7;
    result.setDate(result.getDate() - day_index_from_monday);
    result.setHours(0, 0, 0, 0);
    return result;
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
    const submissions = await submissions_model.list_submitted_at_within(form_group_id, bounds.start, bounds.end);

    const counts_by_bucket_key = new Map();
    submissions.forEach((submission) => {
      const submitted_at = submission.submitted_at ? new Date(submission.submitted_at) : null;
      if (!submitted_at || Number.isNaN(submitted_at.getTime())) return;
      const bucket_key = truncate_to_bucket_start(submitted_at, granularity).getTime();
      counts_by_bucket_key.set(bucket_key, (counts_by_bucket_key.get(bucket_key) || 0) + 1);
    });

    const data = [];
    let cursor = truncate_to_bucket_start(bounds.start, granularity);
    const end_cursor = truncate_to_bucket_start(bounds.end, granularity);
    while (cursor <= end_cursor) {
      const bucket_key = cursor.getTime();
      data.push({ label: format_bucket_label(cursor, granularity), count: counts_by_bucket_key.get(bucket_key) || 0 });
      cursor = advance_bucket(cursor, granularity);
    }

    return res.status(200).json(
      success_response(req, "FORM_STATS_FETCHED", {
        data,
        total: submissions.length,
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
