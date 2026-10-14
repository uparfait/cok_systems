const { warning_response } = require("../../utilities/response.js");

/**
 * The bare "delete selected" of before. Deleting records now takes the
 * code mailed to the signed-in user (delete_code.js, with the permission
 * check in deletable_submissions.js), so this route answers 410 and no
 * caller can remove rows without that code.
 */
function delete_submissions(req, res) {
  return res.status(410).json(warning_response(req, "DELETE_CODE_REQUIRED"));
}

module.exports = delete_submissions;
