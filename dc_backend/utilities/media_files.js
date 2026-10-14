const fs = require("fs");
const path = require("path");
const { SUBMISSION_UPLOAD_DIR } = require("./upload.js");

/**
 * The uploaded files a record refers to, and what happens to them.
 *
 * A media answer is a list of files ({ name, type, size, url }), and an
 * update or a correction REPLACES the list like any other value: the
 * period holds the files valid at that time, so an older period may still
 * refer to a file the current answer no longer lists. That is why no
 * update ever removes a file from disk - the older period must stay
 * viewable. Files leave the disk only when the record itself is deleted
 * through the code-confirmed delete, and only the system's own uploads
 * (a link to somewhere else is not ours to remove).
 */

const UPLOAD_URL_MARK = "/uploads/submissions/";
const MAX_DEPTH = 8;

/** Whether a url points at a file in the system's own submissions upload folder. */
function is_system_upload(url) {
  return typeof url === "string" && url.includes(UPLOAD_URL_MARK);
}

/** The path on disk of a system upload url, or null when it would leave the upload folder. */
function path_of_upload(url) {
  if (!is_system_upload(url)) return null;
  const resolved = path.join(SUBMISSION_UPLOAD_DIR, path.basename(url));
  return path.dirname(resolved) === SUBMISSION_UPLOAD_DIR ? resolved : null;
}

/** Every url carried by a value: a file object, a list of them, or anything nesting them. */
function collect_urls(value, into, depth) {
  if (value === null || value === undefined || (depth || 0) > MAX_DEPTH) return into;
  if (Array.isArray(value)) {
    value.forEach((entry) => collect_urls(entry, into, (depth || 0) + 1));
    return into;
  }
  if (typeof value === "object") {
    if (typeof value.url === "string" && value.url) into.add(value.url);
    Object.keys(value).forEach((key) => {
      if (key !== "url") collect_urls(value[key], into, (depth || 0) + 1);
    });
  }
  return into;
}

/** Every upload url a record refers to anywhere: its answers, its value periods, its history. */
function record_upload_urls(record) {
  const urls = new Set();
  if (!record) return urls;
  collect_urls(record.data, urls, 0);
  collect_urls(record.tracking_periods, urls, 0);
  collect_urls(record.history, urls, 0);
  return urls;
}

/**
 * Removes from disk every system upload these records refer to, in one
 * pass over all of them (a file shared by two of the records is unlinked
 * once). A file already gone, or one that cannot be removed, is logged
 * and skipped: the records are deleted whatever happens to their files.
 * Returns how many files were removed.
 */
async function remove_record_files(records) {
  const urls = new Set();
  (records || []).forEach((record) => record_upload_urls(record).forEach((url) => urls.add(url)));
  let removed = 0;
  for (const url of urls) {
    const file_path = path_of_upload(url);
    if (!file_path) continue;
    try {
      await fs.promises.unlink(file_path);
      removed += 1;
    } catch (error) {
      if (error && error.code !== "ENOENT") console.log(`[MEDIA] could not remove ${file_path}: ${error.message}`);
    }
  }
  return removed;
}

/**
 * The query keeping the records that refer to a url anywhere: in the
 * answers or the value periods of any of the given media fields, or in
 * any history change.
 */
function reference_filter(form_group_id, media_field_ids, url) {
  const conditions = [{ "history.changes.from.url": url }, { "history.changes.to.url": url }];
  (media_field_ids || []).forEach((field_id) => {
    conditions.push({ [`data.${field_id}.url`]: url }, { [`tracking_periods.${field_id}.value.url`]: url });
  });
  return Object.assign(form_group_id ? { form_group_id } : {}, { $or: conditions });
}

module.exports = {
  UPLOAD_URL_MARK,
  is_system_upload,
  path_of_upload,
  record_upload_urls,
  remove_record_files,
  reference_filter,
};
