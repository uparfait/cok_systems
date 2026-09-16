const dashboards_model = require("../dashboards_model.js");
const dashboard_links_model = require("../dashboard_links_model.js");
const { load_public_dashboard_context } = require("../public_link_context.js");
const { compute_dashboard_results, compute_skipped_page, compute_filter_values } = require("../compute_results.js");
const { compute_widget_records, collect_widget_records } = require("../widget_records.js");
const { build_records_workbook, send_workbook } = require("../records_export.js");
const { map_shapes, MAP_LEVELS } = require("../map_shapes.js");
const { build_field_catalog, field_label_text, parent_field_id_of } = require("../field_catalog.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * The public, read-only face of a form's dashboard, reached through a share
 * link's token with no sign-in: the board's widgets and the form's name,
 * the live data of those widgets under any period the viewer picks, and a
 * KPI card's skipped answers. Nothing here can change the dashboard - the
 * save endpoint stays behind authentication - and an expired or unknown
 * token is refused.
 */

/**
 * The link's viewing configuration; a link saved before configurations
 * existed lets its viewers filter freely and shows the dashboard's name.
 */
function link_config(link) {
  const config = (link && link.config) || {};
  return {
    filter_mode: config.filter_mode === "locked" ? "locked" : "free",
    locked_filters: Array.isArray(config.locked_filters) ? config.locked_filters : [],
    locked_period: config.locked_period || null,
    show_title: config.show_title === true,
    allow_records: config.allow_records === true,
    record_fields: Array.isArray(config.record_fields) ? config.record_fields : [],
  };
}

/**
 * The body a request really runs with under this link: under a locked
 * link the fixed filters always win over the viewer's values (the merge
 * does that), every other filter stays the viewer's to pick, and a fixed
 * period replaces the viewer's.
 */
function viewer_body(req, link) {
  const config = link_config(link);
  const body = Object.assign({}, req.body || {});
  if (config.filter_mode !== "locked") return body;
  if (config.locked_period) body.period = config.locked_period;
  return body;
}

/** The board filters' fields as the public page needs them: id, type and label. */
function filter_fields(dashboard, form_version) {
  const catalog = build_field_catalog(form_version.schema);
  return ((dashboard && dashboard.filters) || [])
    .map((def) => catalog.fields_by_id.get(def.field_id))
    .filter(Boolean)
    .map((field) => ({ id: field.id, type: field.type, label: field_label_text(field), parent_field_id: parent_field_id_of(field, catalog.fields_by_id) }));
}

/** Locked values the viewer can never change; nothing forced when filtering is free. */
function forced_filters(link) {
  const config = link_config(link);
  return config.filter_mode === "locked" ? config.locked_filters : [];
}

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
        link: { title: context.link.title, description: context.link.description || "", expires_at: context.link.expires_at || null, config: link_config(context.link) },
        widgets: (dashboard && dashboard.widgets) || [],
        filters: (dashboard && dashboard.filters) || [],
        filter_fields: filter_fields(dashboard, context.form_version),
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
    // Under a locked link the viewer's own filter values (and fixed period) are ignored: only the link's count.
    const body = viewer_body(req, context.link);
    const results = await compute_dashboard_results(body, context.form_version.form_group_id, context.form_version, context.project._id, forced_filters(context.link));
    return res.status(200).json(success_response(req, "DASHBOARD_DATA_FETCHED", { results }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

async function get_public_kpi_skipped(req, res) {
  try {
    const context = await resolve(req, res);
    if (!context) return undefined;
    const body = viewer_body(req, context.link);
    const page = await compute_skipped_page(body, context.form_version.form_group_id, context.form_version, context.project._id, forced_filters(context.link));
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

async function get_public_filter_values(req, res) {
  try {
    const context = await resolve(req, res);
    if (!context) return undefined;
    const body = viewer_body(req, context.link);
    const result = await compute_filter_values(body, context.form_version.form_group_id, context.form_version, forced_filters(context.link));
    if (result.invalid) return res.status(400).json(warning_response(req, "DASHBOARD_FILTER_INVALID"));
    return res.status(200).json(success_response(req, "DASHBOARD_FILTER_VALUES_FETCHED", { values: result.values }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

/** The records behind a widget - only when the link allows viewers to open them. */
async function get_public_widget_records(req, res) {
  try {
    const context = await resolve(req, res);
    if (!context) return undefined;
    if (!link_config(context.link).allow_records) return res.status(403).json(warning_response(req, "DASHBOARD_RECORDS_FORBIDDEN"));
    const body = viewer_body(req, context.link);
    const result = await compute_widget_records(body, context.form_version.form_group_id, context.form_version, context.project._id, forced_filters(context.link), link_config(context.link).record_fields);
    if (result.invalid) return res.status(400).json(warning_response(req, "DASHBOARD_INVALID", null, { errors: result.invalid }));
    return res.status(200).json(success_response(req, "DASHBOARD_RECORDS_FETCHED", result));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

/** The records behind a shared widget as an Excel download - when the link allows opening records. */
async function get_public_widget_records_export(req, res) {
  try {
    const context = await resolve(req, res);
    if (!context) return undefined;
    if (!link_config(context.link).allow_records) return res.status(403).json(warning_response(req, "DASHBOARD_RECORDS_FORBIDDEN"));
    const body = viewer_body(req, context.link);
    const result = await collect_widget_records(body, context.form_version.form_group_id, context.form_version, context.project._id, forced_filters(context.link), link_config(context.link).record_fields);
    if (result.invalid) return res.status(400).json(warning_response(req, "DASHBOARD_INVALID", null, { errors: result.invalid }));
    const title = (body.widget && body.widget.title) || "records";
    const file = await build_records_workbook({ title, items: result.items, columns: result.columns, criteria: result.criteria, period: result.period, language: "en" });
    return send_workbook(res, file, result.items.length);
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

/** The boundaries a shared map widget draws - the same outlines, no auth. */
async function get_public_map_shapes(req, res) {
  try {
    const context = await resolve(req, res);
    if (!context) return undefined;
    const body = req.body || {};
    const level = typeof body.level === "string" ? body.level.trim() : "";
    if (!MAP_LEVELS.includes(level)) return res.status(400).json(warning_response(req, "DASHBOARD_MAP_LEVEL_INVALID"));
    return res.status(200).json(success_response(req, "DASHBOARD_MAP_FETCHED", map_shapes(level, Array.isArray(body.names) ? body.names : [], body.outline === true)));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = {
  get_public_map_shapes,
  get_public_widget_records_export,
  get_public_widget_records,
  get_public_dashboard,
  get_public_dashboard_data,
  get_public_kpi_skipped,
  get_public_filter_values,
};
