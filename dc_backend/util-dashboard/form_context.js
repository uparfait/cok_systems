const forms_model = require("../models/forms_model.js");
const projects_model = require("../models/projects_model.js");
const project_access = require("../utilities/project_access.js");
const { resolve_dashboard_source, follow_up_schema_version } = require("./data_source.js");

/**
 * Resolves everything a form-dashboard request needs in one place: the
 * form's active version (its schema drives validation and aggregation), the
 * project it lives in, whether the requesting user may SEE this form's data
 * at all, and whether they may EDIT this form (which is what saving its
 * dashboard requires).
 *
 * wanted ({ source, dashboard_id }, optional) says which records the
 * request is about. For a dashboard created on the form's FOLLOW-UP data,
 * form_version is the follow-up's active schema document instead (see
 * data_source.js): widgets are validated against it and every pipeline
 * reads the follow-up's records. source_version is always the form's own
 * version, and source says which of the two form_version is.
 */
async function load_form_dashboard_context(user, form_group_id, wanted) {
  const source_version = (await forms_model.get_active_version(form_group_id)) || (await forms_model.get_latest_version(form_group_id));
  if (!source_version) return { found: false };

  const project = await projects_model.find_project_by_id(source_version.project_id);
  const access = await project_access.resolve_project_access(user, project);
  const allowed = project_access.access_allows_form(access, form_group_id);
  if (!allowed) return { found: true, allowed: false };

  const management = await project_access.resolve_form_management(user, project, form_group_id);
  const source = await resolve_dashboard_source(form_group_id, wanted);
  const form_version = source === "follow_up" ? await follow_up_schema_version(form_group_id) : source_version;
  if (!form_version) return { found: false };
  return {
    found: true,
    allowed: true,
    form_version,
    source_version,
    source,
    follow_up_group_id: form_version.follow_up_group_id || null,
    project,
    can_edit: management.edit_forms === true,
  };
}

module.exports = {
  load_form_dashboard_context,
};
