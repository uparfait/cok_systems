const { load_form_dashboard_context } = require("../form_context.js");
const { compute_skipped_page } = require("../compute_results.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Lists, in full detail, the answers a numeric KPI widget SKIPPED inside
 * its current window - answers that could not be read as numbers (free text
 * typed into what the formula needs as a number). Returns one page (offset
 * + limit, 20 by default, newest first) of when each record was submitted
 * and exactly what was entered, plus the true total and whether more
 * pages follow, honoring the same period the dashboard is showing. The
 * paging itself lives in compute_results.js, shared with the public
 * share-link endpoint.
 */
async function kpi_skipped(req, res) {
  try {
    const { form_group_id } = req.params;

    if (!form_group_id) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }

    const context = await load_form_dashboard_context(req.user, form_group_id);
    if (!context.found) {
      return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    }
    if (!context.allowed) {
      return res.status(403).json(warning_response(req, "ACCESS_DENIED"));
    }

    const page = await compute_skipped_page(req.body || {}, form_group_id, context.form_version, context.project._id);
    if (page.invalid) {
      return res.status(400).json(warning_response(req, "DASHBOARD_INVALID", null, { errors: page.invalid }));
    }

    return res.status(200).json(
      success_response(req, "DASHBOARD_SKIPPED_FETCHED", {
        total: page.result.total,
        rows: page.result.rows,
        offset: page.offset,
        limit: page.limit,
        has_more: page.offset + page.result.rows.length < page.result.total,
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = kpi_skipped;
