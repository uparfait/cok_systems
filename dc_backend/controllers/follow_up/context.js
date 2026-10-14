const forms_model = require("../../models/forms_model.js");
const follow_up_forms_model = require("../../models/follow_up_forms_model.js");
const projects_model = require("../../models/projects_model.js");
const project_access = require("../../utilities/project_access.js");
const { strip_creator } = require("../../utilities/owner.js");
const { warning_response } = require("../../utilities/response.js");

/**
 * What every authenticated follow-up route resolves first: the actual
 * form (its active, else latest, version), its project, whether the
 * caller may SEE the form's data (viewers) and whether they may EDIT the
 * form (editors - the same right that lets them change the form itself),
 * plus the follow-up's own versions when the form has one.
 */
async function load_follow_up_context(user, form_group_id) {
  const source_version = (await forms_model.get_active_version(form_group_id)) || (await forms_model.get_latest_version(form_group_id));
  if (!source_version) return { found: false };

  const project = await projects_model.find_project_by_id(source_version.project_id);
  const access = await project_access.resolve_project_access(user, project);
  if (!project_access.access_allows_form(access, form_group_id)) return { found: true, allowed: false };

  const management = await project_access.resolve_form_management(user, project, form_group_id);
  const latest = await follow_up_forms_model.get_by_group(form_group_id);
  const versions = latest ? await follow_up_forms_model.get_versions(latest.follow_up_group_id) : [];
  return {
    found: true,
    allowed: true,
    source_version,
    project,
    can_edit: management.edit_forms === true,
    follow_up_group_id: latest ? latest.follow_up_group_id : null,
    versions,
    active: versions.find((entry) => entry.is_active) || null,
  };
}

/** The context for anyone allowed to see the form's data; answers the refusal itself and returns null. */
async function viewer_context(req, res) {
  const { form_group_id } = req.params;
  if (!form_group_id) {
    res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    return null;
  }
  const context = await load_follow_up_context(req.user, form_group_id);
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

/** The context for form editors only. */
async function editor_context(req, res) {
  const context = await viewer_context(req, res);
  if (!context) return null;
  if (!context.can_edit) {
    res.status(403).json(warning_response(req, "FORM_ACTION_FORBIDDEN"));
    return null;
  }
  return context;
}

/** A viewer context that also requires the form to HAVE a follow-up; 404 otherwise. */
async function existing_viewer_context(req, res) {
  const context = await viewer_context(req, res);
  if (!context) return null;
  if (!context.follow_up_group_id) {
    res.status(404).json(warning_response(req, "FOLLOW_UP_NOT_FOUND"));
    return null;
  }
  return context;
}

/** An editor context that also requires the form to HAVE a follow-up; 404 otherwise. */
async function existing_editor_context(req, res) {
  const context = await editor_context(req, res);
  if (!context) return null;
  if (!context.follow_up_group_id) {
    res.status(404).json(warning_response(req, "FOLLOW_UP_NOT_FOUND"));
    return null;
  }
  return context;
}

/** A follow-up version as the routes return it: never the author's identity. */
function strip_follow_up(version) {
  return version ? strip_creator(version) : null;
}

module.exports = {
  load_follow_up_context,
  viewer_context,
  editor_context,
  existing_viewer_context,
  existing_editor_context,
  strip_follow_up,
};
