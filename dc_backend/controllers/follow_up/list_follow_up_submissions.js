const follow_up_submissions_model = require("../../models/follow_up_submissions_model.js");
const { existing_viewer_context } = require("./context.js");
const { resolve_period_bounds } = require("../../utilities/period_bounds.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

const DEFAULT_PAGE_SIZE = 20;

/** The data table's column filters, { field_id: [value, ...] }; anything malformed is ignored. */
function parse_filters(raw) {
  if (!raw) return null;
  let parsed;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (error) {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const clean = {};
  Object.keys(parsed).forEach((field_id) => {
    if (Array.isArray(parsed[field_id]) && parsed[field_id].length > 0) clean[field_id] = parsed[field_id];
  });
  return Object.keys(clean).length > 0 ? clean : null;
}

/**
 * One page of the follow-up's records, the same shape and the same query
 * options as the actual form's data table (version, period, search,
 * column filters, sort, one pinned record).
 */
async function list_follow_up_submissions(req, res) {
  try {
    const context = await existing_viewer_context(req, res);
    if (!context) return undefined;
    const { version, page = 1, limit = DEFAULT_PAGE_SIZE, period = "all", from, to, search, sort, filters, record } = req.query || {};

    const bounds = resolve_period_bounds(period, from, to);
    if (bounds === undefined) {
      return res.status(400).json(warning_response(req, "VALIDATION_FAILED"));
    }

    const page_number = Math.max(1, parseInt(page, 10) || 1);
    const page_size = Math.min(100, Math.max(1, parseInt(limit, 10) || DEFAULT_PAGE_SIZE));

    const result = await follow_up_submissions_model.list(context.follow_up_group_id, version, page_number, page_size, bounds, {
      search,
      sort,
      filters: parse_filters(filters),
      submission_id: record,
    });

    return res.status(200).json(
      Object.assign(success_response(req, "SUBMISSIONS_FETCHED", result.items), {
        total: result.total,
        page: page_number,
        limit: page_size,
        follow_up_group_id: context.follow_up_group_id,
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = list_follow_up_submissions;
