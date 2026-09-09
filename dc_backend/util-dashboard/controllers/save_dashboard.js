const projects_model = require("../../models/projects_model.js");
const forms_model = require("../../models/forms_model.js");
const project_access = require("../../utilities/project_access.js");
const dashboards_model = require("../dashboards_model.js");
const { sanitize_widgets } = require("../sanitize.js");
const { validate_dashboard } = require("../widget_validation.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { is_valid_object_id } = require("../../utilities/object_id.js");

/**
 * Loads the active version of every form a widget list references, keyed by
 * form group - validation checks each widget against its real schema.
 */
async function load_form_versions(widgets) {
  const unique_ids = Array.from(new Set(widgets.map((widget) => widget.form_group_id).filter(Boolean)));
  const versions = await Promise.all(unique_ids.map((form_group_id) => forms_model.get_active_version(form_group_id)));
  const map = new Map();
  unique_ids.forEach((form_group_id, index) => {
    if (versions[index]) map.set(form_group_id, versions[index]);
  });
  return map;
}

/**
 * Saves the project's whole dashboard in one document. Only users allowed
 * to edit the project may save; every widget is stripped to known keys and
 * re-validated against the real form schemas before anything is stored.
 */
async function save_dashboard(req, res) {
  try {
    const { project_id } = req.params;

    if (!is_valid_object_id(project_id)) {
      return res.status(400).json(warning_response(req, "INVALID_ID"));
    }

    const project = await projects_model.find_project_by_id(project_id);
    if (!project) {
      return res.status(404).json(warning_response(req, "PROJECT_NOT_FOUND"));
    }

    const management = await project_access.resolve_form_management(req.user, project);
    if (management.edit_project !== true) {
      return res.status(403).json(warning_response(req, "DASHBOARD_EDIT_FORBIDDEN"));
    }

    const widgets = sanitize_widgets((req.body || {}).widgets);
    const form_versions = await load_form_versions(widgets);
    const check = validate_dashboard(widgets, form_versions, project_id);
    if (!check.valid) {
      return res.status(400).json(warning_response(req, "DASHBOARD_INVALID", { errors: check.errors }));
    }

    const saved = await dashboards_model.save_dashboard(project_id, widgets);
    return res.status(200).json(
      success_response(req, "DASHBOARD_SAVED", {
        widgets: saved.widgets,
        updated_at: saved.updated_at,
        can_edit: true,
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = save_dashboard;
module.exports.load_form_versions = load_form_versions;
