const forms_model = require("../../models/forms_model.js");
const form_approvers_model = require("../../models/form_approvers_model.js");
const project_access = require("../../utilities/project_access.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Paginated approval-flow approvers, page by page (page starts at 1, limit
 * defaults to 20). The few hand-made approvers on the form's own config
 * come first; the generated pool follows straight from its own collection
 * through a standard find(filter).limit(limit).skip(skip).sort(...) query
 * plus countDocuments(filter) - the same pagination pattern every other
 * large list in the system uses, so a pool of any size stays fast.
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

    const form_version = (await forms_model.get_active_version(form_group_id)) || (await forms_model.get_latest_version(form_group_id));
    if (!form_version) {
      return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    }

    const limit_val = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(limit, 10) || DEFAULT_PAGE_SIZE));
    const page_number = Math.max(1, parseInt(page, 10) || 1);
    const skip_val = (page_number - 1) * limit_val;

    const config = form_version.approval_config || null;
    const config_approvers = (config && Array.isArray(config.approvers) && config.approvers) || [];

    const generated_total = await form_approvers_model.count_generated_approvers(form_group_id);
    const total = config_approvers.length + generated_total;

    // The page spans the virtual concatenation [config approvers, generated
    // pool]: whatever the config part doesn't fill comes from the
    // collection's own skip/limit.
    const head = config_approvers.slice(skip_val, skip_val + limit_val);
    const remaining = limit_val - head.length;
    const generated_skip = Math.max(0, skip_val - config_approvers.length);
    const tail = remaining > 0 ? await form_approvers_model.list_generated_approvers(form_group_id, generated_skip, remaining) : [];

    return res.status(200).json(
      success_response(req, "FORM_APPROVERS_FETCHED", {
        enabled: !!config && config.enabled === true,
        mode: config ? config.mode : undefined,
        total,
        page: page_number,
        limit: limit_val,
        approvers: head.concat(tail),
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_form_approvers;
