const forms_model = require("../../models/forms_model.js");
const form_approvers_model = require("../../models/form_approvers_model.js");
const project_access = require("../../utilities/project_access.js");
const { is_test_approver } = require("../../utilities/approval.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Removes every generated test approver from the form's own approval flow -
 * and ONLY from there. Hand-made approvers stay untouched, the flow is
 * disabled when only test approvers were holding it up, and submission
 * records are never touched in any way.
 */
async function clear_test_approvals(req, res) {
  try {
    const { form_group_id } = req.params;

    if (!form_group_id) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }

    const access = await project_access.can_view_form_group(req.user, form_group_id);
    if (access.found && !access.allowed) {
      return res.status(403).json(warning_response(req, "ACCESS_DENIED"));
    }

    // The generated pool lives in its own collection - one delete removes
    // it all. The per-version sweep below only cleans up legacy generated
    // approvers stored on old form documents.
    let removed_approvers = await form_approvers_model.delete_generated_approvers(form_group_id);
    const versions = await forms_model.get_versions_by_group(form_group_id);
    for (const version of versions) {
      const config = version.approval_config;
      if (!config || !Array.isArray(config.approvers)) continue;
      const kept = config.approvers.filter((approver) => !is_test_approver(approver));
      const removed = config.approvers.length - kept.length;
      if (removed === 0) continue;
      removed_approvers += removed;
      await forms_model.update_approval_config(form_group_id, version.version, {
        enabled: kept.length > 0 ? config.enabled === true : false,
        approvers: kept,
      });
    }

    return res
      .status(200)
      .json(success_response(req, "TEST_APPROVALS_CLEARED", { cleared: removed_approvers, removed_approvers }, { count: removed_approvers }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = clear_test_approvals;
