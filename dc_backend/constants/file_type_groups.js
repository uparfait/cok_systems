/**
 * Fixed, designer-facing file-type groups offered in a media field's
 * settings (checkboxes, not free-text MIME entry) - mirrors
 * frontend/src/systems/dcs/fields/fileTypeGroups.js exactly, since a
 * schema's allowed_file_type_groups must mean the same thing on both sides.
 */
const FILE_TYPE_GROUPS = [
  { key: "images", extensions: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"] },
  { key: "documents", extensions: [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv"] },
  { key: "videos", extensions: [".mp4", ".mov", ".avi", ".mkv", ".webm"] },
  { key: "audio", extensions: [".mp3", ".wav", ".ogg", ".m4a", ".aac"] },
];

/**
 * Null means "no restriction" - an empty/absent group selection has always
 * meant any file type is accepted, same as the old free-text accepted_types
 * default of [].
 */
function get_allowed_extensions(group_keys) {
  if (!Array.isArray(group_keys) || group_keys.length === 0) return null;
  const allowed = new Set();
  group_keys.forEach((key) => {
    const group = FILE_TYPE_GROUPS.find((entry) => entry.key === key);
    if (group) group.extensions.forEach((extension) => allowed.add(extension));
  });
  return allowed;
}

/**
 * True when a filename's extension is allowed for the given group
 * selection - always true when nothing was restricted.
 */
function file_extension_allowed(filename, group_keys) {
  const allowed = get_allowed_extensions(group_keys);
  if (!allowed) return true;
  const match = /\.[^.]+$/.exec((filename || "").toLowerCase());
  return !!match && allowed.has(match[0]);
}

module.exports = { FILE_TYPE_GROUPS, get_allowed_extensions, file_extension_allowed };
