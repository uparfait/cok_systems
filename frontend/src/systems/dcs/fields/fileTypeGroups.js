/**
 * Fixed, designer-facing file-type groups offered in a media field's
 * settings - mirrors dc_backend/constants/file_type_groups.js exactly, so a
 * schema's allowed_file_type_groups means the same thing on both sides.
 */
export const DCS_FILE_TYPE_GROUPS = [
  { key: "images", labelKey: "DCS_FILE_TYPE_GROUP_IMAGES", extensions: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"] },
  { key: "documents", labelKey: "DCS_FILE_TYPE_GROUP_DOCUMENTS", extensions: [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv"] },
  { key: "videos", labelKey: "DCS_FILE_TYPE_GROUP_VIDEOS", extensions: [".mp4", ".mov", ".avi", ".mkv", ".webm"] },
  { key: "audio", labelKey: "DCS_FILE_TYPE_GROUP_AUDIO", extensions: [".mp3", ".wav", ".ogg", ".m4a", ".aac"] },
];

/**
 * Builds the <input accept> attribute from the designer's chosen groups -
 * an empty selection means no restriction, so accept is left undefined
 * (browser offers every file type) exactly like the old accepted_types: [].
 */
export function build_accept_attribute(group_keys) {
  if (!Array.isArray(group_keys) || group_keys.length === 0) return undefined;
  return group_keys
    .flatMap((key) => {
      const group = DCS_FILE_TYPE_GROUPS.find((entry) => entry.key === key);
      return group ? group.extensions : [];
    })
    .join(",");
}

/**
 * True when a filename's extension is allowed for the given group
 * selection - always true when nothing was restricted. Used to reject an
 * obviously-wrong file client-side before even attempting the upload.
 */
export function file_extension_allowed(filename, group_keys) {
  if (!Array.isArray(group_keys) || group_keys.length === 0) return true;
  const allowed = new Set(group_keys.flatMap((key) => {
    const group = DCS_FILE_TYPE_GROUPS.find((entry) => entry.key === key);
    return group ? group.extensions : [];
  }));
  const match = /\.[^.]+$/.exec((filename || "").toLowerCase());
  return !!match && allowed.has(match[0]);
}
