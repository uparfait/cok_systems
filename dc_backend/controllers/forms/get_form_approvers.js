const forms_model = require("../../models/forms_model.js");
const project_access = require("../../utilities/project_access.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Paginated slice of the active version's approval-flow approvers, page by
 * page (page starts at 1, limit defaults to 20). Every form-returning route
 * strips the approvers array (a generated test pool can hold thousands), so
 * the approval page assembles the full list through this endpoint,
 * incrementing the page until total is reached. The slice is taken inside
 * MongoDB, so a huge stored array never rides along with a single page.
 */
async function get_form_approvers(req, res) {
  try {
    const { form_group_id } = req.params;
    const { page = 1, limit = DEFAULT_PAGE_SIZE } = req.query || {};

    if (!form_group_id) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }

    const access = await project_access.can_view_form_group(req.user, form_group_id);
    if (access.found && !access.allowed) {
      return res.status(403).json(warning_response(req, "ACCESS_DENIED"));
    }

    const page_number = Math.max(1, parseInt(page, 10) || 1);
    const page_size = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(limit, 10) || DEFAULT_PAGE_SIZE));

    const result = await forms_model.get_approvers_page(form_group_id, (page_number - 1) * page_size, page_size);
    if (!result) {
      return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    }

    return res.status(200).json(
      success_response(req, "FORM_APPROVERS_FETCHED", {
        enabled: result.enabled === true,
        mode: result.mode,
        total: result.total,
        page: page_number,
        limit: page_size,
        approvers: result.approvers || [],
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_form_approvers;
