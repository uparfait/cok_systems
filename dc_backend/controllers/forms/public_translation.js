const links_model = require("../../models/form_translation_links_model.js");
const proposals_model = require("../../models/form_translation_proposals_model.js");
const translators_model = require("../../models/form_translators_model.js");
const forms_model = require("../../models/forms_model.js");
const { strip_lazy_options_from_fields } = require("../../jsonlogic/lazy_options.js");
const { read_changes, current_text, path_key, LANGUAGES } = require("../../utilities/translation_texts.js");
const { sanitize_respondent } = require("../../utilities/respondent.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * The public side of a translation link, no sign-in: the token opens the
 * link, but the texts themselves are handed over only to an identified
 * translator. GET says which form it is and which languages the link locks
 * - nothing to translate yet. The translator then says who they are (name,
 * email, phone): a known email gets back their saved texts and the page
 * they stopped on, an unknown one is created; that answer carries every
 * field of the form's active version exactly as the form holds it, plus
 * that translator's OWN proposals only - translators never see each
 * other's work and every one of them may change any text. PUT stores
 * PROPOSALS per translator; nothing is written into the form until its
 * editor picks a translator and applies their texts.
 */
async function resolve_link(req, res) {
  const link = await links_model.get_link_by_token(req.params.token);
  if (!link) {
    res.status(404).json(warning_response(req, "TRANSLATION_LINK_NOT_FOUND"));
    return null;
  }
  const active_version = await forms_model.get_active_version(link.form_group_id);
  if (!active_version) {
    res.status(404).json(warning_response(req, "FORM_PUBLIC_NOT_FOUND"));
    return null;
  }
  return { link, active_version };
}

/** A translator as the request names them; null unless all three details are there. */
function translator_of(raw) {
  const translator = sanitize_respondent(raw);
  if (!translator || !translator.name || !translator.email || !translator.phone) return null;
  return translator;
}

/**
 * A proposal as a page shows it: where, which language, what, how far it
 * got and who wrote it (name only on the public page, the contact for the
 * editor).
 */
function strip_proposal(proposal, full) {
  const translator = proposal.translator || null;
  return {
    id: proposal._id.toString(),
    field_id: proposal.field_id,
    path: proposal.path,
    language: proposal.language,
    value: proposal.value,
    status: proposal.status,
    proposed_at: proposal.proposed_at,
    applied_at: proposal.applied_at || null,
    translator: translator ? (full ? translator : { name: translator.name }) : null,
  };
}

function translator_view(document) {
  if (!document) return null;
  return { name: document.name, email: document.email, phone: document.phone, last_page: document.last_page || 0, created_at: document.created_at };
}

async function get_public_translation(req, res) {
  try {
    const context = await resolve_link(req, res);
    if (!context) return undefined;
    const { link, active_version } = context;
    await links_model.count_view(link._id);
    return res.status(200).json(
      success_response(req, "TRANSLATION_FORM_FETCHED", {
        form_group_id: active_version.form_group_id,
        form_name: active_version.form_name,
        version: active_version.version,
        title: link.title,
        locked_languages: link.locked_languages || [],
        languages: LANGUAGES,
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

/**
 * Who is translating: finds them by email for this link or creates them,
 * remembers the page they are on, and answers with their record, the
 * fields to translate as the form holds them and this translator's own
 * proposals - nobody else's. This is the only way the texts leave the server.
 */
async function identify_translator(req, res) {
  try {
    const context = await resolve_link(req, res);
    if (!context) return undefined;
    const { link, active_version } = context;
    const translator = translator_of((req.body || {}).translator);
    if (!translator) return res.status(400).json(warning_response(req, "TRANSLATION_TRANSLATOR_REQUIRED"));
    const page = Number.isInteger((req.body || {}).page) ? (req.body || {}).page : undefined;
    const stored = await translators_model.upsert(link._id.toString(), active_version.form_group_id, translator, page);
    const proposals = await proposals_model.list_by_translator(link._id.toString(), translator.email);
    return res.status(200).json(
      success_response(req, "TRANSLATION_TRANSLATOR_FETCHED", {
        translator: translator_view(stored),
        fields: strip_lazy_options_from_fields(active_version.schema.fields || []),
        proposals: proposals.map((proposal) => strip_proposal(proposal)),
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

async function save_public_translation(req, res) {
  try {
    const context = await resolve_link(req, res);
    if (!context) return undefined;
    const { link, active_version } = context;
    const body = req.body || {};
    const translator = translator_of(body.translator);
    if (!translator) return res.status(400).json(warning_response(req, "TRANSLATION_TRANSLATOR_REQUIRED"));

    const fields = active_version.schema.fields || [];
    const entries = read_changes(fields, body.changes, link.locked_languages || []);
    // A text saved unchanged is no proposal.
    const real = entries.filter((entry) => current_text(fields, entry.field_id, entry.path, entry.language) !== entry.value);
    if (real.length === 0) return res.status(400).json(warning_response(req, "TRANSLATION_NO_CHANGES"));

    const link_id = link._id.toString();
    for (const entry of real) {
      await proposals_model.upsert_pending({
        form_group_id: active_version.form_group_id,
        link_id,
        link_title: link.title || "",
        field_id: entry.field_id,
        path: entry.path,
        path_key: path_key(entry.path),
        language: entry.language,
        value: entry.value,
        original_value: current_text(fields, entry.field_id, entry.path, entry.language),
        translator,
      });
    }
    const page = Number.isInteger(body.page) ? body.page : undefined;
    await Promise.all([links_model.count_save(link._id), translators_model.upsert(link_id, active_version.form_group_id, translator, page)]);
    const proposals = await proposals_model.list_by_translator(link_id, translator.email);
    return res.status(200).json(success_response(req, "TRANSLATION_SAVED", { saved: real.length, proposals: proposals.map((proposal) => strip_proposal(proposal)) }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = {
  get_public_translation,
  identify_translator,
  save_public_translation,
  strip_proposal,
};
