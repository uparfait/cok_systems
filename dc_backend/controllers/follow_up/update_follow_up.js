const follow_up_forms_model = require("../../models/follow_up_forms_model.js");
const { existing_editor_context, strip_follow_up } = require("./context.js");
const { validate_form_schema } = require("../../jsonlogic/validate_schema.js");
const { has_data_field_set_changed } = require("../../jsonlogic/schema_diff.js");
const { resolve_template_placeholders } = require("../../jsonlogic/resolve_templates.js");
const { merge_lazy_fields } = require("../../jsonlogic/lazy_options.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Publishes a change to the follow-up's active version, with the same
 * rule as the actual form: a new version only when a data field was added
 * or removed, otherwise the active version is rewritten in place.
 */
async function update_follow_up(req, res) {
  try {
    const context = await existing_editor_context(req, res);
    if (!context) return undefined;
    const { schema, form_name, ask_respondent } = req.body || {};

    const active = context.active;
    if (!active) {
      return res.status(409).json(warning_response(req, "FOLLOW_UP_NO_ACTIVE_VERSION"));
    }

    const next_form_name = (form_name || active.form_name || "").toString().trim();
    if (!next_form_name) {
      return res.status(400).json(warning_response(req, "FORM_NAME_REQUIRED"));
    }

    // Lazily loaded option fields come back as placeholders when the
    // builder never opened them; their stored content is restored first.
    const merged_fields = merge_lazy_fields((schema && schema.fields) || [], (active.schema && active.schema.fields) || []);
    const resolved_schema = { fields: await resolve_template_placeholders(merged_fields) };

    const validation_result = validate_form_schema(resolved_schema);
    if (!validation_result.valid) {
      return res.status(400).json(warning_response(req, "FORM_SCHEMA_INVALID", null, { errors: validation_result.errors }));
    }

    const next_ask_respondent = ask_respondent === undefined ? active.ask_respondent !== false : ask_respondent !== false;
    const should_bump_version = has_data_field_set_changed(active.schema, resolved_schema);

    const follow_up = should_bump_version
      ? await follow_up_forms_model.create_next_version(active.follow_up_group_id, {
          project_id: active.project_id,
          form_name: next_form_name,
          form_name_normalized: next_form_name.toLowerCase(),
          schema: resolved_schema,
          ask_respondent: next_ask_respondent,
          created_by: req.user.user_id.toString(),
          created_by_name: req.user.full_name,
        })
      : await follow_up_forms_model.update_in_place(active.follow_up_group_id, active.version, {
          form_name: next_form_name,
          form_name_normalized: next_form_name.toLowerCase(),
          schema: resolved_schema,
          ask_respondent: next_ask_respondent,
          updated_by: req.user.user_id.toString(),
          updated_by_name: req.user.full_name,
        });

    return res
      .status(should_bump_version ? 201 : 200)
      .json(success_response(req, should_bump_version ? "FOLLOW_UP_UPDATED_NEW_VERSION" : "FOLLOW_UP_UPDATED_IN_PLACE", strip_follow_up(follow_up)));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = update_follow_up;
