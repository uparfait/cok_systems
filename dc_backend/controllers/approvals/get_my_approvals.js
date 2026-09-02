const submissions_model = require("../../models/submissions_model.js");
const forms_model = require("../../models/forms_model.js");
const { can_step_act } = require("../../utilities/approval.js");
const { success_response, error_response } = require("../../utilities/response.js");

/**
 * Authenticated approver dashboard feed: every submission routed to the
 * logged-in user's email, across all forms, with this user's own step (token
 * included - it is their credential) and a computed per-record state, so the
 * page can gate approving on "ready" exactly like the single-token page does.
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

async function get_my_approvals(req, res) {
  try {
    const email = (req.user.email || "").toString().trim().toLowerCase();
    const submissions = await submissions_model.list_by_approver_email(email);

    // One schema fetch per distinct form version, shared by all its records.
    const forms = {};
    const records = [];
    for (const submission of submissions) {
      if (!submission.approval || !Array.isArray(submission.approval.steps)) continue;
      // The user may appear in several steps; the actionable pending one wins.
      const my_steps = submission.approval.steps.filter((entry) => entry.email === email);
      if (my_steps.length === 0) continue;
      const step = my_steps.find((entry) => entry.status === "pending") || my_steps[my_steps.length - 1];

      const form_key = `${submission.form_group_id}:${submission.version}`;
      if (!forms[form_key]) {
        const form_version = await forms_model.get_version_document(submission.form_group_id, submission.version);
        forms[form_key] = form_version
          ? { form_name: form_version.form_name, schema: form_version.schema }
          : { form_name: "Form", schema: { fields: [] } };
      }

      const { state, pending_names } = state_for(submission.approval, step);
      records.push({
        id: submission._id.toString(),
        form_key,
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

    return res.status(200).json(success_response(req, "APPROVAL_FETCHED", { records, forms }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_my_approvals;
