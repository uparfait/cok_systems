export const DCS_CONTENT_FIELD_TYPES = ["paragraph", "header", "file"];

export const DCS_DATA_FIELD_TYPES = [
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

export const DCS_ALL_FIELD_TYPES = DCS_CONTENT_FIELD_TYPES.concat(DCS_DATA_FIELD_TYPES);

/**
 * Registry entry shape: { type, labelKey, descriptionKey, category }.
 * category is "content" (layout/text blocks, no stored response) or
 * "data" (produces a value stored in a submission).
 */
export const DCS_FIELD_TYPE_REGISTRY = [
  { type: "paragraph", labelKey: "FIELD_TYPE_PARAGRAPH", descriptionKey: "FIELD_TYPE_PARAGRAPH_DESC", category: "content" },
  { type: "header", labelKey: "FIELD_TYPE_HEADER", descriptionKey: "FIELD_TYPE_HEADER_DESC", category: "content" },
  { type: "file", labelKey: "FIELD_TYPE_FILE", descriptionKey: "FIELD_TYPE_FILE_DESC", category: "content" },

  { type: "text", labelKey: "FIELD_TYPE_TEXT", descriptionKey: "FIELD_TYPE_TEXT_DESC", category: "data" },
  { type: "number", labelKey: "FIELD_TYPE_NUMBER", descriptionKey: "FIELD_TYPE_NUMBER_DESC", category: "data" },
  { type: "email", labelKey: "FIELD_TYPE_EMAIL", descriptionKey: "FIELD_TYPE_EMAIL_DESC", category: "data" },
  { type: "url", labelKey: "FIELD_TYPE_URL", descriptionKey: "FIELD_TYPE_URL_DESC", category: "data" },
  { type: "phone", labelKey: "FIELD_TYPE_PHONE", descriptionKey: "FIELD_TYPE_PHONE_DESC", category: "data" },
  { type: "single_select", labelKey: "FIELD_TYPE_SINGLE_SELECT", descriptionKey: "FIELD_TYPE_SINGLE_SELECT_DESC", category: "data" },
  { type: "multi_select", labelKey: "FIELD_TYPE_MULTI_SELECT", descriptionKey: "FIELD_TYPE_MULTI_SELECT_DESC", category: "data" },
  { type: "likert_scale", labelKey: "FIELD_TYPE_LIKERT_SCALE", descriptionKey: "FIELD_TYPE_LIKERT_SCALE_DESC", category: "data" },
  { type: "ranking", labelKey: "FIELD_TYPE_RANKING", descriptionKey: "FIELD_TYPE_RANKING_DESC", category: "data" },
  { type: "date", labelKey: "FIELD_TYPE_DATE", descriptionKey: "FIELD_TYPE_DATE_DESC", category: "data" },
  { type: "time", labelKey: "FIELD_TYPE_TIME", descriptionKey: "FIELD_TYPE_TIME_DESC", category: "data" },
  { type: "date_time", labelKey: "FIELD_TYPE_DATE_TIME", descriptionKey: "FIELD_TYPE_DATE_TIME_DESC", category: "data" },
  { type: "duration", labelKey: "FIELD_TYPE_DURATION", descriptionKey: "FIELD_TYPE_DURATION_DESC", category: "data" },
  { type: "image", labelKey: "FIELD_TYPE_IMAGE", descriptionKey: "FIELD_TYPE_IMAGE_DESC", category: "data" },
  { type: "video", labelKey: "FIELD_TYPE_VIDEO", descriptionKey: "FIELD_TYPE_VIDEO_DESC", category: "data" },
  { type: "audio", labelKey: "FIELD_TYPE_AUDIO", descriptionKey: "FIELD_TYPE_AUDIO_DESC", category: "data" },
  { type: "file_upload", labelKey: "FIELD_TYPE_FILE_UPLOAD", descriptionKey: "FIELD_TYPE_FILE_UPLOAD_DESC", category: "data" },
  { type: "signature", labelKey: "FIELD_TYPE_SIGNATURE", descriptionKey: "FIELD_TYPE_SIGNATURE_DESC", category: "data" },
  { type: "group", labelKey: "FIELD_TYPE_GROUP", descriptionKey: "FIELD_TYPE_GROUP_DESC", category: "data" },
  { type: "hidden", labelKey: "FIELD_TYPE_HIDDEN", descriptionKey: "FIELD_TYPE_HIDDEN_DESC", category: "data" },
  { type: "cascading_select", labelKey: "FIELD_TYPE_CASCADING_SELECT", descriptionKey: "FIELD_TYPE_CASCADING_SELECT_DESC", category: "data" },
];

/**
 * Generates a reasonably unique field id such as "text_a1b2c3".
 */
export function generate_field_id(field_type) {
  const random_part = Math.random().toString(36).slice(2, 8);
  return `${field_type}_${random_part}`;
}

/**
 * Produces a blank field definition for a newly added component, with
 * type-appropriate defaults (options array for selects, children for
 * groups, and so on).
 */
export function create_blank_field(field_type) {
  const base_field = {
    id: generate_field_id(field_type),
    type: field_type,
    label: { en: "", kn: "", fr: "" },
    placeholder: { en: "", kn: "", fr: "" },
    help_text: { en: "", kn: "", fr: "" },
    error_message: { en: "", kn: "", fr: "" },
    valid_message: { en: "", kn: "", fr: "" },
    mandatory: false,
    default_value: null,
    visibility_condition: null,
    validation_rules: [],
    computed: { enabled: false, formula: null },
  };

  if (["single_select", "multi_select"].includes(field_type)) {
    base_field.options = [{ id: generate_field_id("option"), label: { en: "", kn: "", fr: "" }, value: "" }];
  }
  if (field_type === "cascading_select") {
    base_field.parent_field_id = null;
    base_field.options = [{ id: generate_field_id("option"), label: { en: "", kn: "", fr: "" }, value: "", parent_value: "" }];
  }
  if (field_type === "likert_scale") {
    base_field.scale_size = 5;
    base_field.low_label = { en: "", kn: "", fr: "" };
    base_field.high_label = { en: "", kn: "", fr: "" };
  }
  if (field_type === "ranking") {
    base_field.options = [{ id: generate_field_id("option"), label: { en: "", kn: "", fr: "" }, value: "" }];
  }
  if (field_type === "group") {
    base_field.children = [];
  }
  if (field_type === "header") {
    base_field.level = 2;
  }
  if (field_type === "paragraph") {
    base_field.content = { en: "", kn: "", fr: "" };
  }
  if (field_type === "file") {
    base_field.file_url = "";
    base_field.file_name = "";
  }
  if (["image", "video", "audio", "file_upload"].includes(field_type)) {
    base_field.max_size_mb = 25;
    base_field.accepted_types = [];
  }
  if (field_type === "date" || field_type === "date_time") {
    base_field.exclude_weekends = false;
  }

  return base_field;
}
