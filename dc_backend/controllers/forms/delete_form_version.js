const forms_model = require("../../models/forms_model.js");
const submissions_model = require("../../models/submissions_model.js");
const projects_model = require("../../models/projects_model.js");
const project_access = require("../../utilities/project_access.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Permanently deletes one specific version of a form. A non-active version
 * can always be deleted. The active version can only be deleted when it is
 * the form's only version (deleting it is then really deleting the whole
 * form, not leaving it without any active version behind) AND nothing has
 * ever been collected against the form - a form otherwise always keeps
 * exactly one active version, and real collected data must never become
 * silently discardable just by deleting the version it was recorded
 * against. Optionally also deletes every submission collected against that
 * version (delete_data); otherwise those submissions are left untouched,
 * still queryable by form_group_id/version even though the version
 * document itself is gone.
 */
async function delete_form_version(req, res) {
  try {
    const { form_group_id, version } = req.params;
    const { delete_data } = req.body || {};

    if (!form_group_id || version === undefined || version === null) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }

    const version_doc = await forms_model.get_version_document(form_group_id, version);
    if (!version_doc) {
      return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    }

    const project = await projects_model.find_project_by_id(version_doc.project_id);
    const management = await project_access.resolve_form_management(req.user, project, form_group_id);
    if (!management.delete_forms) {
      return res.status(403).json(warning_response(req, "FORM_ACTION_FORBIDDEN"));
    }

    if (version_doc.is_active) {
      const [all_versions, total_submissions] = await Promise.all([
        forms_model.get_versions_by_group(form_group_id),
        submissions_model.count_by_form_group_id(form_group_id),
      ]);
      const is_only_version = all_versions.length <= 1;
      if (!is_only_version || total_submissions > 0) {
        return res.status(400).json(warning_response(req, "FORM_VERSION_ACTIVE_CANNOT_DELETE"));
      }
    }

    let deleted_submission_count = 0;
    if (delete_data) {
      deleted_submission_count = await submissions_model.delete_by_form_group_and_version(form_group_id, version);
    }

    await forms_model.delete_version(form_group_id, version);

    return res.status(200).json(success_response(req, "FORM_VERSION_DELETED", { deleted_submission_count }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = delete_form_version;
