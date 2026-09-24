const forms_model = require("../../models/forms_model.js");
const projects_model = require("../../models/projects_model.js");
const table_settings_model = require("../../models/form_table_settings_model.js");
const project_access = require("../../utilities/project_access.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * The data table's shared column setup: which columns the form currently
 * hides. Anyone who may see the form reads it; only someone who may edit
 * the form changes it, because unticking a column changes what everybody
 * else sees too.
 */

async function load_form_and_project(form_group_id) {
  const form = await forms_model.get_latest_version(form_group_id);
  if (!form) return null;
  const project = await projects_model.find_project_by_id(form.project_id);
  return { form, project };
}

async function get_table_settings(req, res) {
  try {
    const { form_group_id } = req.params;
    const access = await project_access.can_view_form_group(req.user, form_group_id);
    if (!access.found) return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    if (!access.allowed) return res.status(403).json(warning_response(req, "ACCESS_DENIED"));

    const context = await load_form_and_project(form_group_id);
    const management = await project_access.resolve_form_management(req.user, context.project, form_group_id);

    return res.status(200).json(
      success_response(req, "TABLE_SETTINGS_FETCHED", {
        hidden_columns: await table_settings_model.get_hidden_columns(form_group_id),
        can_edit: management.edit_forms === true,
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

async function save_table_settings(req, res) {
  try {
    const { form_group_id } = req.params;
    const { hidden_columns } = req.body || {};

    if (!Array.isArray(hidden_columns)) {
      return res.status(400).json(warning_response(req, "VALIDATION_FAILED"));
    }
    if (hidden_columns.length > table_settings_model.MAX_HIDDEN_COLUMNS) {
      return res.status(400).json(warning_response(req, "VALIDATION_FAILED"));
    }

    const context = await load_form_and_project(form_group_id);
    if (!context) return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));

    const management = await project_access.resolve_form_management(req.user, context.project, form_group_id);
    if (!management.edit_forms) {
      return res.status(403).json(warning_response(req, "FORM_ACTION_FORBIDDEN"));
    }

    const saved = await table_settings_model.save_hidden_columns(form_group_id, hidden_columns, req.user);
    return res.status(200).json(success_response(req, "TABLE_SETTINGS_SAVED", { hidden_columns: saved, can_edit: true }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = { get_table_settings, save_table_settings };
