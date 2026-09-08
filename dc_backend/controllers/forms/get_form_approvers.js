const forms_model = require("../../models/forms_model.js");
const project_access = require("../../utilities/project_access.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

/**
 * Paginated slice of the active version's approval-flow approvers. Every
 * form-returning route strips the approvers array (a generated test pool
 * can hold thousands), so the approval page assembles the full list through
 * this endpoint, 100 at a time, until total is reached.
 */
async function get_form_approvers(req, res) {
  try {
    const { form_group_id } = req.params;
    const { offset = 0, limit = DEFAULT_PAGE_SIZE } = req.query || {};

    if (!form_group_id) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }

    const access = await project_access.can_view_form_group(req.user, form_group_id);
    if (access.found && !access.allowed) {
      return res.status(403).json(warning_response(req, "ACCESS_DENIED"));
    }

    const form_version = (await forms_model.get_active_version(form_group_id)) || (await forms_model.get_latest_version(form_group_id));
    if (!form_version) {
      return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    }

    const config = form_version.approval_config || null;
    const approvers = (config && Array.isArray(config.approvers) && config.approvers) || [];
    const page_offset = Math.max(0, parseInt(offset, 10) || 0);
    const page_size = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(limit, 10) || DEFAULT_PAGE_SIZE));

    return res.status(200).json(
      success_response(req, "FORM_APPROVERS_FETCHED", {
        enabled: !!config && config.enabled === true,
        mode: config ? config.mode : undefined,
        total: approvers.length,
        offset: page_offset,
        approvers: approvers.slice(page_offset, page_offset + page_size),
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_form_approvers;
