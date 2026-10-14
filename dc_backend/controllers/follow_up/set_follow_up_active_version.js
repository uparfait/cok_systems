const follow_up_forms_model = require("../../models/follow_up_forms_model.js");
const { existing_editor_context, strip_follow_up } = require("./context.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Marks one version of the follow-up as the active one - the version its
 * public link serves.
 */
async function set_follow_up_active_version(req, res) {
  try {
    const context = await existing_editor_context(req, res);
    if (!context) return undefined;
    const { version } = req.body || {};
    if (version === undefined || version === null || !context.versions.some((entry) => entry.version === Number(version))) {
      return res.status(404).json(warning_response(req, "FOLLOW_UP_VERSION_NOT_FOUND"));
    }
    const active = await follow_up_forms_model.set_active(context.follow_up_group_id, version);
    return res.status(200).json(success_response(req, "FORM_ACTIVE_VERSION_SET", strip_follow_up(active)));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = set_follow_up_active_version;
