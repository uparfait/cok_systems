const submissions_model = require("../../models/submissions_model.js");
const project_access = require("../../utilities/project_access.js");
const { resolve_period_bounds } = require("../../utilities/period_bounds.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

const EXPORT_PAGE_SIZE = 500;

/**
 * Returns every submission for a form (across all versions) within an
 * optional date range - no pagination, no search, no sort. Backs the Excel
 * export feature, which needs every matching record at once. Fetches
 * server-side in batches of EXPORT_PAGE_SIZE to avoid building one
 * enormous aggregation cursor, re-assembling the pages here into one flat
 * array for the client.
 */
async function export_submissions(req, res) {
  try {
    const { form_group_id } = req.params;
    const { period = "all", from, to } = req.query || {};

    if (!form_group_id) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }

    const access = await project_access.can_view_form_group(req.user, form_group_id);
    if (access.found && !access.allowed) {
      return res.status(403).json(warning_response(req, "ACCESS_DENIED"));
    }

    const bounds = resolve_period_bounds(period, from, to);
    if (bounds === undefined) {
      return res.status(400).json(warning_response(req, "VALIDATION_FAILED"));
    }

    const all_items = [];
    let page = 1;
    let total = 0;

    while (true) {
      const result = await submissions_model.list_submissions(form_group_id, undefined, page, EXPORT_PAGE_SIZE, bounds, { sort: "oldest" });
      if (page === 1) total = result.total;
      if (!result.items || result.items.length === 0) break;
      all_items.push(...result.items);
      if (all_items.length >= total || result.items.length < EXPORT_PAGE_SIZE) break;
      page += 1;
    }

    return res.status(200).json(
      Object.assign(success_response(req, "SUBMISSIONS_FETCHED", all_items), {
        total: all_items.length,
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = export_submissions;
