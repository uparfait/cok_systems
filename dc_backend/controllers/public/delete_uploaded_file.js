const fs = require("fs");
const forms_model = require("../../models/forms_model.js");
const submissions_model = require("../../models/submissions_model.js");
const { flatten_fields } = require("../../jsonlogic/dependency_graph.js");
const { path_of_upload } = require("../../utilities/media_files.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

const MEDIA_TYPES = ["image", "video", "audio", "file_upload", "signature"];

/**
 * Public, no-auth cleanup endpoint for a respondent-uploaded file - called
 * the instant it's replaced by a new upload, or removed from its field,
 * so refilling a media field over and over never leaves a trail of
 * orphaned files on disk. The 16-byte random filename this endpoint's
 * upload counterpart generates is what actually protects this from casual
 * abuse (an unguessable capability, same trust model as the URL itself);
 * this only ever unlinks a path that resolves inside the submissions
 * upload folder, regardless of what the client sends.
 *
 * A file a SAVED record refers to - in its answers, in an older value
 * period or in its history - is never removed from here (409): the
 * record's past must stay viewable, and only deleting the record itself
 * takes its files along (see utilities/media_files.js). A file uploaded
 * but never saved is removed; one already gone is not an error - the
 * caller only wants the end state "this file is not on disk".
 */

/** The media field ids of every version of the form - a file may belong to an answer of an older version. */
async function media_field_ids(form_group_id) {
  const versions = await forms_model.get_versions_by_group(form_group_id);
  const ids = new Set();
  (versions || []).forEach((version) => {
    flatten_fields((version && version.schema && version.schema.fields) || []).forEach((field) => {
      if (field && field.id && MEDIA_TYPES.includes(field.type)) ids.add(field.id);
    });
  });
  return Array.from(ids);
}

async function delete_uploaded_file(req, res) {
  try {
    const { form_group_id } = req.params;
    const { url } = req.body || {};
    if (!url || typeof url !== "string") {
      return res.status(400).json(warning_response(req, "FILE_REQUIRED"));
    }

    const resolved_path = path_of_upload(url) || null;
    if (!resolved_path) {
      return res.status(400).json(warning_response(req, "INVALID_ID"));
    }

    const referenced = await submissions_model.count_media_references(form_group_id, await media_field_ids(form_group_id), url);
    if (referenced > 0) {
      return res.status(409).json(warning_response(req, "FILE_IN_USE", null, { references: referenced }));
    }

    fs.unlink(resolved_path, () => {});
    return res.status(200).json(success_response(req, "FILE_DELETED"));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = delete_uploaded_file;
