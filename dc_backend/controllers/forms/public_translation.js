const links_model = require("../../models/form_translation_links_model.js");
const proposals_model = require("../../models/form_translation_proposals_model.js");
const translators_model = require("../../models/form_translators_model.js");
const forms_model = require("../../models/forms_model.js");
const { strip_lazy_options_from_fields } = require("../../jsonlogic/lazy_options.js");
const { read_changes, current_text, path_key, LANGUAGES } = require("../../utilities/translation_texts.js");
const { sanitize_respondent } = require("../../utilities/respondent.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * The public side of a translation link, no sign-in: the token is the whole
 * authorization. Every translator first says who they are (name, email,
 * phone): a known email gets their saved texts and the page they stopped
 * on, an unknown one is created. GET hands over every field of the form's
 * active version, the languages this link locks, and every proposal saved
 * through the link, each naming its translator. PUT stores PROPOSALS -
 * nothing is written into the form until its editor applies them - and a
 * field one translator has already worked on is refused to any other, so
 * two people never touch the same text.
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

const email_of = (raw) => String(raw || "").trim().toLowerCase().slice(0, 120);

/** A translator as the request names them; null unless all three details are there. */
function translator_of(raw) {
  const translator = sanitize_respondent(raw);
  if (!translator || !translator.name || !translator.email || !translator.phone) return null;
  return translator;
}

/**
 * A proposal as a page shows it: where, which language, what, how far it
 * got and who wrote it. The public page sees the translator's name and
 * whether the proposal is the viewer's own; the editor sees the contact.
 */
function strip_proposal(proposal, viewer_email, full) {
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
    mine: !!(translator && viewer_email && translator.email === viewer_email),
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
    const viewer_email = email_of(req.query && req.query.email);
    const [proposals, translator] = await Promise.all([
      proposals_model.list_by_link(link._id.toString()),
      viewer_email ? translators_model.get_by_email(link._id.toString(), viewer_email) : null,
    ]);
    return res.status(200).json(
      success_response(req, "TRANSLATION_FORM_FETCHED", {
        form_group_id: active_version.form_group_id,
        form_name: active_version.form_name,
        version: active_version.version,
        title: link.title,
        locked_languages: link.locked_languages || [],
        languages: LANGUAGES,
        fields: strip_lazy_options_from_fields(active_version.schema.fields || []),
        proposals: proposals.map((proposal) => strip_proposal(proposal, viewer_email)),
        translator: translator_view(translator),
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

/**
 * Who is translating: finds them by email for this link or creates them,
 * remembers the page they are on, and answers with their record plus every
 * proposal of the link marked mine / not mine.
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
    const proposals = await proposals_model.list_by_link(link._id.toString());
    return res.status(200).json(
      success_response(req, "TRANSLATION_TRANSLATOR_FETCHED", {
        translator: translator_view(stored),
        proposals: proposals.map((proposal) => strip_proposal(proposal, translator.email)),
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

    // A field another translator already worked on through this link is
    // theirs: nobody else may change any of its texts.
    const link_id = link._id.toString();
    const existing = await proposals_model.list_by_link(link_id);
    const owner_by_field = new Map();
    existing.forEach((proposal) => {
      if (proposal.translator && proposal.translator.email && !owner_by_field.has(proposal.field_id)) owner_by_field.set(proposal.field_id, proposal.translator);
    });
    const taken = real.find((entry) => owner_by_field.has(entry.field_id) && owner_by_field.get(entry.field_id).email !== translator.email);
    if (taken) {
      return res.status(409).json(warning_response(req, "TRANSLATION_FIELD_TAKEN", { field_id: taken.field_id, translator: owner_by_field.get(taken.field_id).name }));
    }

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
    const proposals = await proposals_model.list_by_link(link_id);
    return res.status(200).json(success_response(req, "TRANSLATION_SAVED", { saved: real.length, proposals: proposals.map((proposal) => strip_proposal(proposal, translator.email)) }));
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
