const fs = require("fs");
const path = require("path");
const config = require("../../configurations/config.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

const DESIGN_UPLOAD_DIR = path.join(__dirname, "..", "..", config.upload_dir, "design");

/**
 * Authenticated cleanup endpoint for a form author's own content-block
 * files: called the moment a File/Image design component's file is
 * replaced with a new one, or the component itself is removed from the
 * canvas, so a form that gets edited over and over never leaves a trail of
 * orphaned uploads on disk. Only ever unlinks a path that resolves inside
 * DESIGN_UPLOAD_DIR, regardless of what the client sends, so this can never
 * be used to delete anything else on the server. Deleting a file that is
 * already gone (or never existed - e.g. the block was pointing at a pasted
 * external link, not one of our own uploads) is not an error - the caller
 * only wants the end state "this file is not on disk", not confirmation
 * that this specific call is what removed it.
 */
async function delete_design_file(req, res) {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== "string") {
      return res.status(400).json(warning_response(req, "FILE_REQUIRED"));
    }

    const resolved_path = path.join(DESIGN_UPLOAD_DIR, path.basename(url));
    if (path.dirname(resolved_path) !== DESIGN_UPLOAD_DIR) {
      return res.status(400).json(warning_response(req, "INVALID_ID"));
    }

    fs.unlink(resolved_path, () => {});
    return res.status(200).json(success_response(req, "FILE_DELETED"));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = delete_design_file;
