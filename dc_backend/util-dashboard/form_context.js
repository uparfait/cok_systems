const forms_model = require("../models/forms_model.js");
const projects_model = require("../models/projects_model.js");
const project_access = require("../utilities/project_access.js");

/**
 * Resolves everything a form-dashboard request needs in one place: the
 * form's active version (its schema drives validation and aggregation), the
 * project it lives in, whether the requesting user may SEE this form's data
 * at all, and whether they may EDIT this form (which is what saving its
 * dashboard requires).
 */
async function load_form_dashboard_context(user, form_group_id) {
  const form_version = (await forms_model.get_active_version(form_group_id)) || (await forms_model.get_latest_version(form_group_id));
  if (!form_version) return { found: false };

  const project = await projects_model.find_project_by_id(form_version.project_id);
  const access = await project_access.resolve_project_access(user, project);
  const allowed = project_access.access_allows_form(access, form_group_id);
  if (!allowed) return { found: true, allowed: false };

  const management = await project_access.resolve_form_management(user, project, form_group_id);
  return {
    found: true,
    allowed: true,
    form_version,
    project,
    can_edit: management.edit_forms === true,
  };
}

module.exports = {
  load_form_dashboard_context,
};
