const submissions_model = require("../../models/submissions_model.js");
const forms_model = require("../../models/forms_model.js");
const { can_step_act } = require("../../utilities/approval.js");
const { success_response, error_response } = require("../../utilities/response.js");

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 200;

/**
 * Authenticated approver dashboard feed, one scroll batch at a time: the
 * submissions of one form version routed to the logged-in user's email
 * (newest first, offset + limit), with this user's own step (token included -
 * it is their credential) and a computed per-record state, so the page can
 * gate approving on "ready" exactly like the single-token page does.
 *
 * Query: form_key (form_group_id:version, defaults to the form with the newest
 * submission), offset (default 0), limit (default 8, max 200). Every response
 * also carries the picker's form list so the page never needs a second call.
 */

// waiting = someone before this approver still has to sign; the names say who.
function state_for(approval, step) {
  if (step.status === "approved") return { state: "approved_by_you", pending_names: [] };
  if (step.status === "rejected") return { state: "rejected_by_you", pending_names: [] };
  if (step.status === "skipped") return { state: "skipped", pending_names: [] };
  if (approval.status !== "pending") return { state: approval.status, pending_names: [] };
  if (can_step_act(approval, step)) return { state: "ready", pending_names: [] };
  const pending_names = approval.steps
    .filter((entry) => entry.level < step.level && entry.status === "pending" && entry.force !== false)
    .map((entry) => entry.name);
  return { state: "waiting", pending_names };
}

function parse_bounded_int(value, fallback, min, max) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

async function get_my_approvals(req, res) {
  try {
    const email = (req.user.email || "").toString().trim().toLowerCase();
    const query = req.query || {};
    const offset = parse_bounded_int(query.offset, 0, 0, Number.MAX_SAFE_INTEGER);
    const limit = parse_bounded_int(query.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);

    // The picker list doubles as the lookup for the requested form, so the key never needs parsing.
    const versions = await submissions_model.list_form_versions_by_approver_email(email);
    const forms = {};
    const form_options = [];
    for (const entry of versions) {
      const form_key = `${entry.form_group_id}:${entry.version}`;
      const form_version = await forms_model.get_version_document(entry.form_group_id, entry.version);
      forms[form_key] = form_version
        ? { form_name: form_version.form_name, schema: form_version.schema }
        : { form_name: "Form", schema: { fields: [] } };
      form_options.push({ form_key, form_group_id: entry.form_group_id, version: entry.version, form_name: forms[form_key].form_name, count: entry.count });
    }

    const active = form_options.find((option) => option.form_key === query.form_key) || form_options[0] || null;
    if (!active) {
      return res.status(200).json(success_response(req, "APPROVAL_FETCHED", { records: [], forms, form_options, active_form_key: null, offset, limit, total: 0, has_more: false }));
    }

    const { items, total } = await submissions_model.list_by_approver_email_page(email, active.form_group_id, active.version, offset, limit);

    const records = [];
    for (const submission of items) {
      if (!submission.approval || !Array.isArray(submission.approval.steps)) continue;
      // The user may appear in several steps; the actionable pending one wins.
      const my_steps = submission.approval.steps.filter((entry) => entry.email === email);
      if (my_steps.length === 0) continue;
      const step = my_steps.find((entry) => entry.status === "pending") || my_steps[my_steps.length - 1];

      const { state, pending_names } = state_for(submission.approval, step);
      records.push({
        id: submission._id.toString(),
        form_key: active.form_key,
        submitted_at: submission.submitted_at,
        data: submission.data || {},
        overall_status: submission.approval.status,
        step: {
          level: step.level,
          role: step.role,
          message: step.message || null,
          status: step.status,
          token: step.token,
          level_type: step.level_type || null,
          location: step.location || null,
          comment: step.comment || null,
          acted_at: step.acted_at || null,
        },
        state,
        pending_names,
      });
    }

    return res.status(200).json(
      success_response(req, "APPROVAL_FETCHED", {
        records,
        forms,
        form_options,
        active_form_key: active.form_key,
        offset,
        limit,
        total,
        has_more: offset + items.length < total,
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_my_approvals;
