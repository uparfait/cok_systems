const forms_model = require("../../models/forms_model.js");
const project_access = require("../../utilities/project_access.js");
const { describe_plan } = require("../../utilities/test_data_plan.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * What a generation of one form version will draw from, so the user can
 * tune it first: every number field with the range it would get (its own
 * min / max rules, else 0..100), whether the form captures a GPS position
 * (points are then placed inside the City of Kigali, inside the place the
 * record names), and the cascades with how many leaf paths each covers.
 */
async function get_test_fields(req, res) {
  try {
    const { form_group_id } = req.params;
    const version = req.query.version;
    if (!form_group_id) return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));

    const access = await project_access.can_view_form_group(req.user, form_group_id);
    if (access.found && !access.allowed) return res.status(403).json(warning_response(req, "ACCESS_DENIED"));

    const form_version = version === undefined || version === null || version === "" ? await forms_model.get_active_version(form_group_id) : await forms_model.get_version_document(form_group_id, version);
    if (!form_version) return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));

    return res.status(200).json(success_response(req, "TEST_DATA_FIELDS_FETCHED", Object.assign({ version: form_version.version }, describe_plan(form_version.schema))));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_test_fields;
