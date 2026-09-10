const approval_requests_model = require("../../models/approval_requests_model.js");
const submissions_model = require("../../models/submissions_model.js");
const forms_model = require("../../models/forms_model.js");
const { is_session_valid, read_session_signature } = require("../../utilities/batch_session.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 200;

function parse_bounded_int(value, fallback, min, max) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/**
 * One scroll batch of the records this approver has to work through,
 * exactly like the signed-in approver dashboard serves its own feed:
 * offset + limit, never the whole batch at once. Requires the session
 * signature earned with the emailed token, so the link alone reveals
 * nothing.
 */
async function get_batch_approval_records(req, res) {
  try {
    const { token } = req.params;
    const query = req.query || {};
    const offset = parse_bounded_int(query.offset, 0, 0, Number.MAX_SAFE_INTEGER);
    const limit = parse_bounded_int(query.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
    const signature = read_session_signature(req);

    const request = await approval_requests_model.find_by_token(token);
    if (!request) return res.status(404).json(warning_response(req, "APPROVAL_NOT_FOUND"));

    const approver = request.approvers.find((entry) => entry.token === token);
    if (!is_session_valid(approver, signature)) {
      return res.status(401).json(warning_response(req, "APPROVAL_SESSION_INVALID", null, { signature_required: true }));
    }

    const decisions = approver.record_decisions || [];
    const [form_version, page] = await Promise.all([
      forms_model.get_latest_version(request.form_group_id),
      submissions_model.list_by_approval_request_page(
        request._id,
        offset,
        limit,
        decisions.map((entry) => entry.submission_id),
      ),
    ]);
    const decided_count = decisions.length;

    return res.status(200).json(
      success_response(req, "APPROVAL_FETCHED", {
        email: approver.email,
        schema: form_version ? form_version.schema : null,
        records: page.items.map((submission) => {
          const own = decisions.find((entry) => entry.submission_id === submission._id.toString());
          return {
            id: submission._id.toString(),
            data: submission.data,
            version: submission.version,
            submitted_at: submission.submitted_at,
            my_decision: own ? own.status : null,
            my_comment: own ? own.comment : null,
          };
        }),
        offset,
        limit,
        total: page.total,
        decided_count,
        has_more: offset + page.items.length < page.total,
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_batch_approval_records;
