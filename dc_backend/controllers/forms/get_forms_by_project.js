const forms_model = require("../../models/forms_model.js");
const projects_model = require("../../models/projects_model.js");
const project_access = require("../../utilities/project_access.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { is_valid_object_id } = require("../../utilities/object_id.js");

/**
 * Lists the forms that belong to a project, one entry per form group using
 * its latest version - rendered by the frontend as links, never a table.
 * Only the forms the requesting user's access grants expose are returned.
 */
async function get_forms_by_project(req, res) {
  try {
    const { project_id } = req.params;

    if (!is_valid_object_id(project_id)) {
      return res.status(400).json(warning_response(req, "INVALID_ID"));
    }

    const project = await projects_model.find_project_by_id(project_id);
    const access = await project_access.resolve_project_access(req.user, project);
    if (!access.can_view) {
      return res.status(403).json(warning_response(req, "ACCESS_DENIED"));
    }

    const forms = await forms_model.get_latest_forms_by_project(project_id);
    const visible_forms = access.all_forms
      ? forms
      : forms.filter((form) => access.form_group_ids.includes(form.form_group_id));
    return res.status(200).json(success_response(req, "FORM_VERSIONS_FETCHED", visible_forms));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_forms_by_project;
