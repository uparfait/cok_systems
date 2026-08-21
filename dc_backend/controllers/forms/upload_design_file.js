const fs = require("fs");
const { file_extension_allowed } = require("../../constants/file_type_groups.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

function delete_uploaded_file(file) {
  if (file && file.path) fs.unlink(file.path, () => {});
}

/**
 * Authenticated upload endpoint for a form author's own content-block
 * files (the "File" and "Image" design components, added while building
 * the form - not tied to any respondent submission or published version
 * yet). allowed_group, when given, restricts the extension the same way a
 * data field's allowed_file_type_groups would (e.g. an Image block only
 * ever accepts the "images" group).
 */
async function upload_design_file(req, res) {
  const file = req.file;
  try {
    if (!file) {
      return res.status(400).json(warning_response(req, "FILE_REQUIRED"));
    }

    const { allowed_group } = req.body || {};
    const allowed_groups = allowed_group ? [allowed_group] : null;
    if (allowed_groups && !file_extension_allowed(file.originalname, allowed_groups)) {
      delete_uploaded_file(file);
      return res.status(422).json(warning_response(req, "FILE_TYPE_NOT_ALLOWED"));
    }

    return res.status(201).json(
      success_response(req, "FILE_UPLOADED", {
        name: file.originalname,
        type: file.mimetype,
        size: file.size,
        url: `/dcs/api/uploads/design/${file.filename}`,
      }),
    );
  } catch (error) {
    delete_uploaded_file(file);
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = upload_design_file;
