const links_model = require("../../models/form_translation_links_model.js");
const proposals_model = require("../../models/form_translation_proposals_model.js");
const translators_model = require("../../models/form_translators_model.js");
const forms_model = require("../../models/forms_model.js");
const projects_model = require("../../models/projects_model.js");
const project_access = require("../../utilities/project_access.js");
const { read_locked_languages } = require("../../utilities/translation_texts.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

const MAX_TITLE = 120;

/**
 * Managing a form's translation links: list, create and delete. Only users
 * allowed to EDIT the form may manage them - a link lets its holder rewrite
 * the form's texts, which is an edit of the form. A link is named for the
 * manager's own bookkeeping and records which kinds of text its holder may
 * not change. What its holder saves becomes PROPOSALS the editor applies.
 */

function strip_link(link, counts) {
  const own = (counts || {})[link._id.toString()] || {};
  return {
    id: link._id.toString(),
    token: link.token,
    title: link.title,
    locked_languages: link.locked_languages || [],
    pending: own.pending || 0,
    applied: own.applied || 0,
    views: link.views || 0,
    saves: link.saves || 0,
    last_saved_at: link.last_saved_at || null,
    created_by_name: link.created_by_name || "",
    created_at: link.created_at,
  };
}

async function manager_context(req, res) {
  const { form_group_id } = req.params;
  if (!form_group_id) {
    res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    return null;
  }
  const active_version = (await forms_model.get_active_version(form_group_id)) || (await forms_model.get_latest_version(form_group_id));
  if (!active_version) {
    res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    return null;
  }
  const project = await projects_model.find_project_by_id(active_version.project_id);
  const management = await project_access.resolve_form_management(req.user, project, form_group_id);
  if (!management.edit_forms) {
    res.status(403).json(warning_response(req, "FORM_ACTION_FORBIDDEN"));
    return null;
  }
  return { active_version, project };
}

async function list_translation_links(req, res) {
  try {
    const context = await manager_context(req, res);
    if (!context) return undefined;
    const links = await links_model.list_links_by_form(req.params.form_group_id);
    const counts = await proposals_model.count_by_link(req.params.form_group_id);
    return res.status(200).json(success_response(req, "TRANSLATION_LINKS_FETCHED", { links: links.map((link) => strip_link(link, counts)) }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

async function create_translation_link(req, res) {
  try {
    const context = await manager_context(req, res);
    if (!context) return undefined;
    const body = req.body || {};
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (title.length > MAX_TITLE) return res.status(400).json(warning_response(req, "TRANSLATION_LINK_TITLE_TOO_LONG"));
    const link = await links_model.create_link({
      form_group_id: req.params.form_group_id,
      project_id: context.project ? context.project._id.toString() : null,
      title: title || "Translation link",
      locked_languages: read_locked_languages(body.locked_languages),
      created_by: req.user.user_id.toString(),
      created_by_name: req.user.full_name || "",
    });
    return res.status(201).json(success_response(req, "TRANSLATION_LINK_CREATED", { link: strip_link(link) }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

async function delete_translation_link(req, res) {
  try {
    const context = await manager_context(req, res);
    if (!context) return undefined;
    const existing = await links_model.get_link_by_id(req.params.link_id);
    if (!existing || existing.form_group_id !== req.params.form_group_id) {
      return res.status(404).json(warning_response(req, "TRANSLATION_LINK_NOT_FOUND"));
    }
    await links_model.delete_link(existing._id);
    await proposals_model.delete_by_link(existing._id.toString());
    await translators_model.delete_by_link(existing._id.toString());
    return res.status(200).json(success_response(req, "TRANSLATION_LINK_DELETED", { id: existing._id.toString() }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = {
  manager_context,
  list_translation_links,
  create_translation_link,
  delete_translation_link,
};
