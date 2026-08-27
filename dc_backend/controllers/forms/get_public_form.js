const forms_model = require("../../models/forms_model.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Public, no-auth endpoint behind /dcs-form/:id. Always resolves to the
 * form group's current active version, regardless of which version number
 * (if any) was embedded in the shared link.
 */
async function get_public_form(req, res) {
  try {
    const { form_group_id } = req.params;

    if (!form_group_id) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }

    const active_form = await forms_model.get_active_version(form_group_id);
    if (!active_form) {
      const any_version = await forms_model.get_latest_version(form_group_id);
      if (!any_version) {
        return res.status(404).json(warning_response(req, "FORM_PUBLIC_NOT_FOUND"));
      }
      return res.status(409).json(warning_response(req, "FORM_PUBLIC_NO_ACTIVE_VERSION"));
    }

    // Respondents only ever learn that approval exists - never the approvers' own details.
    const { approval_config, ...public_form } = active_form;
    if (approval_config && approval_config.enabled) {
      public_form.approval_summary = { enabled: true, mode: approval_config.mode, approver_count: approval_config.approvers.length };
    }

    return res.status(200).json(success_response(req, "FORM_FETCHED", public_form));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_public_form;
