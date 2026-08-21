const fs = require("fs");
const forms_model = require("../../models/forms_model.js");
const { flatten_fields } = require("../../jsonlogic/dependency_graph.js");
const { file_extension_allowed } = require("../../constants/file_type_groups.js");
const { get_max_size_bytes } = require("../../constants/file_size_limit.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Removes a file multer already wrote to disk before a validation error is
 * returned - the endpoint must never leave an orphaned upload behind just
 * because it turned out to be for the wrong field or an unauthorized form.
 */
function delete_uploaded_file(file) {
  if (file && file.path) fs.unlink(file.path, () => {});
}

/**
 * Public, no-auth upload endpoint for a single respondent-provided file
 * (image, video, audio, generic upload, or a signature exported as a PNG
 * blob). Saves straight to disk via the upload.js multer instance - this
 * controller only ever sees the already-written file - and returns a URL
 * the submission JSON references instead of ever embedding file bytes.
 * Re-validates the field's own allowed_file_type_groups/max size (in
 * whatever unit the designer picked, or unlimited if never set) against
 * the exact published version, exactly like submit_response re-validates
 * everything else, so a tampered client can never smuggle in a disallowed
 * file type just because the browser's own <input accept> was bypassed.
 */
async function upload_file(req, res) {
  const file = req.file;
  try {
    const { form_group_id } = req.params;
    const { version, field_id } = req.body || {};

    if (!file) {
      return res.status(400).json(warning_response(req, "FILE_REQUIRED"));
    }

    if (!form_group_id || version === undefined || version === null || !field_id) {
      delete_uploaded_file(file);
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }

    const form_version = await forms_model.get_version_document(form_group_id, version);
    if (!form_version) {
      delete_uploaded_file(file);
      return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    }

    const field = flatten_fields(form_version.schema.fields).find((entry) => entry.id === field_id);
    if (!field) {
      delete_uploaded_file(file);
      return res.status(400).json(warning_response(req, "FIELD_NOT_FOUND"));
    }

    if (!file_extension_allowed(file.originalname, field.allowed_file_type_groups)) {
      delete_uploaded_file(file);
      return res.status(422).json(warning_response(req, "FILE_TYPE_NOT_ALLOWED"));
    }

    const max_bytes = get_max_size_bytes(field);
    if (max_bytes && file.size > max_bytes) {
      delete_uploaded_file(file);
      return res.status(422).json(warning_response(req, "FILE_TOO_LARGE"));
    }

    return res.status(201).json(
      success_response(req, "FILE_UPLOADED", {
        name: file.originalname,
        type: file.mimetype,
        size: file.size,
        url: `/dcs/api/uploads/submissions/${file.filename}`,
      }),
    );
  } catch (error) {
    delete_uploaded_file(file);
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = upload_file;
