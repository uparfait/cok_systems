const templates_model = require("../../models/templates_model.js");
const { validate_form_schema } = require("../../jsonlogic/validate_schema.js");
const { resolve_template_placeholders } = require("../../jsonlogic/resolve_templates.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Creates a new field template. Its fields are held to the exact same
 * schema validator a form's fields are, and any __is__template__
 * placeholder it embeds (importing another template) is resolved into
 * real fields before it is ever saved - a saved template's fields are
 * always fully concrete, never a lingering unresolved reference.
 */
async function create_template(req, res) {
  try {
    const { name, description, fields, is_system_template } = req.body || {};

    if (!name || !name.toString().trim()) {
      return res.status(400).json(warning_response(req, "TEMPLATE_NAME_REQUIRED"));
    }

    const resolved_fields = await resolve_template_placeholders(Array.isArray(fields) ? fields : []);

    const validation_result = validate_form_schema({ fields: resolved_fields });
    if (!validation_result.valid) {
      return res.status(400).json(warning_response(req, "TEMPLATE_SCHEMA_INVALID", null, { errors: validation_result.errors }));
    }

    const name_taken = await templates_model.is_template_name_taken(name);
    if (name_taken) {
      return res.status(409).json(warning_response(req, "TEMPLATE_NAME_TAKEN"));
    }

    const template = await templates_model.create_template({
      name: name.toString().trim(),
      name_normalized: name.toString().trim().toLowerCase(),
      description: (description || "").toString().trim(),
      fields: resolved_fields,
      is_system_template: !!is_system_template,
      created_by: req.user.user_id.toString(),
      created_by_name: req.user.full_name,
    });

    return res.status(201).json(success_response(req, "TEMPLATE_CREATED", template));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = create_template;
