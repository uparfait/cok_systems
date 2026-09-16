const dashboards_model = require("../dashboards_model.js");
const dashboard_links_model = require("../dashboard_links_model.js");
const { load_public_dashboard_context } = require("../public_link_context.js");
const { compute_dashboard_results, compute_skipped_page } = require("../compute_results.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * The public, read-only face of a form's dashboard, reached through a share
 * link's token with no sign-in: the board's widgets and the form's name,
 * the live data of those widgets under any period the viewer picks, and a
 * KPI card's skipped answers. Nothing here can change the dashboard - the
 * save endpoint stays behind authentication - and an expired or unknown
 * token is refused.
 */

async function resolve(req, res) {
  const context = await load_public_dashboard_context(req.params.token);
  if (!context.found) {
    res.status(404).json(warning_response(req, "DASHBOARD_LINK_NOT_FOUND"));
    return null;
  }
  if (context.expired) {
    res.status(410).json(warning_response(req, "DASHBOARD_LINK_EXPIRED"));
    return null;
  }
  return context;
}

async function get_public_dashboard(req, res) {
  try {
    const context = await resolve(req, res);
    if (!context) return undefined;
    // The link's own dashboard; an older link without one shows the form's first.
    const dashboard = context.link.dashboard_id
      ? await dashboards_model.get_dashboard_by_id(context.form_version.form_group_id, context.link.dashboard_id)
      : await dashboards_model.get_dashboard_by_form(context.form_version.form_group_id);
    if (!dashboard) return res.status(404).json(warning_response(req, "DASHBOARD_NOT_FOUND"));
    await dashboard_links_model.count_view(context.link._id);
    return res.status(200).json(
      success_response(req, "DASHBOARD_FETCHED", {
        form_group_id: context.form_version.form_group_id,
        form_name: context.form_version.form_name,
        dashboard_name: dashboard.name || dashboards_model.FIRST_NAME,
        project_name: context.project.name || "",
        link: { title: context.link.title, description: context.link.description || "", expires_at: context.link.expires_at || null },
        widgets: (dashboard && dashboard.widgets) || [],
        updated_at: dashboard ? dashboard.updated_at : null,
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

async function get_public_dashboard_data(req, res) {
  try {
    const context = await resolve(req, res);
    if (!context) return undefined;
    const results = await compute_dashboard_results(req.body || {}, context.form_version.form_group_id, context.form_version, context.project._id);
    return res.status(200).json(success_response(req, "DASHBOARD_DATA_FETCHED", { results }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

async function get_public_kpi_skipped(req, res) {
  try {
    const context = await resolve(req, res);
    if (!context) return undefined;
    const page = await compute_skipped_page(req.body || {}, context.form_version.form_group_id, context.form_version, context.project._id);
    if (page.invalid) return res.status(400).json(warning_response(req, "DASHBOARD_INVALID", null, { errors: page.invalid }));
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

module.exports = {
  get_public_dashboard,
  get_public_dashboard_data,
  get_public_kpi_skipped,
};
