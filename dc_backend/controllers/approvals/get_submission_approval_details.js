const submissions_model = require("../../models/submissions_model.js");
const approval_requests_model = require("../../models/approval_requests_model.js");
const approval_schedules_model = require("../../models/approval_schedules_model.js");
const project_access = require("../../utilities/project_access.js");
const { public_approval_trail } = require("../../utilities/approval.js");
const { public_batch_trail } = require("../../utilities/batch_approval.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { is_valid_object_id } = require("../../utilities/object_id.js");

/**
 * Everything the data table's row-click details panel shows about one
 * collected response: who approved it (with their message and when), who
 * is still pending, or - when nothing was sent yet - the schedule waiting
 * to fire. Covers both approval flavors: the per-submission flow built at
 * submit time, and the batch requests fired from the data page.
 */
async function get_submission_approval_details(req, res) {
  try {
    const { submission_id } = req.params;

    if (!is_valid_object_id(submission_id)) {
      return res.status(400).json(warning_response(req, "INVALID_ID"));
    }

    const submission = await submissions_model.find_submission_by_id(submission_id);
    if (!submission) return res.status(404).json(warning_response(req, "SUBMISSION_NOT_FOUND"));

    const access = await project_access.can_view_form_group(req.user, submission.form_group_id);
    if (!access.allowed) return res.status(403).json(warning_response(req, "ACCESS_DENIED"));

    // The per-submission flow built at submit time wins when both exist - it predates any batch.
    if (submission.approval) {
      return res.status(200).json(
        success_response(req, "APPROVAL_DETAILS_FETCHED", {
          source: "flow",
          status: submission.approval.status,
          approvers: public_approval_trail(submission.approval),
        }),
      );
    }

    if (submission.approval_request_id) {
      const request = await approval_requests_model.find_by_id(submission.approval_request_id);
      if (request) {
        return res.status(200).json(
          success_response(req, "APPROVAL_DETAILS_FETCHED", {
            source: "batch",
            status: request.status,
            sent_at: request.created_at,
            submission_count: request.submission_count,
            approvers: public_batch_trail(request),
          }),
        );
      }
    }

    const schedule = await approval_schedules_model.get_active_schedule(submission.form_group_id);
    if (schedule) {
      return res.status(200).json(
        success_response(req, "APPROVAL_DETAILS_FETCHED", {
          source: "scheduled",
          status: "scheduled",
          trigger: schedule.trigger,
          approvers: schedule.approvers.map((approver) => ({ name: approver.name, email: approver.email, status: "pending" })),
        }),
      );
    }

    return res.status(200).json(success_response(req, "APPROVAL_DETAILS_FETCHED", { source: "none", status: "none", approvers: [] }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_submission_approval_details;
