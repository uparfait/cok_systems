const dashboards_model = require("../dashboards_model.js");
const dashboard_links_model = require("../dashboard_links_model.js");
const { load_form_dashboard_context } = require("../form_context.js");
const { sanitize_widgets } = require("../sanitize.js");
const { validate_dashboard } = require("../widget_validation.js");
const { build_field_catalog } = require("../field_catalog.js");
const { sanitize_filter_defs, validate_filter_defs } = require("../board_filters.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

const MAX_NAME = 80;

/**
 * A form's dashboards, each one named: list them, create one (a name is
 * required - there is no automatic "<form>'s basic dashboard" any more),
 * rename it, delete it, and read or save ONE dashboard's widgets by id.
 * Anyone allowed to see the form's data may list and read; only users
 * allowed to edit the form may create, rename, delete or save.
 */

async function viewer_context(req, res) {
  const { form_group_id } = req.params;
  if (!form_group_id) {
    res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    return null;
  }
  const context = await load_form_dashboard_context(req.user, form_group_id);
  if (!context.found) {
    res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    return null;
  }
  if (!context.allowed) {
    res.status(403).json(warning_response(req, "ACCESS_DENIED"));
    return null;
  }
  return context;
}

async function editor_context(req, res) {
  const context = await viewer_context(req, res);
  if (!context) return null;
  if (!context.can_edit) {
    res.status(403).json(warning_response(req, "DASHBOARD_EDIT_FORBIDDEN"));
    return null;
  }
  return context;
}

function read_name(body) {
  const name = typeof (body || {}).name === "string" ? body.name.trim() : "";
  if (!name || name.length > MAX_NAME) return null;
  return name;
}

async function list_dashboards(req, res) {
  try {
    const context = await viewer_context(req, res);
    if (!context) return undefined;
    const dashboards = await dashboards_model.list_dashboards_by_form(req.params.form_group_id);
    return res.status(200).json(success_response(req, "DASHBOARDS_FETCHED", { dashboards: dashboards.map(dashboards_model.strip_dashboard), can_edit: context.can_edit }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

async function create_dashboard(req, res) {
  try {
    const context = await editor_context(req, res);
    if (!context) return undefined;
    const name = read_name(req.body);
    if (!name) return res.status(400).json(warning_response(req, "DASHBOARD_NAME_REQUIRED"));
    if (await dashboards_model.is_name_taken(req.params.form_group_id, name)) return res.status(409).json(warning_response(req, "DASHBOARD_NAME_TAKEN"));
    const dashboard = await dashboards_model.create_dashboard(req.params.form_group_id, context.project._id, name);
    return res.status(201).json(success_response(req, "DASHBOARD_CREATED", { dashboard: dashboards_model.strip_dashboard(dashboard) }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

async function rename_dashboard(req, res) {
  try {
    const context = await editor_context(req, res);
    if (!context) return undefined;
    const { form_group_id, dashboard_id } = req.params;
    const existing = await dashboards_model.get_dashboard_by_id(form_group_id, dashboard_id);
    if (!existing) return res.status(404).json(warning_response(req, "DASHBOARD_NOT_FOUND"));
    const name = read_name(req.body);
    if (!name) return res.status(400).json(warning_response(req, "DASHBOARD_NAME_REQUIRED"));
    if (await dashboards_model.is_name_taken(form_group_id, name, dashboard_id)) return res.status(409).json(warning_response(req, "DASHBOARD_NAME_TAKEN"));
    const dashboard = await dashboards_model.rename_dashboard(form_group_id, dashboard_id, name);
    return res.status(200).json(success_response(req, "DASHBOARD_RENAMED", { dashboard: dashboards_model.strip_dashboard(dashboard) }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

async function delete_dashboard(req, res) {
  try {
    const context = await editor_context(req, res);
    if (!context) return undefined;
    const { form_group_id, dashboard_id } = req.params;
    const existing = await dashboards_model.get_dashboard_by_id(form_group_id, dashboard_id);
    if (!existing) return res.status(404).json(warning_response(req, "DASHBOARD_NOT_FOUND"));
    await dashboards_model.delete_dashboard(form_group_id, dashboard_id);
    // Its share links point at nothing now - they go with it.
    await dashboard_links_model.delete_links_by_dashboard(dashboard_id);
    return res.status(200).json(success_response(req, "DASHBOARD_DELETED", { id: dashboard_id }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

async function get_dashboard_by_id(req, res) {
  try {
    const context = await viewer_context(req, res);
    if (!context) return undefined;
    const dashboard = await dashboards_model.get_dashboard_by_id(req.params.form_group_id, req.params.dashboard_id);
    if (!dashboard) return res.status(404).json(warning_response(req, "DASHBOARD_NOT_FOUND"));
    return res.status(200).json(
      success_response(req, "DASHBOARD_FETCHED", {
        dashboard: dashboards_model.strip_dashboard(dashboard),
        widgets: dashboard.widgets || [],
        filters: dashboard.filters || [],
        updated_at: dashboard.updated_at,
        can_edit: context.can_edit,
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

/**
 * Saves ONE dashboard's widgets: every widget is stripped to known keys,
 * pinned to this very form and re-validated against the form's real schema
 * before anything is stored - exactly like the older unscoped save.
 */
async function save_dashboard_by_id(req, res) {
  try {
    const context = await editor_context(req, res);
    if (!context) return undefined;
    const { form_group_id, dashboard_id } = req.params;
    const existing = await dashboards_model.get_dashboard_by_id(form_group_id, dashboard_id);
    if (!existing) return res.status(404).json(warning_response(req, "DASHBOARD_NOT_FOUND"));
    const widgets = sanitize_widgets((req.body || {}).widgets).map((widget) => Object.assign(widget, { form_group_id }));
    const check = validate_dashboard(widgets, new Map([[form_group_id, context.form_version]]), context.project._id);
    if (!check.valid) return res.status(400).json(warning_response(req, "DASHBOARD_INVALID", null, { errors: check.errors }));
    // The board's filter fields ride along when the client sends them.
    let filters;
    if (Array.isArray((req.body || {}).filters)) {
      filters = sanitize_filter_defs(req.body.filters);
      const filter_errors = validate_filter_defs(filters, build_field_catalog(context.form_version.schema));
      if (filter_errors.length > 0) return res.status(400).json(warning_response(req, "DASHBOARD_INVALID", null, { errors: filter_errors }));
    }
    const saved = await dashboards_model.save_widgets(form_group_id, dashboard_id, widgets, filters);
    return res.status(200).json(success_response(req, "DASHBOARD_SAVED", { dashboard: dashboards_model.strip_dashboard(saved), widgets: saved.widgets, filters: saved.filters || [], updated_at: saved.updated_at, can_edit: true }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = {
  list_dashboards,
  create_dashboard,
  rename_dashboard,
  delete_dashboard,
  get_dashboard_by_id,
  save_dashboard_by_id,
};
