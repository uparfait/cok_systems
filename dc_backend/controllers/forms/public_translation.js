const links_model = require("../../models/form_translation_links_model.js");
const proposals_model = require("../../models/form_translation_proposals_model.js");
const forms_model = require("../../models/forms_model.js");
const { strip_lazy_options_from_fields } = require("../../jsonlogic/lazy_options.js");
const { read_changes, current_text, path_key, LANGUAGES } = require("../../utilities/translation_texts.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * The public side of a translation link, no sign-in: the token is the whole
 * authorization. GET hands over every field of the form's active version
 * (visibility ignored - a translator must see the hidden ones too), the
 * languages this link locks, and what this link has already saved. PUT
 * takes the translated texts and stores them as PROPOSALS: nothing is
 * written into the form until its editor reviews and applies them.
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

/** A proposal as the translator's page shows it: where, which language, what, and how far it got. */
function strip_proposal(proposal) {
  return {
    id: proposal._id.toString(),
    field_id: proposal.field_id,
    path: proposal.path,
    language: proposal.language,
    value: proposal.value,
    status: proposal.status,
    proposed_at: proposal.proposed_at,
    applied_at: proposal.applied_at || null,
  };
}

async function get_public_translation(req, res) {
  try {
    const context = await resolve_link(req, res);
    if (!context) return undefined;
    const { link, active_version } = context;
    await links_model.count_view(link._id);
    const proposals = await proposals_model.list_by_link(link._id.toString());
    return res.status(200).json(
      success_response(req, "TRANSLATION_FORM_FETCHED", {
        form_group_id: active_version.form_group_id,
        form_name: active_version.form_name,
        version: active_version.version,
        title: link.title,
        locked_languages: link.locked_languages || [],
        languages: LANGUAGES,
        fields: strip_lazy_options_from_fields(active_version.schema.fields || []),
        proposals: proposals.map(strip_proposal),
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
    const fields = active_version.schema.fields || [];
    const entries = read_changes(fields, (req.body || {}).changes, link.locked_languages || []);
    // A text saved unchanged is no proposal.
    const real = entries.filter((entry) => current_text(fields, entry.field_id, entry.path, entry.language) !== entry.value);
    if (real.length === 0) return res.status(400).json(warning_response(req, "TRANSLATION_NO_CHANGES"));

    for (const entry of real) {
      await proposals_model.upsert_pending({
        form_group_id: active_version.form_group_id,
        link_id: link._id.toString(),
        link_title: link.title || "",
        field_id: entry.field_id,
        path: entry.path,
        path_key: path_key(entry.path),
        language: entry.language,
        value: entry.value,
        original_value: current_text(fields, entry.field_id, entry.path, entry.language),
      });
    }
    await links_model.count_save(link._id);
    const proposals = await proposals_model.list_by_link(link._id.toString());
    return res.status(200).json(success_response(req, "TRANSLATION_SAVED", { saved: real.length, proposals: proposals.map(strip_proposal) }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = {
  get_public_translation,
  save_public_translation,
  strip_proposal,
};
