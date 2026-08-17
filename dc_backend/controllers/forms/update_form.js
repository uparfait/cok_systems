const forms_model = require("../../models/forms_model.js");
const { validate_form_schema } = require("../../jsonlogic/validate_schema.js");
const { has_data_field_set_changed } = require("../../jsonlogic/schema_diff.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Publishes a change to a form's currently active version. Only ever mints
 * a brand new, immutable version when a data-collection field was added or
 * removed - editing an existing field's condition, design, label/help
 * text, or any content (form design) component, updates the active
 * version in place instead, so a form doesn't accumulate a new version for
 * every cosmetic tweak. The form_name can be renamed here too, still
 * checked for uniqueness within the project (excluding this same group).
 */
async function update_form(req, res) {
  try {
    const { form_group_id } = req.params;
    const { schema, form_name } = req.body || {};

    if (!form_group_id) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }

    const active_version = await forms_model.get_active_version(form_group_id);
    if (!active_version) {
      return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    }

    const next_form_name = (form_name || active_version.form_name || "").toString().trim();
    if (!next_form_name) {
      return res.status(400).json(warning_response(req, "FORM_NAME_REQUIRED"));
    }

    const validation_result = validate_form_schema(schema);
    if (!validation_result.valid) {
      return res.status(400).json(warning_response(req, "FORM_SCHEMA_INVALID", null, { errors: validation_result.errors }));
    }

    const name_taken = await forms_model.is_form_name_taken(active_version.project_id, next_form_name, form_group_id);
    if (name_taken) {
      return res.status(409).json(warning_response(req, "FORM_NAME_TAKEN"));
    }

    const should_bump_version = has_data_field_set_changed(active_version.schema, schema);

    const form = should_bump_version
      ? await forms_model.create_next_form_version(form_group_id, {
          project_id: active_version.project_id,
          form_name: next_form_name,
          form_name_normalized: next_form_name.toLowerCase(),
          schema,
          created_by: req.user.user_id.toString(),
          created_by_name: req.user.full_name,
        })
      : await forms_model.update_version_in_place(form_group_id, active_version.version, {
          form_name: next_form_name,
          form_name_normalized: next_form_name.toLowerCase(),
          schema,
          updated_by: req.user.user_id.toString(),
          updated_by_name: req.user.full_name,
        });

    return res
      .status(should_bump_version ? 201 : 200)
      .json(success_response(req, should_bump_version ? "FORM_UPDATED_NEW_VERSION" : "FORM_UPDATED_IN_PLACE", form));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = update_form;
