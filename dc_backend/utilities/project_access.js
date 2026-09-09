const project_access_model = require("../models/project_access_model.js");
const projects_model = require("../models/projects_model.js");
const forms_model = require("../models/forms_model.js");
const departments_model = require("../models/departments_model.js");

/**
 * Central place that answers "may this user see this project, and which of
 * its forms" from the per-project access rules. Visibility is driven
 * entirely by access control: a project without enabled rules is visible
 * ONLY to its creator, and the creator always keeps full access no matter
 * what the rules say. A user who created forms inside a project also keeps
 * sight of the project and of exactly those forms, even without any grant.
 */

const FULL_ACCESS = { can_view: true, all_forms: true, form_group_ids: [] };
const NO_ACCESS = { can_view: false, all_forms: false, form_group_ids: [] };

const FULL_MANAGEMENT = { add_forms: true, edit_forms: true, delete_forms: true, share_forms: true, edit_project: true };
const NO_MANAGEMENT = { add_forms: false, edit_forms: false, delete_forms: false, share_forms: false, edit_project: false };

/**
 * True when the main system marks this account as a department leader - a
 * head of department is matched against their whole department, every unit
 * included, never narrowed down to one unit.
 */
function is_department_head(user) {
  return String(user?.role || "").trim().toLowerCase() === "head of department";
}

/**
 * Resolves the requesting user's place in the org chart once per request:
 * their top-level department id, their unit id when they sit in one, and
 * whether they lead the department.
 */
async function get_user_org_context(user) {
  if (!user || !user.department_id) return null;
  const context = await departments_model.get_department_context(user.department_id);
  if (!context) return null;
  return Object.assign({}, context, { is_department_head: is_department_head(user) });
}

/**
 * True when one department grant covers the user's department or unit.
 * Department and unit are checked BOTH ways: when either side carries only
 * a department (the grant covers every unit, or the user sits directly in
 * the department), matching departments is enough; when both carry a unit,
 * the user's own unit must be listed. A head of department matches every
 * grant of their department - they oversee all of its units.
 */
function department_grant_matches(grant, org_context) {
  if (!org_context || !org_context.department_id) return false;
  if (grant.department_id !== org_context.department_id) return false;
  if (org_context.is_department_head === true) return true;
  if (!org_context.unit_id) return true;
  if (grant.all_units === true) return true;
  return (grant.units || []).some((unit) => unit.unit_id === org_context.unit_id);
}

/**
 * Folds the form scope of every matching grant into one answer - any grant
 * with all_forms opens every form, otherwise the allowed sets are unioned.
 */
function combine_grants(grants) {
  if (grants.length === 0) return NO_ACCESS;
  if (grants.some((grant) => grant.all_forms === true)) return FULL_ACCESS;
  const form_group_ids = new Set();
  grants.forEach((grant) => (grant.form_group_ids || []).forEach((id) => form_group_ids.add(id)));
  return { can_view: true, all_forms: false, form_group_ids: Array.from(form_group_ids) };
}

/**
 * Answers what one user may see of one project. access_document,
 * org_context and own_form_group_ids can be preloaded by list endpoints to
 * avoid repeated queries. Without enabled rules the project belongs to its
 * creator alone; whatever the rules say, a user always keeps sight of the
 * forms they created themselves - and of the project holding them.
 */
async function resolve_project_access(user, project, access_document, org_context, own_form_group_ids) {
  if (!project) return NO_ACCESS;
  if (user && project.created_by === user.user_id.toString()) return FULL_ACCESS;

  let granted = NO_ACCESS;
  if (project.access_control_enabled === true) {
    const access =
      access_document !== undefined ? access_document : await project_access_model.get_access_by_project(project._id);
    if (access && access.enabled === true) {
      const org = org_context !== undefined ? org_context : await get_user_org_context(user);

      const matching = [];
      (access.individuals || []).forEach((individual) => {
        if (user && individual.user_id === user.user_id.toString()) matching.push(individual);
      });
      (access.departments || []).forEach((grant) => {
        if (department_grant_matches(grant, org)) matching.push(grant);
      });

      granted = combine_grants(matching);
    }
  }
  if (granted.all_forms) return granted;

  const own_ids =
    own_form_group_ids !== undefined
      ? own_form_group_ids
      : user
        ? await forms_model.get_form_group_ids_created_by(project._id, user.user_id.toString())
        : [];
  if (own_ids.length === 0) return granted;

  const form_group_ids = Array.from(new Set([...granted.form_group_ids, ...own_ids]));
  return { can_view: true, all_forms: false, form_group_ids };
}

/**
 * True when a resolved access answer exposes one specific form.
 */
function access_allows_form(access, form_group_id) {
  if (!access.can_view) return false;
  if (access.all_forms) return true;
  return access.form_group_ids.includes(form_group_id);
}

/**
 * Filters a projects list down to the ones the user may see: their own
 * projects, projects whose access rules cover their department/unit (or
 * them personally), and projects holding forms they created. Access rules
 * of every foreign project are fetched in one query, the user's org context
 * is resolved once, and their own created forms are mapped in one query.
 */
