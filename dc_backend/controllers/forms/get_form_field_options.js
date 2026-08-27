const forms_model = require("../../models/forms_model.js");
const project_access = require("../../utilities/project_access.js");
const { resolve_field_options } = require("../../jsonlogic/lazy_options.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Resolves the real option content for one select_group/cascading_select
 * field of a form's active version, deferred out of the form's own payload
 * (see lazy_options.js) whenever it carries more than the lazy threshold -
 * the builder calls this with no parent_value to load a field's complete
 * data for editing, the live/review renderer calls it with the currently
 * selected parent's answer to load only the options that actually belong
 * to it.
 */
async function get_form_field_options(req, res) {
  try {
    const { form_group_id, field_id } = req.params;
    const has_parent_value = Object.prototype.hasOwnProperty.call(req.query, "parent_value");
    const parent_value = req.query.parent_value;

    if (!form_group_id || !field_id) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }

    const access = await project_access.can_view_form_group(req.user, form_group_id);
    if (access.found && !access.allowed) {
      return res.status(403).json(warning_response(req, "ACCESS_DENIED"));
    }

    const form = await forms_model.get_active_version(form_group_id);
    if (!form) {
      return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    }

    const resolved = resolve_field_options((form.schema && form.schema.fields) || [], field_id, has_parent_value, parent_value);
    if (!resolved) {
      return res.status(404).json(warning_response(req, "FIELD_NOT_FOUND"));
    }

    return res.status(200).json(success_response(req, "FORM_FETCHED", resolved));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_form_field_options;
