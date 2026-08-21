const fs = require("fs");
const path = require("path");
const config = require("../../configurations/config.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

const SUBMISSION_UPLOAD_DIR = path.join(__dirname, "..", "..", config.upload_dir, "submissions");

/**
 * Public, no-auth cleanup endpoint for a respondent-uploaded file - called
 * the instant it's replaced by a new upload, or removed from its field,
 * so refilling a media field over and over never leaves a trail of
 * orphaned files on disk. The 16-byte random filename this endpoint's
 * upload counterpart generates is what actually protects this from casual
 * abuse (an unguessable capability, same trust model as the URL itself);
 * this only ever unlinks a path that resolves inside SUBMISSION_UPLOAD_DIR,
 * regardless of what the client sends. Deleting a file that is already
 * gone is not an error - the caller only wants the end state "this file is
 * not on disk".
 */
async function delete_uploaded_file(req, res) {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== "string") {
      return res.status(400).json(warning_response(req, "FILE_REQUIRED"));
    }

    const resolved_path = path.join(SUBMISSION_UPLOAD_DIR, path.basename(url));
    if (path.dirname(resolved_path) !== SUBMISSION_UPLOAD_DIR) {
      return res.status(400).json(warning_response(req, "INVALID_ID"));
    }

    fs.unlink(resolved_path, () => {});
    return res.status(200).json(success_response(req, "FILE_DELETED"));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = delete_uploaded_file;
