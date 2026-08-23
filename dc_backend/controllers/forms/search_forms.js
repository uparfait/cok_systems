const forms_model = require("../../models/forms_model.js");
const projects_model = require("../../models/projects_model.js");
const project_access = require("../../utilities/project_access.js");
const { success_response, error_response } = require("../../utilities/response.js");

/**
 * Searches form names across every project at once, for the sidebar's
 * combined project/form search box - project name matching happens
 * entirely client-side against the already access-filtered project list,
 * but forms aren't preloaded globally, so finding one by name needs an
 * actual query here. Every candidate match is only returned once its own
 * project's access rules - and, within an accessible project, the grant's
 * specific form scope - are resolved for the requesting user, exactly the
 * same way a single project's own form list is filtered.
 */
async function search_forms(req, res) {
  try {
    const query = (req.query.q || "").toString().trim();
    if (!query) {
      return res.status(200).json(success_response(req, "FORMS_SEARCHED", []));
    }

    const candidates = await forms_model.search_latest_forms_by_name(query);
    if (candidates.length === 0) {
      return res.status(200).json(success_response(req, "FORMS_SEARCHED", []));
    }

    const project_ids = Array.from(new Set(candidates.map((form) => form.project_id)));
    const projects = await projects_model.find_projects_by_ids(project_ids);
    const project_by_id = new Map(projects.map((project) => [project._id.toString(), project]));

    const results = [];
    for (const form of candidates) {
      const project = project_by_id.get(form.project_id);
      if (!project) continue;
      const access = await project_access.resolve_project_access(req.user, project);
      if (!project_access.access_allows_form(access, form.form_group_id)) continue;
      results.push({
        form_group_id: form.form_group_id,
        form_name: form.form_name,
        project_id: project._id.toString(),
        project_name: project.name,
      });
    }

    return res.status(200).json(success_response(req, "FORMS_SEARCHED", results));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = search_forms;
