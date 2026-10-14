const { viewer_context, strip_follow_up } = require("./context.js");
const { success_response, error_response } = require("../../utilities/response.js");

/**
 * The follow-up form of one actual form: its active version (null when the
 * form has no follow-up yet, so the page can offer to create one) and
 * every version it has, newest first.
 */
async function get_follow_up(req, res) {
  try {
    const context = await viewer_context(req, res);
    if (!context) return undefined;
    return res.status(200).json(
      success_response(req, "FOLLOW_UP_FETCHED", {
        follow_up: strip_follow_up(context.active),
        versions: context.versions.map(strip_follow_up),
        can_edit: context.can_edit,
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_follow_up;
