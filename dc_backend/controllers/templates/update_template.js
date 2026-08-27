const templates_model = require("../../models/templates_model.js");
const { validate_form_schema } = require("../../jsonlogic/validate_schema.js");
const { resolve_template_placeholders } = require("../../jsonlogic/resolve_templates.js");
const { merge_lazy_fields } = require("../../jsonlogic/lazy_options.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { is_valid_object_id } = require("../../utilities/object_id.js");

/**
 * Updates a template's name, description and/or fields. Never affects a
 * form that already inserted this template earlier - that form kept its
 * own copy of the fields at insert time.
 */
async function update_template(req, res) {
  try {
    const { template_id } = req.params;
    const { name, description, fields } = req.body || {};

    if (!is_valid_object_id(template_id)) {
      return res.status(400).json(warning_response(req, "INVALID_ID"));
    }

    const existing_template = await templates_model.get_template_by_id(template_id);
    if (!existing_template) {
      return res.status(404).json(warning_response(req, "TEMPLATE_NOT_FOUND"));
    }

    if (!name || !name.toString().trim()) {
      return res.status(400).json(warning_response(req, "TEMPLATE_NAME_REQUIRED"));
    }

    // The builder only ever loads a huge select_group/cascading_select
    // field's real options once its own settings are opened (see
    // jsonlogic/lazy_options.js) - an edit that never touched one still
    // carries it as an empty placeholder, so its real, already-stored
    // content is restored here before anything is validated or saved.
    const merged_fields = merge_lazy_fields(Array.isArray(fields) ? fields : [], existing_template.fields || []);

    const resolved_fields = await resolve_template_placeholders(merged_fields);

    const validation_result = validate_form_schema({ fields: resolved_fields });
    if (!validation_result.valid) {
      return res.status(400).json(warning_response(req, "TEMPLATE_SCHEMA_INVALID", null, { errors: validation_result.errors }));
    }

    const name_taken = await templates_model.is_template_name_taken(name, template_id);
    if (name_taken) {
      return res.status(409).json(warning_response(req, "TEMPLATE_NAME_TAKEN"));
    }

    const template = await templates_model.update_template(template_id, {
      name: name.toString().trim(),
      name_normalized: name.toString().trim().toLowerCase(),
      description: (description || "").toString().trim(),
      fields: resolved_fields,
      updated_by: req.user.user_id.toString(),
      updated_by_name: req.user.full_name,
    });

    return res.status(200).json(success_response(req, "TEMPLATE_UPDATED", template));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = update_template;
