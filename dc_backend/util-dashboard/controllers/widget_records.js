const { load_form_dashboard_context } = require("../form_context.js");
const { compute_widget_records, collect_widget_records } = require("../widget_records.js");
const { build_records_workbook, send_workbook } = require("../records_export.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * The records behind one widget (see widget_records.js), for anyone
 * allowed to see the form's data: paged for the table, or the whole set
 * as an Excel download. The widget, the board's period and filters, what
 * was clicked and the language come in the body.
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

async function widget_records(req, res) {
  try {
    const context = await viewer_context(req, res);
    if (!context) return undefined;
    const result = await compute_widget_records(req.body || {}, req.params.form_group_id, context.form_version, context.project._id);
    if (result.invalid) return res.status(400).json(warning_response(req, "DASHBOARD_INVALID", null, { errors: result.invalid }));
    return res.status(200).json(success_response(req, "DASHBOARD_RECORDS_FETCHED", result));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

async function widget_records_export(req, res) {
  try {
    const context = await viewer_context(req, res);
    if (!context) return undefined;
    const body = req.body || {};
    const result = await collect_widget_records(body, req.params.form_group_id, context.form_version, context.project._id);
    if (result.invalid) return res.status(400).json(warning_response(req, "DASHBOARD_INVALID", null, { errors: result.invalid }));
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : (body.widget && body.widget.title) || "records";
    const file = await build_records_workbook({ title, items: result.items, columns: result.columns, criteria: result.criteria, period: result.period, language: body.language || req.language });
    return send_workbook(res, file, result.items.length);
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = {
  widget_records,
  widget_records_export,
};