async function filter_projects_for_user(user, projects) {
  const user_id = user.user_id.toString();
  const foreign = projects.filter((project) => project.created_by !== user_id);
  if (foreign.length === 0) return projects;

  const access_documents = await project_access_model.get_access_for_projects(foreign.map((project) => project._id));
  const access_by_project = new Map(access_documents.map((document) => [document.project_id, document]));
  const org_context = await get_user_org_context(user);
  const own_forms_by_project = await forms_model.map_form_groups_created_by(user_id);

  const visible = [];
  for (const project of projects) {
    const access = await resolve_project_access(
      user,
      project,
      access_by_project.get(project._id.toString()) || null,
      org_context,
      own_forms_by_project.get(project._id.toString()) || [],
    );
    if (access.can_view) visible.push(project);
  }
  return visible;
}

/**
 * Answers whether a user may manage a project's access rules: the creator
 * always can, and so can any individual - or member of a granted department
 * or unit - holding the share/grant option (manage.share_forms, or the
 * older can_grant flag on individuals).
 */
async function can_manage_access(user, project, access_document) {
  if (!user || !project) return false;
  if (project.created_by === user.user_id.toString()) return true;

  const access =
    access_document !== undefined ? access_document : await project_access_model.get_access_by_project(project._id);
  if (!access) return false;

  const granted_as_individual = (access.individuals || []).some(
    (individual) =>
      individual.user_id === user.user_id.toString() &&
      (individual.can_grant === true || individual.manage?.share_forms === true),
  );
  if (granted_as_individual) return true;

  const sharing_departments = (access.departments || []).filter((grant) => grant.manage?.share_forms === true);
  if (sharing_departments.length === 0) return false;
  const org = await get_user_org_context(user);
  return sharing_departments.some((grant) => department_grant_matches(grant, org));
}

/**
 * Answers which management actions a user may perform on a project
 * (add/edit/delete/share its forms, edit the project's own details). The
 * creator can do everything, and a project
 * without enabled access rules keeps today's open behavior. Otherwise the
 * user's individual grants - and the grants of their department or unit -
 * decide: the grant option (share_forms) is the full level and implies
 * every action, while hand-picked accesses apply one by one. add/delete
 * only ever come from a project-wide (all_forms) grant; edit/share also
 * apply to a form-specific grant - but only for the forms that grant
 * covers, which is why form_group_id narrows the answer when checking one
 * form.
 */
async function resolve_form_management(user, project, form_group_id, access_document) {
  if (!user || !project) return NO_MANAGEMENT;
  if (project.created_by === user.user_id.toString()) return FULL_MANAGEMENT;

  const access =
    project.access_control_enabled === true
      ? access_document !== undefined
        ? access_document
        : await project_access_model.get_access_by_project(project._id)
      : null;
  // Without enabled rules the project is the creator's alone - nobody else
  // manages anything in it, except a form they created themselves (below).
  if (!access || access.enabled !== true) {
    return Object.assign({}, NO_MANAGEMENT, {
      edit_forms: !!form_group_id && (await forms_model.is_form_group_created_by(form_group_id, user.user_id.toString())),
    });
  }

  const matching = [];
  (access.individuals || []).forEach((individual) => {
    if (individual.user_id !== user.user_id.toString()) return;
    matching.push({ grant: individual, legacy_can_grant: individual.can_grant === true });
  });
  // The org lookup is only paid when a department grant actually carries
  // management actions - plain view-only department grants skip it.
  const managing_departments = (access.departments || []).filter((grant) => grant.manage);
  if (managing_departments.length > 0) {
    const org = await get_user_org_context(user);
    managing_departments.forEach((grant) => {
      if (department_grant_matches(grant, org)) matching.push({ grant, legacy_can_grant: false });
    });
  }

  const result = Object.assign({}, NO_MANAGEMENT);
  matching.forEach(({ grant, legacy_can_grant }) => {
    const manage = grant.manage || {};
    const has_grant_option = manage.share_forms === true || legacy_can_grant;
    const covers_form =
      grant.all_forms === true || !form_group_id || (grant.form_group_ids || []).includes(form_group_id);

    if (grant.all_forms === true) {
      if (manage.add_forms === true || has_grant_option) result.add_forms = true;
      if (manage.delete_forms === true || has_grant_option) result.delete_forms = true;
      if (manage.edit_project === true || has_grant_option) result.edit_project = true;
    }
    if (covers_form) {
      if (manage.edit_forms === true || has_grant_option) result.edit_forms = true;
      if (has_grant_option) result.share_forms = true;
    }
  });
  // Whatever the grants say, a form's own creator may always edit it.
  if (form_group_id && result.edit_forms !== true) {
    result.edit_forms = await forms_model.is_form_group_created_by(form_group_id, user.user_id.toString());
  }
  return result;
}

/**
 * Answers whether a user may see one form, found via the form's project -
 * used by every form-scoped endpoint (details, versions, submissions).
 */
async function can_view_form_group(user, form_group_id) {
  const form = await forms_model.get_latest_version(form_group_id);
  if (!form) return { found: false, allowed: false };

  const project = await projects_model.find_project_by_id(form.project_id);
  const access = await resolve_project_access(user, project);
  return { found: true, allowed: access_allows_form(access, form_group_id) };
}

module.exports = {
  resolve_project_access,
  access_allows_form,
  filter_projects_for_user,
  can_view_form_group,
  can_manage_access,
  resolve_form_management,
};
