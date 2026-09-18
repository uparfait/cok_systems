const links_model = require("../../models/form_translation_links_model.js");
const forms_model = require("../../models/forms_model.js");
const { strip_lazy_options_from_fields } = require("../../jsonlogic/lazy_options.js");
const { validate_form_schema } = require("../../jsonlogic/validate_schema.js");
const { apply_translation_changes, TEXT_KINDS, LANGUAGES } = require("../../utilities/translation_texts.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * The public side of a translation link, no sign-in: the token is the whole
 * authorization. GET hands over every field of the form's active version
 * (visibility ignored - a translator must see the hidden ones too) with the
 * kinds of text this link locks; PUT takes the translated texts and writes
 * them into that same version in place. Only texts change - the schema is
 * re-validated before it is stored, so a translation can never break the
 * form.
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
        locked_kinds: link.locked_kinds || [],
        text_kinds: TEXT_KINDS,
        languages: LANGUAGES,
        fields: strip_lazy_options_from_fields(active_version.schema.fields || []),
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
    const changes = (req.body || {}).changes;
    const applied = apply_translation_changes(active_version.schema.fields || [], changes, link.locked_kinds || []);
    if (applied.applied === 0) return res.status(400).json(warning_response(req, "TRANSLATION_NO_CHANGES"));

    const next_schema = Object.assign({}, active_version.schema, { fields: applied.fields });
    const validation_result = validate_form_schema(next_schema);
    if (!validation_result.valid) {
      return res.status(400).json(warning_response(req, "FORM_SCHEMA_INVALID", null, { errors: validation_result.errors }));
    }

    await forms_model.update_version_in_place(active_version.form_group_id, active_version.version, {
      form_name: active_version.form_name,
      form_name_normalized: active_version.form_name_normalized || String(active_version.form_name || "").toLowerCase(),
      schema: next_schema,
      approval_config: active_version.approval_config,
      updated_by: `translation_link:${link._id.toString()}`,
      updated_by_name: link.title || "Translation link",
    });
    await links_model.count_save(link._id);
    return res.status(200).json(success_response(req, "TRANSLATION_SAVED", { applied: applied.applied, version: active_version.version }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = {
  get_public_translation,
  save_public_translation,
};
