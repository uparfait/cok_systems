const fs = require("fs");
const approval_requests_model = require("../../models/approval_requests_model.js");
const { is_session_valid, read_session_signature } = require("../../utilities/batch_session.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

// Signature images plus the common digital certificate container formats.
const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".pdf", ".p12", ".pfx", ".cer", ".crt", ".pem", ".der", ".sig"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

function delete_uploaded_file(file) {
  if (file && file.path) fs.unlink(file.path, () => {});
}

/**
 * The batch approver's signature image or certificate. Same contract as
 * the per-submission upload, but gated by the session signature earned
 * with the emailed token rather than a submission step token.
 */
async function upload_batch_approval_file(req, res) {
  const file = req.file;
  try {
    const { token } = req.params;

    if (!file) return res.status(400).json(warning_response(req, "FILE_REQUIRED"));

    const request = await approval_requests_model.find_by_token(token);
    if (!request) {
      delete_uploaded_file(file);
      return res.status(404).json(warning_response(req, "APPROVAL_NOT_FOUND"));
    }

    const approver = request.approvers.find((entry) => entry.token === token);
    if (!is_session_valid(approver, read_session_signature(req))) {
      delete_uploaded_file(file);
      return res.status(401).json(warning_response(req, "APPROVAL_SESSION_INVALID", null, { signature_required: true }));
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

module.exports = upload_batch_approval_file;
