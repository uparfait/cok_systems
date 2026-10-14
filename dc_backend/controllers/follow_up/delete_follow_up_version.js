const follow_up_forms_model = require("../../models/follow_up_forms_model.js");
const follow_up_submissions_model = require("../../models/follow_up_submissions_model.js");
const dashboards_model = require("../../util-dashboard/dashboards_model.js");
const { existing_editor_context } = require("./context.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Permanently deletes one version of the follow-up, with the actual form's
 * rule: a non-active version can always go; the active one only when it
 * is the only version and nothing was ever collected on the follow-up.
 * With delete_data the records collected against that version go too.
 * When the last version goes, the follow-up is gone altogether, and so
 * are the dashboards that were reading its data.
 */
async function delete_follow_up_version(req, res) {
  try {
    const context = await existing_editor_context(req, res);
    if (!context) return undefined;
    const { version } = req.params;
    const { delete_data } = req.body || {};
    const group_id = context.follow_up_group_id;

    const version_doc = context.versions.find((entry) => entry.version === Number(version));
    if (!version_doc) {
      return res.status(404).json(warning_response(req, "FOLLOW_UP_VERSION_NOT_FOUND"));
    }

    if (version_doc.is_active) {
      const total = await follow_up_submissions_model.count_by_group(group_id);
      if (context.versions.length > 1 || total > 0) {
        return res.status(400).json(warning_response(req, "FORM_VERSION_ACTIVE_CANNOT_DELETE"));
      }
    }

    let deleted_submission_count = 0;
    if (delete_data) {
      deleted_submission_count = await follow_up_submissions_model.delete_by_version(group_id, version);
    }
    await follow_up_forms_model.delete_version(group_id, version);

    if (context.versions.length <= 1) {
      await dashboards_model.delete_dashboards_by_follow_up(group_id);
    }

    return res.status(200).json(success_response(req, "FORM_VERSION_DELETED", { deleted_submission_count }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = delete_follow_up_version;
