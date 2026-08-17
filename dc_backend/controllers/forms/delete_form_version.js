const forms_model = require("../../models/forms_model.js");
const submissions_model = require("../../models/submissions_model.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Permanently deletes one specific, non-active version of a form. The
 * active version can never be deleted this way - activate a different
 * version first. Optionally also deletes every submission collected
 * against that version (delete_data); otherwise those submissions are
 * left untouched, still queryable by form_group_id/version even though
 * the version document itself is gone.
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

    if (version_doc.is_active) {
      return res.status(400).json(warning_response(req, "FORM_VERSION_ACTIVE_CANNOT_DELETE"));
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
