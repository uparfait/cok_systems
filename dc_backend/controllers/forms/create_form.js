const forms_model = require("../../models/forms_model.js");
const projects_model = require("../../models/projects_model.js");
const project_access = require("../../utilities/project_access.js");
const { validate_form_schema } = require("../../jsonlogic/validate_schema.js");
const { resolve_template_placeholders } = require("../../jsonlogic/resolve_templates.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { is_valid_object_id } = require("../../utilities/object_id.js");

/**
 * Creates version 1 of a new form under a project. The form's field list
 * is validated by the shared schema validator; the form_name is an
 * internal-only label (never shown to a respondent) used to tell forms
 * apart when listing them, and must be unique within the project.
 */
async function create_form(req, res) {
  try {
    const { project_id } = req.params;
    const { schema, form_name } = req.body || {};

    if (!is_valid_object_id(project_id)) {
      return res.status(400).json(warning_response(req, "INVALID_ID"));
    }

    const project = await projects_model.find_project_by_id(project_id);
    if (!project) {
      return res.status(404).json(warning_response(req, "PROJECT_NOT_FOUND"));
    }

    const management = await project_access.resolve_form_management(req.user, project);
    if (!management.add_forms) {
      return res.status(403).json(warning_response(req, "FORM_ACTION_FORBIDDEN"));
    }

    if (!form_name || !form_name.toString().trim()) {
      return res.status(400).json(warning_response(req, "FORM_NAME_REQUIRED"));
    }

    // A safety net, not the primary path - the builder already expands any
    // __is__template__ placeholder itself before ever calling this
    // endpoint, but a hand-crafted or offline-stale payload must never be
    // allowed to persist an unresolved reference.
    const resolved_schema = { fields: await resolve_template_placeholders((schema && schema.fields) || []) };

    const validation_result = validate_form_schema(resolved_schema);
    if (!validation_result.valid) {
      return res.status(400).json(warning_response(req, "FORM_SCHEMA_INVALID", null, { errors: validation_result.errors }));
    }

    const name_taken = await forms_model.is_form_name_taken(project_id, form_name);
    if (name_taken) {
      return res.status(409).json(warning_response(req, "FORM_NAME_TAKEN"));
    }

    const form = await forms_model.create_form_version_one({
      project_id,
      form_name: form_name.toString().trim(),
      form_name_normalized: form_name.toString().trim().toLowerCase(),
      schema: resolved_schema,
      created_by: req.user.user_id.toString(),
      created_by_name: req.user.full_name,
    });

    return res.status(201).json(success_response(req, "FORM_CREATED", form));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = create_form;
