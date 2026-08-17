/**
 * Canonical field type catalog for the Data Collection System. This is the
 * single source of truth on the backend for what a form schema is allowed
 * to contain; the frontend field registry mirrors these same ids.
 */

const CONTENT_FIELD_TYPES = ["paragraph", "header", "file", "image_block", "horizontal_line", "shape", "section"];

const DATA_FIELD_TYPES = [
  "text",
  "number",
  "email",
  "url",
  "phone",
  "single_select",
  "multi_select",
  "likert_scale",
  "ranking",
  "date",
  "time",
  "date_time",
  "duration",
  "image",
  "video",
  "audio",
  "file_upload",
  "signature",
  "group",
  "hidden",
  "cascading_select",
];

const ALL_FIELD_TYPES = CONTENT_FIELD_TYPES.concat(DATA_FIELD_TYPES);

const SUPPORTED_LANGUAGES = ["en", "kn", "fr"];
const DEFAULT_LANGUAGE = "kn";

module.exports = {
  CONTENT_FIELD_TYPES,
  DATA_FIELD_TYPES,
  ALL_FIELD_TYPES,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
};
