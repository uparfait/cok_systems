const submissions_model = require("../../models/submissions_model.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

const DEFAULT_PAGE_SIZE = 20;

/**
 * Paginated, authenticated list of collected submissions for a form,
 * optionally scoped to a single version.
 */
async function get_submissions(req, res) {
  try {
    const { form_group_id } = req.params;
    const { version, page = 1, limit = DEFAULT_PAGE_SIZE } = req.query || {};

    if (!form_group_id) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }

    const page_number = Math.max(1, parseInt(page, 10) || 1);
    const page_size = Math.min(100, Math.max(1, parseInt(limit, 10) || DEFAULT_PAGE_SIZE));

    const result = await submissions_model.list_submissions(form_group_id, version, page_number, page_size);

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
