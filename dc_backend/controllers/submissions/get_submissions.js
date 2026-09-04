const submissions_model = require("../../models/submissions_model.js");
const approval_requests_model = require("../../models/approval_requests_model.js");
const approval_schedules_model = require("../../models/approval_schedules_model.js");
const project_access = require("../../utilities/project_access.js");
const { resolve_period_bounds } = require("../../utilities/period_bounds.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

const DEFAULT_PAGE_SIZE = 20;

/**
 * Paginated, authenticated list of collected submissions for a form,
 * optionally scoped to a single version and/or a date range (period=all is
 * the default - no version and no range mean every submission the form has
 * ever collected, across every version).
 */
async function get_submissions(req, res) {
  try {
    const { form_group_id } = req.params;
    const { version, page = 1, limit = DEFAULT_PAGE_SIZE, period = "all", from, to, search, sort } = req.query || {};

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

    const page_number = Math.max(1, parseInt(page, 10) || 1);
    const page_size = Math.min(100, Math.max(1, parseInt(limit, 10) || DEFAULT_PAGE_SIZE));

    const result = await submissions_model.list_submissions(form_group_id, version, page_number, page_size, bounds, { search, sort });

    // Each row's approval state for the table's Approval column: its own
    // submit-time flow when it has one, else the batch it was sent in, else
    // "scheduled" when a schedule is still waiting to fire.
    const request_ids = [...new Set(result.items.filter((item) => item.approval_request_id).map((item) => item.approval_request_id.toString()))];
    const [requests, schedule] = await Promise.all([
      approval_requests_model.find_by_ids(request_ids),
      approval_schedules_model.get_active_schedule(form_group_id),
    ]);
    const status_by_request = new Map(requests.map((request) => [request._id.toString(), request.status]));
    result.items.forEach((item) => {
      if (item.approval) item.approval_status = item.approval.status;
      else if (item.approval_request_id) item.approval_status = status_by_request.get(item.approval_request_id.toString()) || "pending";
      else item.approval_status = schedule ? "scheduled" : "none";
    });

    return res.status(200).json(
      Object.assign(success_response(req, "SUBMISSIONS_FETCHED", result.items), {
        total: result.total,
        page: page_number,
        limit: page_size,
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_submissions;
