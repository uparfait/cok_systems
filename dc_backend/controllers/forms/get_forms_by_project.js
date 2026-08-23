const forms_model = require("../../models/forms_model.js");
const projects_model = require("../../models/projects_model.js");
const submissions_model = require("../../models/submissions_model.js");
const project_access = require("../../utilities/project_access.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { is_valid_object_id } = require("../../utilities/object_id.js");

/**
 * Lists the forms that belong to a project, one entry per form group using
 * its latest version - rendered by the frontend as links, never a table.
 * Only the forms the requesting user's access grants expose are returned.
 * Each is annotated with its own total_submissions - the sidebar's per-form
 * record-count badge - counted only for the forms actually returned here,
 * not the whole project.
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

    const forms_with_counts = await Promise.all(
      visible_forms.map(async (form) =>
        Object.assign({}, form, { total_submissions: await submissions_model.count_by_form_group_id(form.form_group_id) }),
      ),
    );

    return res.status(200).json(success_response(req, "FORM_VERSIONS_FETCHED", forms_with_counts));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_forms_by_project;
