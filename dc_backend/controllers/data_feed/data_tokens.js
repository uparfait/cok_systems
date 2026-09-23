const tokens_model = require("../../models/data_feed_tokens_model.js");
const { manager_context } = require("../forms/translation_links.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

const MAX_NAME = 80;
const EXPIRY_PRESETS = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 };

/**
 * The editor's side of data-feed tokens: list, create, rotate, revoke.
 * Only users allowed to edit the form may hand its data out. A token
 * carries a name, an expiry (a preset, a date, or never) and an optional
 * scope: one version and / or a date window every read stays inside.
 */
function strip_token(document) {
  return {
    id: document._id.toString(),
    name: document.name,
    token: document.token,
    expires_at: document.expires_at || null,
    expired: !!(document.expires_at && new Date(document.expires_at).getTime() < Date.now()),
    scope: document.scope || { version: null, from: null, to: null },
    uses: document.uses || 0,
    last_used_at: document.last_used_at || null,
    created_at: document.created_at,
    created_by_name: document.created_by_name || "",
  };
}

/** The expiry a request asks for: null (never), a preset, or a date; undefined when invalid. */
function read_expiry(body) {
  const raw = body && body.expires_in;
  if (raw === undefined || raw === null || raw === "" || raw === "never") return null;
  if (EXPIRY_PRESETS[raw]) return new Date(Date.now() + EXPIRY_PRESETS[raw] * 24 * 3600 * 1000);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) return undefined;
  return date;
}

function read_scope(body) {
  const raw = (body && body.scope) || {};
  const version = raw.version === undefined || raw.version === null || raw.version === "" ? null : Number(raw.version);
  const date_of = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  return { version: Number.isFinite(version) ? version : null, from: date_of(raw.from), to: date_of(raw.to) };
}

async function token_of(req, res, context) {
  const token = await tokens_model.get_by_id(req.params.token_id);
  if (!token || token.form_group_id !== req.params.form_group_id) {
    res.status(404).json(warning_response(req, "DATA_TOKEN_NOT_FOUND"));
    return null;
  }
  return token;
}

async function list_data_tokens(req, res) {
  try {
    const context = await manager_context(req, res);
    if (!context) return undefined;
    const tokens = await tokens_model.list_by_form(req.params.form_group_id);
    return res.status(200).json(success_response(req, "DATA_TOKENS_FETCHED", { tokens: tokens.map(strip_token) }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

async function create_data_token(req, res) {
  try {
    const context = await manager_context(req, res);
    if (!context) return undefined;
    const body = req.body || {};
    const name = String(body.name || "").trim().slice(0, MAX_NAME);
    if (!name) return res.status(400).json(warning_response(req, "DATA_TOKEN_NAME_REQUIRED"));
    const expires_at = read_expiry(body);
    if (expires_at === undefined) return res.status(400).json(warning_response(req, "DATA_TOKEN_EXPIRY_INVALID"));
    const token = await tokens_model.create_token({
      form_group_id: req.params.form_group_id,
      project_id: context.active_version.project_id,
      name,
      expires_at,
      scope: read_scope(body),
      created_by: req.user.user_id.toString(),
      created_by_name: req.user.full_name || "",
    });
    return res.status(201).json(success_response(req, "DATA_TOKEN_CREATED", strip_token(token)));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

async function rotate_data_token(req, res) {
  try {
    const context = await manager_context(req, res);
    if (!context) return undefined;
    const token = await token_of(req, res, context);
    if (!token) return undefined;
    const rotated = await tokens_model.rotate(token._id);
    return res.status(200).json(success_response(req, "DATA_TOKEN_ROTATED", strip_token(rotated)));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

async function delete_data_token(req, res) {
  try {
    const context = await manager_context(req, res);
    if (!context) return undefined;
    const token = await token_of(req, res, context);
    if (!token) return undefined;
    await tokens_model.delete_token(token._id);
    return res.status(200).json(success_response(req, "DATA_TOKEN_DELETED"));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = { list_data_tokens, create_data_token, rotate_data_token, delete_data_token, strip_token };
