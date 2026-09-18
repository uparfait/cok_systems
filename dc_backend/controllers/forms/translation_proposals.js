const links_model = require("../../models/form_translation_links_model.js");
const proposals_model = require("../../models/form_translation_proposals_model.js");
const forms_model = require("../../models/forms_model.js");
const { validate_form_schema } = require("../../jsonlogic/validate_schema.js");
const { apply_texts, current_text } = require("../../utilities/translation_texts.js");
const { manager_context } = require("./translation_links.js");
const { strip_proposal } = require("./public_translation.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

const MAX_IDS = 500;

/**
 * The editor's side of a translation link: what its translator proposed,
 * and the three decisions - APPLY chosen proposals into the form (texts
 * only, the schema re-validated, the replaced text remembered), RESTORE
 * applied proposals (the remembered text written back), DISMISS pending
 * ones. Only users allowed to edit the form may decide.
 */

function ids_of(body) {
  const raw = body && Array.isArray(body.ids) ? body.ids : [];
  return raw.filter((id) => typeof id === "string" && id.trim()).slice(0, MAX_IDS);
}

async function link_of(req, res) {
  const context = await manager_context(req, res);
  if (!context) return null;
  const link = await links_model.get_link_by_id(req.params.link_id);
  if (!link || link.form_group_id !== req.params.form_group_id) {
    res.status(404).json(warning_response(req, "TRANSLATION_LINK_NOT_FOUND"));
    return null;
  }
  return Object.assign(context, { link });
}

/** Writes texts into the active version and stores it, re-validated. */
async function store_fields(active_version, fields, req) {
  const next_schema = Object.assign({}, active_version.schema, { fields });
  const validation_result = validate_form_schema(next_schema);
  if (!validation_result.valid) return validation_result;
  await forms_model.update_version_in_place(active_version.form_group_id, active_version.version, {
    form_name: active_version.form_name,
    form_name_normalized: active_version.form_name_normalized || String(active_version.form_name || "").toLowerCase(),
    schema: next_schema,
    approval_config: active_version.approval_config,
    updated_by: req.user.user_id.toString(),
    updated_by_name: req.user.full_name || "",
  });
  return { valid: true };
}

/** A proposal with what the form holds right now next to it. */
function with_current(active_version) {
  const fields = active_version.schema.fields || [];
  return (proposal) => Object.assign(strip_proposal(proposal), { current_value: current_text(fields, proposal.field_id, proposal.path, proposal.language), previous_value: proposal.previous_value === undefined ? null : proposal.previous_value, link_title: proposal.link_title || "" });
}

async function list_translation_proposals(req, res) {
  try {
    const context = await link_of(req, res);
    if (!context) return undefined;
    const proposals = await proposals_model.list_by_link(context.link._id.toString());
    return res.status(200).json(success_response(req, "TRANSLATION_PROPOSALS_FETCHED", { proposals: proposals.map(with_current(context.active_version)) }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

async function apply_translation_proposals(req, res) {
  try {
    const context = await link_of(req, res);
    if (!context) return undefined;
    const chosen = (await proposals_model.get_by_ids(ids_of(req.body))).filter((proposal) => proposal.link_id === context.link._id.toString() && proposal.status === "pending");
    if (chosen.length === 0) return res.status(400).json(warning_response(req, "TRANSLATION_NOTHING_SELECTED"));

    const active_version = context.active_version;
    const applied = apply_texts(active_version.schema.fields || [], chosen);
    const landed = chosen.map((proposal, index) => ({ proposal, result: applied.results[index] })).filter((entry) => entry.result !== null);
    if (landed.length === 0) return res.status(400).json(warning_response(req, "TRANSLATION_NO_CHANGES"));

    const stored = await store_fields(active_version, applied.fields, req);
    if (!stored.valid) return res.status(400).json(warning_response(req, "FORM_SCHEMA_INVALID", null, { errors: stored.errors }));

    await proposals_model.mark_applied(
      landed.map((entry) => ({ _id: entry.proposal._id, previous_value: entry.result.previous })),
      req.user.user_id.toString(),
    );
    return res.status(200).json(success_response(req, "TRANSLATION_PROPOSALS_APPLIED", { applied: landed.length, version: active_version.version }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

async function restore_translation_proposals(req, res) {
  try {
    const context = await link_of(req, res);
    if (!context) return undefined;
    const chosen = (await proposals_model.get_by_ids(ids_of(req.body))).filter((proposal) => proposal.link_id === context.link._id.toString() && proposal.status === "applied");
    if (chosen.length === 0) return res.status(400).json(warning_response(req, "TRANSLATION_NOTHING_SELECTED"));

    const active_version = context.active_version;
    // The remembered text goes back; a text that was empty before goes back to empty.
    const restored = apply_texts(
      active_version.schema.fields || [],
      chosen.map((proposal) => ({ field_id: proposal.field_id, path: proposal.path, language: proposal.language, value: proposal.previous_value === null || proposal.previous_value === undefined ? "" : proposal.previous_value })),
    );
    const landed = chosen.filter((proposal, index) => restored.results[index] !== null);
    if (landed.length === 0) return res.status(400).json(warning_response(req, "TRANSLATION_NO_CHANGES"));

    const stored = await store_fields(active_version, restored.fields, req);
    if (!stored.valid) return res.status(400).json(warning_response(req, "FORM_SCHEMA_INVALID", null, { errors: stored.errors }));

    await proposals_model.mark_restored(landed.map((proposal) => proposal._id), req.user.user_id.toString());
    return res.status(200).json(success_response(req, "TRANSLATION_PROPOSALS_RESTORED", { restored: landed.length, version: active_version.version }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

async function dismiss_translation_proposals(req, res) {
  try {
    const context = await link_of(req, res);
    if (!context) return undefined;
    const chosen = (await proposals_model.get_by_ids(ids_of(req.body))).filter((proposal) => proposal.link_id === context.link._id.toString() && proposal.status !== "applied");
    if (chosen.length === 0) return res.status(400).json(warning_response(req, "TRANSLATION_NOTHING_SELECTED"));
    const deleted = await proposals_model.delete_many(chosen.map((proposal) => proposal._id));
    return res.status(200).json(success_response(req, "TRANSLATION_PROPOSALS_DISMISSED", { dismissed: deleted }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = {
  list_translation_proposals,
  apply_translation_proposals,
  restore_translation_proposals,
  dismiss_translation_proposals,
};
