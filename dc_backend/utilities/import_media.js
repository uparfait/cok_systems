const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { once } = require("events");
const config = require("../configurations/config.js");
const { SUBMISSION_UPLOAD_DIR } = require("./upload.js");
const { file_extension_allowed } = require("../constants/file_type_groups.js");
const { get_max_size_bytes } = require("../constants/file_size_limit.js");

/**
 * A media link in an imported file (a picture, a video, a document on
 * some web address) is fetched and kept like a file uploaded through the
 * form: the same uploads/submissions folder, the same stored shape
 * { name, type, size, url } pointing at this system. One total timeout
 * per file, the field's own size cap (or the import's fallback), the
 * content type has to fit the field, at most a few downloads at once.
 * A failure never stops the import: the caller keeps the link as typed
 * and lists the failure.
 */
const MEDIA_TYPES = ["image", "video", "audio", "file_upload", "signature"];
const TYPE_PREFIXES = { image: ["image/"], signature: ["image/"], video: ["video/"], audio: ["audio/"] };
const REFUSED_TYPES = ["text/html", "application/xhtml+xml", "text/javascript", "application/javascript", ""];
const EXTENSION_OF_TYPE = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
  "audio/ogg": ".ogg",
  "application/pdf": ".pdf",
};

const is_http_link = (value) => typeof value === "string" && /^https?:\/\//i.test(value.trim());

function type_fits(field_type, content_type) {
  if (REFUSED_TYPES.includes(content_type)) return false;
  const prefixes = TYPE_PREFIXES[field_type];
  return !prefixes || prefixes.some((prefix) => content_type.startsWith(prefix));
}

/** The file name a link suggests, given an extension from the content type when it has none. */
function file_name_of(link, content_type) {
  let base = "";
  try {
    base = decodeURIComponent(new URL(link).pathname.split("/").filter(Boolean).pop() || "");
  } catch (error) {
    base = "";
  }
  if (!base) base = "download";
  if (!path.extname(base) && EXTENSION_OF_TYPE[content_type]) base += EXTENSION_OF_TYPE[content_type];
  return base;
}

const megabytes = (bytes) => Math.round((bytes / (1024 * 1024)) * 10) / 10;

/**
 * { value: { name, type, size, url }, path } when the file now sits in
 * uploads/submissions, else { failure: { key, vars } } naming why.
 */
async function download_media(link, field) {
  const timeout_ms = config.import_media_timeout_ms;
  const max_bytes = get_max_size_bytes(field) || config.import_media_max_mb * 1024 * 1024;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout_ms);
  let file_path = null;
  let out = null;
  const failure = (key, vars) => ({ failure: { key, vars: vars || {} } });
  try {
    let response;
    try {
      response = await fetch(link, { signal: controller.signal, redirect: "follow" });
    } catch (error) {
      return controller.signal.aborted ? failure("IMPORT_MEDIA_TIMEOUT") : failure("IMPORT_MEDIA_NETWORK", { detail: error.message });
    }
    if (!response.ok) return failure("IMPORT_MEDIA_HTTP", { status: response.status });
    const content_type = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!type_fits(field.type, content_type)) return failure("IMPORT_MEDIA_NOT_MEDIA", { type: content_type || "unknown" });
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > max_bytes) return failure("IMPORT_MEDIA_TOO_LARGE", { max: megabytes(max_bytes) });
    const name = file_name_of(link, content_type);
    if (!file_extension_allowed(name, field.allowed_file_type_groups)) return failure("IMPORT_MEDIA_TYPE_NOT_ALLOWED");

    const filename = `${crypto.randomBytes(16).toString("hex")}${path.extname(name).toLowerCase()}`;
    file_path = path.join(SUBMISSION_UPLOAD_DIR, filename);
    out = fs.createWriteStream(file_path);
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > max_bytes) {
        controller.abort();
        out.destroy();
        await fs.promises.unlink(file_path).catch(() => {});
        return failure("IMPORT_MEDIA_TOO_LARGE", { max: megabytes(max_bytes) });
      }
      if (!out.write(chunk)) await once(out, "drain");
    }
    out.end();
    await once(out, "finish");
    return { value: { name, type: content_type, size, url: `/dcs/api/uploads/submissions/${filename}` }, path: file_path };
  } catch (error) {
    if (out) out.destroy();
    if (file_path) await fs.promises.unlink(file_path).catch(() => {});
    return controller.signal.aborted ? failure("IMPORT_MEDIA_TIMEOUT") : failure("IMPORT_MEDIA_NETWORK", { detail: error.message });
  } finally {
    clearTimeout(timer);
  }
}

/** Runs worker over every task with at most `limit` in flight; results come back in task order. */
async function run_pool(tasks, limit, worker) {
  const results = new Array(tasks.length);
  let next = 0;
  const lanes = Array.from({ length: Math.max(1, Math.min(limit, tasks.length)) }, async () => {
    while (next < tasks.length) {
      const index = next;
      next += 1;
      results[index] = await worker(tasks[index], index);
    }
  });
  await Promise.all(lanes);
  return results;
}

module.exports = { MEDIA_TYPES, is_http_link, type_fits, file_name_of, download_media, run_pool };
