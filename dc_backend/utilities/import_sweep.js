const fs = require("fs");
const path = require("path");
const imports_model = require("../models/form_imports_model.js");
const { IMPORT_UPLOAD_DIR } = require("./upload.js");

/**
 * Removes the uploaded import files nobody will read any more: run at
 * startup, it deletes every file in uploads/imports older than a day
 * unless an import is running on it. A session whose file went this way
 * answers "upload it again" if someone comes back to it.
 */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

async function sweep_import_files(options) {
  const dir = (options && options.dir) || IMPORT_UPLOAD_DIR;
  const max_age_ms = (options && options.max_age_ms) || MAX_AGE_MS;
  const now = (options && options.now) || Date.now();
  let names = [];
  try {
    names = await fs.promises.readdir(dir);
  } catch (error) {
    return { removed: 0, kept: 0 };
  }
  const old_files = [];
  for (const name of names) {
    if (name.startsWith(".")) continue;
    const full = path.join(dir, name);
    const stat = await fs.promises.stat(full).catch(() => null);
    if (stat && stat.isFile() && now - stat.mtimeMs > max_age_ms) old_files.push(full);
  }
  if (old_files.length === 0) return { removed: 0, kept: names.length };
  const running = new Set((await imports_model.list_running_file_paths()).map((entry) => path.resolve(entry)));
  let removed = 0;
  for (const full of old_files) {
    if (running.has(path.resolve(full))) continue;
    await fs.promises.unlink(full).catch(() => {});
    removed += 1;
  }
  return { removed, kept: names.length - removed };
}

module.exports = { MAX_AGE_MS, sweep_import_files };
