const approval_schedules_model = require("../../models/approval_schedules_model.js");
const approval_requests_model = require("../../models/approval_requests_model.js");
const project_access = require("../../utilities/project_access.js");
const { public_batch_trail } = require("../../utilities/batch_approval.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/** One past batch reduced to what the scheduling dialog shows - no tokens, no one-time codes. */
function to_request_summary(request) {
  return {
    _id: request._id,
    status: request.status,
    source: request.source,
    submission_count: request.submission_count,
    created_at: request.created_at,
    approvers: public_batch_trail(request),
  };
}

/**
 * The scheduling dialog's whole state for one form: the schedule still
 * waiting to fire (if any) and the recent batches already sent.
 */
async function get_approval_schedule(req, res) {
  try {
    const { form_group_id } = req.params;

    const access = await project_access.can_view_form_group(req.user, form_group_id);
    if (!access.found) return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    if (!access.allowed) return res.status(403).json(warning_response(req, "ACCESS_DENIED"));

    const [schedule, requests] = await Promise.all([
      approval_schedules_model.get_active_schedule(form_group_id),
      approval_requests_model.list_by_form_group(form_group_id, 10),
    ]);

    return res.status(200).json(
      success_response(req, "APPROVAL_SCHEDULE_FETCHED", {
        schedule: schedule
          ? { approvers: schedule.approvers, trigger: schedule.trigger, created_at: schedule.created_at, updated_at: schedule.updated_at }
          : null,
        requests: requests.map(to_request_summary),
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_approval_schedule;
