const forms_model = require("../models/forms_model.js");
const projects_model = require("../models/projects_model.js");
const dashboard_links_model = require("./dashboard_links_model.js");
const { resolve_dashboard_source, follow_up_schema_version } = require("./data_source.js");

/**
 * Resolves a PUBLIC dashboard request from its share token alone: the link,
 * whether it is still live, the form's active version (its schema drives
 * validation and aggregation exactly as for a signed-in viewer) and its
 * project. No user is involved - the token is the whole authorization, and
 * it only ever grants read access to this one form's dashboard.
 *
 * dashboard_id (optional) is the dashboard the request is about among
 * those the link opens, the link's own when none is named. A dashboard
 * created on the form's follow-up data makes form_version the follow-up's
 * schema document (see data_source.js), so the shared board reads the
 * follow-up's records exactly as it does for a signed-in viewer.
 */
async function load_public_dashboard_context(token, dashboard_id) {
  const link = await dashboard_links_model.get_link_by_token(token);
  if (!link) return { found: false };
  if (dashboard_links_model.is_expired(link)) return { found: true, expired: true, link };

  const source_version = (await forms_model.get_active_version(link.form_group_id)) || (await forms_model.get_latest_version(link.form_group_id));
  if (!source_version) return { found: false };
  const project = await projects_model.find_project_by_id(source_version.project_id);
  if (!project) return { found: false };

  const source = await resolve_dashboard_source(link.form_group_id, { dashboard_id: dashboard_id || link.dashboard_id || "" });
  const form_version = source === "follow_up" ? await follow_up_schema_version(link.form_group_id) : source_version;
  if (!form_version) return { found: false };

  return { found: true, expired: false, link, form_version, source_version, source, follow_up_group_id: form_version.follow_up_group_id || null, project };
}

module.exports = {
  load_public_dashboard_context,
};
