const forms_model = require("../../models/forms_model.js");
const submissions_model = require("../../models/submissions_model.js");
const project_access = require("../../utilities/project_access.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Returns the currently active version of a form by its stable group id,
 * used by the form details / settings pages inside the authenticated
 * builder - editing a form always starts from whatever version is
 * actually live, even if an older version was explicitly reactivated
 * after a newer one was published.
 */
async function get_form_by_id(req, res) {
  try {
    const { form_group_id } = req.params;

    if (!form_group_id) {
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

    // The overview page's age counter needs the form's own true origin, not
    // whichever version happens to be active right now - the active
    // version's own created_at reflects when THAT version was published,
    // which can be long after the form itself first existed.
    const [origin_created_at, total_submissions] = await Promise.all([
      forms_model.get_form_origin_created_at(form_group_id),
      submissions_model.count_by_form_group_id(form_group_id),
    ]);
    const enriched_form = Object.assign({}, form, {
      created_at: origin_created_at || form.created_at,
      total_submissions,
    });

    return res.status(200).json(success_response(req, "FORM_FETCHED", enriched_form));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_form_by_id;
