const forms_model = require("../models/forms_model.js");
const projects_model = require("../models/projects_model.js");
const dashboard_links_model = require("./dashboard_links_model.js");

/**
 * Resolves a PUBLIC dashboard request from its share token alone: the link,
 * whether it is still live, the form's active version (its schema drives
 * validation and aggregation exactly as for a signed-in viewer) and its
 * project. No user is involved - the token is the whole authorization, and
 * it only ever grants read access to this one form's dashboard.
 */
async function load_public_dashboard_context(token) {
  const link = await dashboard_links_model.get_link_by_token(token);
  if (!link) return { found: false };
  if (dashboard_links_model.is_expired(link)) return { found: true, expired: true, link };

  const form_version = (await forms_model.get_active_version(link.form_group_id)) || (await forms_model.get_latest_version(link.form_group_id));
  if (!form_version) return { found: false };
  const project = await projects_model.find_project_by_id(form_version.project_id);
  if (!project) return { found: false };

  return { found: true, expired: false, link, form_version, project };
}

module.exports = {
  load_public_dashboard_context,
};
