const dashboard_links_model = require("../dashboard_links_model.js");
const dashboards_model = require("../dashboards_model.js");
const { sanitize_applied_filters } = require("../board_filters.js");
const { PERIOD_PRESETS } = require("../constants.js");
const { load_form_dashboard_context } = require("../form_context.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 300;

/**
 * Managing a form dashboard's public share links: list, create, edit and
 * delete. Only users allowed to EDIT the form may manage its links (the
 * same right that lets them change the dashboard itself). A link carries a
 * title and description for the manager's own bookkeeping and an optional
 * expiry; without one it never expires.
 */

function strip_link(link) {
  return {
    id: link._id.toString(),
    dashboard_id: link.dashboard_id || null,
    token: link.token,
    title: link.title,
    description: link.description || "",
    expires_at: link.expires_at || null,
    config: link_config(link),
    expired: dashboard_links_model.is_expired(link),
    views: link.views || 0,
    last_viewed_at: link.last_viewed_at || null,
    created_by_name: link.created_by_name || "",
    created_at: link.created_at,
    updated_at: link.updated_at,
  };
}

/**
 * A link's viewing configuration: whether viewers may filter the board
 * themselves ("free") or see it under filter values fixed here ("locked"),
 * (and, optionally, a fixed period), and whether the link's title replaces
 * the dashboard's name for them.
 */
function link_config(link) {
  const config = (link && link.config) || {};
  return {
    filter_mode: config.filter_mode === "locked" ? "locked" : "free",
    locked_filters: Array.isArray(config.locked_filters) ? config.locked_filters : [],
    locked_period: config.locked_period || null,
    show_title: config.show_title === true,
  };
}

/** A fixed period for viewers: a known preset; "custom" needs a valid from date. */
function read_period(raw) {
  if (!raw || typeof raw !== "object" || !PERIOD_PRESETS.includes(raw.preset)) return null;
  const from = typeof raw.from === "string" && raw.from ? raw.from : null;
  const to = typeof raw.to === "string" && raw.to ? raw.to : null;
  if (raw.preset === "custom" && (!from || Number.isNaN(new Date(from).getTime()))) return null;
  return { preset: raw.preset, from, to };
}

function read_config(body) {
  const raw = body && body.config && typeof body.config === "object" ? body.config : {};
  const filter_mode = raw.filter_mode === "locked" ? "locked" : "free";
  return {
    filter_mode,
    locked_filters: filter_mode === "locked" ? sanitize_applied_filters(raw.locked_filters) : [],
    locked_period: filter_mode === "locked" ? read_period(raw.locked_period) : null,
    show_title: raw.show_title === true,
  };
}

/** Reads and checks the editable fields of a link from a request body. */
function read_link_fields(body) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!title || title.length > MAX_TITLE) return { error: "DASHBOARD_LINK_TITLE_REQUIRED" };
  if (description.length > MAX_DESCRIPTION) return { error: "DASHBOARD_LINK_DESCRIPTION_TOO_LONG" };
  let expires_at = null;
  if (body.never_expires !== true && body.expires_at) {
    const date = new Date(body.expires_at);
    if (Number.isNaN(date.getTime())) return { error: "DASHBOARD_LINK_EXPIRY_INVALID" };
    if (date.getTime() <= Date.now()) return { error: "DASHBOARD_LINK_EXPIRY_PAST" };
    expires_at = date;
  }
  return { fields: { title, description, expires_at, config: read_config(body) } };
}

async function manager_context(req, res) {
  const { form_group_id } = req.params;
  if (!form_group_id) {
    res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    return null;
  }
  const context = await load_form_dashboard_context(req.user, form_group_id);
  if (!context.found) {
    res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    return null;
  }
  if (!context.allowed || !context.can_edit) {
    res.status(403).json(warning_response(req, "ACCESS_DENIED"));
    return null;
  }
  return context;
}

async function list_dashboard_links(req, res) {
  try {
    const context = await manager_context(req, res);
    if (!context) return undefined;
    // Scoped to one dashboard when asked (?dashboard_id=...), the whole form otherwise.
    const links = await dashboard_links_model.list_links_by_form(req.params.form_group_id, (req.query || {}).dashboard_id);
    return res.status(200).json(success_response(req, "DASHBOARD_LINKS_FETCHED", { links: links.map(strip_link) }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

async function create_dashboard_link(req, res) {
  try {
    const context = await manager_context(req, res);
    if (!context) return undefined;
    const read = read_link_fields(req.body || {});
    if (read.error) return res.status(400).json(warning_response(req, read.error));
    // A link shares ONE dashboard: the one named in the body, or the form's
    // first when an older client names none.
    const requested_id = typeof (req.body || {}).dashboard_id === "string" ? req.body.dashboard_id : "";
    const target = requested_id ? await dashboards_model.get_dashboard_by_id(req.params.form_group_id, requested_id) : await dashboards_model.get_dashboard_by_form(req.params.form_group_id);
    if (!target) return res.status(404).json(warning_response(req, "DASHBOARD_NOT_FOUND"));
    const link = await dashboard_links_model.create_link(
      Object.assign({}, read.fields, {
        form_group_id: req.params.form_group_id,
        dashboard_id: target._id.toString(),
        project_id: context.project._id.toString(),
        created_by: req.user.user_id.toString(),
        created_by_name: req.user.full_name || "",
      }),
    );
    return res.status(201).json(success_response(req, "DASHBOARD_LINK_CREATED", { link: strip_link(link) }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

async function update_dashboard_link(req, res) {
  try {
    const context = await manager_context(req, res);
    if (!context) return undefined;
    const existing = await dashboard_links_model.get_link_by_id(req.params.link_id);
    if (!existing || existing.form_group_id !== req.params.form_group_id) {
      return res.status(404).json(warning_response(req, "DASHBOARD_LINK_NOT_FOUND"));
    }
    const read = read_link_fields(req.body || {});
    if (read.error) return res.status(400).json(warning_response(req, read.error));
    const link = await dashboard_links_model.update_link(existing._id, read.fields);
    return res.status(200).json(success_response(req, "DASHBOARD_LINK_UPDATED", { link: strip_link(link) }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

async function delete_dashboard_link(req, res) {
  try {
    const context = await manager_context(req, res);
    if (!context) return undefined;
    const existing = await dashboard_links_model.get_link_by_id(req.params.link_id);
    if (!existing || existing.form_group_id !== req.params.form_group_id) {
      return res.status(404).json(warning_response(req, "DASHBOARD_LINK_NOT_FOUND"));
    }
    await dashboard_links_model.delete_link(existing._id);
    return res.status(200).json(success_response(req, "DASHBOARD_LINK_DELETED", { id: existing._id.toString() }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = {
  list_dashboard_links,
  create_dashboard_link,
  update_dashboard_link,
  delete_dashboard_link,
};
