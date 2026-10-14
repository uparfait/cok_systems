const follow_up_forms_model = require("../../models/follow_up_forms_model.js");
const { upload_against } = require("../public/upload_file.js");
const { warning_response } = require("../../utilities/response.js");

/**
 * Public, no-auth upload of one respondent-provided file for a FOLLOW-UP
 * form: the same storage, answer shape and checks as the form upload
 * (controllers/public/upload_file.js), validated against the follow-up
 * version document named in the body - its own version numbers, its own
 * fields. The file lands in the shared submissions upload folder, so the
 * existing DELETE /public/forms/:fg/upload (and its follow-up twin)
 * removes it the same way.
 */
async function upload_follow_up_file(req, res) {
  const { follow_up_group_id } = req.params;
  if (!follow_up_group_id) {
    return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
  }
  return upload_against(req, res, (version) => follow_up_forms_model.get_version(follow_up_group_id, version));
}

module.exports = upload_follow_up_file;
