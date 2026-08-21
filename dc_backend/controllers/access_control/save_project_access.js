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
 * Normalizes one individual grant - the email must already have been
 * checked against the main system through the check-email endpoint.
 * can_grant is the "with grant option" level: the person may also manage
 * this project's access rules, not just view its forms.
 */
function clean_individual_grant(grant) {
  if (!grant || !grant.user_id || !grant.email) return null;
  return {
    user_id: grant.user_id.toString(),
    email: grant.email.toString().trim().toLowerCase(),
    full_name: grant.full_name ? grant.full_name.toString() : "",
    can_grant: grant.can_grant === true,
    all_forms: grant.all_forms === true,
    form_group_ids:
      grant.all_forms === true
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
