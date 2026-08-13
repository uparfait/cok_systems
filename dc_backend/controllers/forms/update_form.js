const forms_model = require("../../models/forms_model.js");
const { validate_form_schema } = require("../../jsonlogic/validate_schema.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Publishes a change to an existing form as a brand new, immutable version.
 * The previous versions are never overwritten or deleted, so data already
 * collected against them stays valid and traceable. The form_name can be
 * renamed here too, still checked for uniqueness within the project
 * (excluding this same form group).
 */
async function update_form(req, res) {
  try {
    const { form_group_id } = req.params;
    const { schema, form_name } = req.body || {};

    if (!form_group_id) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }

    const latest_version = await forms_model.get_latest_version(form_group_id);
    if (!latest_version) {
      return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    }

    const next_form_name = (form_name || latest_version.form_name || "").toString().trim();
    if (!next_form_name) {
      return res.status(400).json(warning_response(req, "FORM_NAME_REQUIRED"));
    }

    const validation_result = validate_form_schema(schema);
    if (!validation_result.valid) {
      return res.status(400).json(warning_response(req, "FORM_SCHEMA_INVALID", null, { errors: validation_result.errors }));
    }

    const name_taken = await forms_model.is_form_name_taken(latest_version.project_id, next_form_name, form_group_id);
    if (name_taken) {
      return res.status(409).json(warning_response(req, "FORM_NAME_TAKEN"));
    }

    const form = await forms_model.create_next_form_version(form_group_id, {
      project_id: latest_version.project_id,
      form_name: next_form_name,
      form_name_normalized: next_form_name.toLowerCase(),
      schema,
      created_by: req.user.user_id.toString(),
      created_by_name: req.user.full_name,
    });

    return res.status(201).json(success_response(req, "FORM_UPDATED_NEW_VERSION", form));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = update_form;
