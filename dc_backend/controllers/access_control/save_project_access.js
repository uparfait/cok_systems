const projects_model = require("../../models/projects_model.js");
const project_access_model = require("../../models/project_access_model.js");
const project_access = require("../../utilities/project_access.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { is_valid_object_id } = require("../../utilities/object_id.js");

/**
 * Normalizes one department grant, keeping only the fields the model knows.
 */
function clean_department_grant(grant) {
  if (!grant || !grant.department_id || !grant.department_name) return null;
  return {
    department_id: grant.department_id.toString(),
    department_name: grant.department_name.toString(),
    all_units: grant.all_units === true,
    units:
      grant.all_units === true
        ? []
        : (Array.isArray(grant.units) ? grant.units : [])
            .filter((unit) => unit && unit.unit_id && unit.unit_name)
            .map((unit) => ({ unit_id: unit.unit_id.toString(), unit_name: unit.unit_name.toString() })),
    all_forms: grant.all_forms === true,
    form_group_ids:
      grant.all_forms === true
        ? []
        : (Array.isArray(grant.form_group_ids) ? grant.form_group_ids : []).map((id) => id.toString()),
  };
}

/**
 * Normalizes the management actions of one individual grant. add/delete
 * only make sense on a project-wide (all_forms) grant, so they are forced
 * off on form-specific grants; share_forms is the "with grant option"
 * level - the person may also manage this project's access rules.
 */
function clean_manage_options(manage, all_forms, legacy_can_grant) {
  // A payload without a manage object comes from an older client - its
  // can_grant flag still decides the share level.
  const options = manage && typeof manage === "object" ? manage : { share_forms: legacy_can_grant === true };
  return {
    add_forms: all_forms === true && options.add_forms === true,
    edit_forms: options.edit_forms === true,
    delete_forms: all_forms === true && options.delete_forms === true,
    share_forms: options.share_forms === true,
  };
}

/**
 * Normalizes one individual grant - the email must already have been
 * checked against the main system through the check-email endpoint.
 * can_grant mirrors manage.share_forms for older readers of the document.
 */
function clean_individual_grant(grant) {
  if (!grant || !grant.user_id || !grant.email) return null;
  const all_forms = grant.all_forms === true;
  const manage = clean_manage_options(grant.manage, all_forms, grant.can_grant);
  return {
    user_id: grant.user_id.toString(),
    email: grant.email.toString().trim().toLowerCase(),
    full_name: grant.full_name ? grant.full_name.toString() : "",
    manage,
    can_grant: manage.share_forms,
    all_forms,
    form_group_ids: all_forms
      ? []
      : (Array.isArray(grant.form_group_ids) ? grant.form_group_ids : []).map((id) => id.toString()),
  };
}

/**
 * Saves a project's access rules (who may view it and which forms), and
 * mirrors the enabled flag onto the project so lists can filter cheaply.
 */
async function save_project_access(req, res) {
  try {
    const { project_id } = req.params;

    if (!is_valid_object_id(project_id)) {
      return res.status(400).json(warning_response(req, "INVALID_ID"));
    }

    const project = await projects_model.find_project_by_id(project_id);
    if (!project) {
      return res.status(404).json(warning_response(req, "PROJECT_NOT_FOUND"));
    }

    if (!(await project_access.can_manage_access(req.user, project))) {
      return res.status(403).json(warning_response(req, "ACCESS_MANAGE_FORBIDDEN"));
    }

    const { enabled, departments, individuals } = req.body || {};

    const department_grants = (Array.isArray(departments) ? departments : []).map(clean_department_grant);
    const individual_grants = (Array.isArray(individuals) ? individuals : []).map(clean_individual_grant);
    if (department_grants.includes(null) || individual_grants.includes(null)) {
      return res.status(400).json(warning_response(req, "ACCESS_RULES_INVALID"));
    }

    const rules = await project_access_model.save_access(project_id, {
      enabled: enabled === true,
      departments: department_grants,
      individuals: individual_grants,
      updated_by: req.user.user_id.toString(),
      updated_by_name: req.user.full_name,
    });

    await projects_model.update_project(project_id, { access_control_enabled: enabled === true });

    return res.status(200).json(success_response(req, "ACCESS_RULES_SAVED", rules));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = save_project_access;
