const fs = require("fs");
const submissions_model = require("../../models/submissions_model.js");
const { can_step_act } = require("../../utilities/approval.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

// Signature images plus the common digital certificate container formats.
const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".pdf", ".p12", ".pfx", ".cer", ".crt", ".pem", ".der", ".sig"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

/** Removes a file multer already wrote to disk before a validation error is returned. */
function delete_uploaded_file(file) {
  if (file && file.path) fs.unlink(file.path, () => {});
}

/**
 * Public, no-auth upload for one approver's signature PNG or digital
 * certificate file, gated by the approver's own step token - only the
 * approver whose turn it currently is can put a file here.
 */
async function upload_approval_file(req, res) {
  const file = req.file;
  try {
    const { token } = req.params;

    if (!file) {
      return res.status(400).json(warning_response(req, "FILE_REQUIRED"));
    }

    const submission = await submissions_model.find_by_approval_token(token);
    if (!submission || !submission.approval) {
      delete_uploaded_file(file);
      return res.status(404).json(warning_response(req, "APPROVAL_NOT_FOUND"));
    }

    const step = submission.approval.steps.find((entry) => entry.token === token);
    if (!can_step_act(submission.approval, step)) {
      delete_uploaded_file(file);
      return res.status(409).json(warning_response(req, "APPROVAL_NOT_YOUR_TURN"));
    }

    const extension = (file.originalname.match(/\.[^.]+$/) || [""])[0].toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      delete_uploaded_file(file);
      return res.status(422).json(warning_response(req, "FILE_TYPE_NOT_ALLOWED"));
    }
    if (file.size > MAX_SIZE_BYTES) {
      delete_uploaded_file(file);
      return res.status(422).json(warning_response(req, "FILE_TOO_LARGE"));
    }

    return res.status(201).json(
      success_response(req, "FILE_UPLOADED", {
        name: file.originalname,
        type: file.mimetype,
        size: file.size,
        url: `/dcs/api/uploads/approvals/${file.filename}`,
      }),
    );
  } catch (error) {
    delete_uploaded_file(file);
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = upload_approval_file;
