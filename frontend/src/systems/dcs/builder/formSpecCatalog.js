import { DCS_FIELD_TYPE_REGISTRY } from "../fields/fieldTypes.js";
import { DCS_VALIDATION_OPERATORS, get_applicable_operators } from "./validationOperators.js";

/**
 * Plain-language description for every validation/visibility operator id,
 * shown alongside the mechanical operator list so an external AI (or a
 * human) understands what each one actually checks.
 */
const OPERATOR_DESCRIPTIONS = {
  equals: "Answer must equal the given value exactly.",
  not_equals: "Answer must NOT equal the given value.",
  includes: "Answer (a list, or a piece of text) must contain the given value.",
  not_includes: "Answer must NOT contain the given value.",
  starts_with: "Text answer must start with the given value.",
  ends_with: "Text answer must end with the given value.",
  length_is: "Text/selection length must equal exactly the given number.",
  min_length: "Text/selection length must be at least the given number.",
  max_length: "Text/selection length must be at most the given number.",
  words_is: "Text answer's word count must equal exactly the given number.",
  min_words: "Text answer's word count must be at least the given number.",
  max_words: "Text answer's word count must be at most the given number.",
  matches_pattern: "Text answer must match the given regular expression.",
  not_matches_pattern: "Text answer must NOT match the given regular expression.",
  greater_than: "Numeric answer must be greater than the given number.",
  less_than: "Numeric answer must be less than the given number.",
  min_value: "Numeric answer must be greater than or equal to the given number.",
  max_value: "Numeric answer must be less than or equal to the given number.",
  multiple_of: "Numeric answer must be an exact multiple of the given number.",
  is_integer: "Numeric answer must be a whole number.",
  is_positive: "Numeric answer must be greater than 0.",
  is_negative: "Numeric answer must be less than 0.",
  min_date: "Date answer must be on or after the given date.",
  max_date: "Date answer must be on or before the given date.",
  min_selections: "Multi-choice/ranking answer must have at least the given number of selections.",
  max_selections: "Multi-choice/ranking answer must have at most the given number of selections.",
  exact_selections: "Multi-choice/ranking answer must have exactly the given number of selections.",
  email_domain_in: "Email domain must be one of the given comma-separated domains.",
  email_domain_not_in: "Email domain must NOT be one of the given comma-separated domains.",
  url_domain_in: "URL hostname must be one of the given comma-separated domains.",
  url_domain_not_in: "URL hostname must NOT be one of the given comma-separated domains.",
  must_equal_field: "Answer must equal the current answer of another chosen field.",
  not_equal_field: "Answer must NOT equal the current answer of another chosen field.",
  max_file_size_mb: "Uploaded file size must be at most the given number of megabytes.",
  max_file_size_kb: "Uploaded file size must be at most the given number of kilobytes.",
  max_file_size_gb: "Uploaded file size must be at most the given number of gigabytes.",
  depends_on_parent: "Rule only applies (and requires 'value') when another chosen field currently equals 'parent_value'.",
};

/**
 * Hand-authored documentation for every field type: what it is, what extra
 * top-level properties it needs beyond the common ones, a real usage
 * example, and any gotchas. This is the part a generic schema dump can
 * never provide on its own - it is what actually lets an external AI (or a
 * person) produce a correct, working field on the first try.
 */
const TRANSLATED_TEXT_EXAMPLE = { en: "English text", kn: "Umwandiko mu Kinyarwanda", fr: "Texte en francais" };
const BLANK_TEXT = { en: "", kn: "", fr: "" };

function option_example(index) {
  const id = `option_${index}`;
  return { id, label: Object.assign({}, TRANSLATED_TEXT_EXAMPLE, { en: `Option ${index}` }), value: id };
}

const FIELD_TYPE_DOCS = {
  paragraph: {
    description: "A block of static, read-only body text - not a question, produces no answer in submissions.",
    extra_properties: { content: "Translated text object - the paragraph's own body text (supports plain line breaks)." },
    usage_notes: "Use for instructions, section intros or disclaimers. Design.list_type turns it into a bulleted/numbered list.",
    example: { id: "paragraph_ab12cd", type: "paragraph", content: Object.assign({}, TRANSLATED_TEXT_EXAMPLE, { en: "Please answer every question honestly." }), design: { spacing_below_px: 16 } },
  },
  header: {
    description: "A heading (like h1-h6) used to visually separate sections of the form - produces no answer.",
    extra_properties: { level: "Integer 1-6 - the heading level/size, 1 = largest." },
    usage_notes: "Use to break a long form into clearly labeled sections for the respondent.",
    example: { id: "header_ab12cd", type: "header", label: Object.assign({}, TRANSLATED_TEXT_EXAMPLE, { en: "Household information" }), level: 2, design: { spacing_below_px: 16 } },
  },
  file: {
    description: "Embeds a static, author-provided reference file (e.g. a guideline PDF) for the respondent to open - not something the respondent uploads.",
    extra_properties: { file_url: "Hosted URL of the file (uploaded to disk storage, or a plain link the author pasted in).", file_name: "Display name of the file." },
    usage_notes: "Different from 'file_upload': this is content the FORM shows, not an answer the respondent submits. Always fills the full row width - not individually resizable outside a Section.",
    example: { id: "file_ab12cd", type: "file", file_url: "", file_name: "guideline.pdf", design: { spacing_below_px: 16 } },
  },
  image_block: {
    description: "Embeds a static, author-provided image (e.g. a diagram or logo) - not something the respondent uploads.",
    extra_properties: { image_url: "Hosted URL of the image (uploaded to disk storage, or a plain link the author pasted in)." },
    usage_notes: "Different from 'image': this is content the FORM shows, not an answer the respondent submits. Always fills the full row width - not individually resizable outside a Section.",
    example: { id: "image_block_ab12cd", type: "image_block", image_url: "", design: { spacing_below_px: 16 } },
  },
  horizontal_line: {
    description: "A plain horizontal divider line - purely visual, produces no answer.",
    extra_properties: { thickness_px: "Line thickness in pixels (1-20)." },
    usage_notes: "design.border_color sets the line's own color (not a box border here).",
    example: { id: "horizontal_line_ab12cd", type: "horizontal_line", thickness_px: 2, design: { spacing_below_px: 16, border_color: "#E0E0E0", width_percent: 100 } },
  },
  section: {
    description: "A free-form canvas that lets several form-design components (paragraph, header, file, image_block, horizontal_line only - never data fields, never another section) sit side by side in the same area, each with its own position and size.",
    extra_properties: {
      height_px: "Pixel height of the whole section box.",
      children: "Array of child field objects (content types only), each with an added 'section_layout' object.",
    },
    usage_notes:
      "Each child needs section_layout: { x_percent, y_percent, width_percent, height_percent }, all 0-100, describing its position/size as a percentage of the section's own box. Below a 700px-wide screen, children automatically stack full-width instead (section_layout is ignored there).",
    example: {
      id: "section_ab12cd",
      type: "section",
      height_px: 240,
      children: [
        {
          id: "header_child01",
          type: "header",
          label: Object.assign({}, TRANSLATED_TEXT_EXAMPLE, { en: "Left column title" }),
          level: 3,
          section_layout: { x_percent: 0, y_percent: 0, width_percent: 45, height_percent: 30 },
        },
      ],
      design: { spacing_below_px: 16 },
    },
  },
  group: {
    description: "A visual box that groups several data-collection fields together under one shared label - purely organizational, not repeating.",
    extra_properties: { children: "Array of child field objects (any type)." },
    usage_notes: "Use to visually cluster related questions (e.g. 'Contact details'). Each child is answered and validated exactly as if it were top-level.",
    example: { id: "group_ab12cd", type: "group", label: Object.assign({}, TRANSLATED_TEXT_EXAMPLE, { en: "Contact details" }), children: [], design: { spacing_below_px: 16 } },
  },
  text: {
    description: "Single-line free text answer.",
    extra_properties: {},
    usage_notes: "Applicable validation operators: equals, not_equals, includes, not_includes, starts_with, ends_with, length_is, min_length, max_length, matches_pattern, not_matches_pattern, must_equal_field, not_equal_field, depends_on_parent.",
    example: { id: "text_ab12cd", type: "text", label: Object.assign({}, TRANSLATED_TEXT_EXAMPLE, { en: "Full name" }), mandatory: true, validation_rules: [], design: { spacing_below_px: 16 } },
  },
  large_text: {
    description: "Multi-line free text answer (a resizable text area), for longer responses than 'text' is meant for.",
    extra_properties: {
      rows: "Number - visible text area height in text rows (default 5).",
      length_limit_ui: "{ unit: 'characters'|'words', min: number|'', max: number|'', severity: 'error'|'warning' } - authoring-only convenience state the settings drawer uses to generate the matching min_length/max_length or min_words/max_words validation_rules; not evaluated itself.",
    },
    usage_notes: "Applicable validation operators: equals, not_equals, includes, not_includes, starts_with, ends_with, length_is, min_length, max_length, words_is, min_words, max_words, matches_pattern, not_matches_pattern, must_equal_field, not_equal_field, depends_on_parent.",
    example: { id: "large_text_ab12cd", type: "large_text", label: Object.assign({}, TRANSLATED_TEXT_EXAMPLE, { en: "Describe the issue in detail" }), rows: 5, mandatory: false, validation_rules: [], design: { spacing_below_px: 16 } },
  },
  number: {
    description: "Numeric answer.",
    extra_properties: {},
    usage_notes: "Applicable validation operators: equals, not_equals, min_value, max_value, multiple_of, is_integer, is_positive, is_negative, length_is, min_length, max_length, starts_with, ends_with, depends_on_parent.",
    example: { id: "number_ab12cd", type: "number", label: Object.assign({}, TRANSLATED_TEXT_EXAMPLE, { en: "Household size" }), mandatory: true, validation_rules: [], design: { spacing_below_px: 16 } },
  },
  email: {
    description: "Email address answer.",
    extra_properties: {},
    usage_notes: "Applicable validation operators: equals, not_equals, matches_pattern, max_length, email_domain_in, email_domain_not_in, must_equal_field, depends_on_parent.",
    example: { id: "email_ab12cd", type: "email", label: Object.assign({}, TRANSLATED_TEXT_EXAMPLE, { en: "Email address" }), mandatory: false, validation_rules: [], design: { spacing_below_px: 16 } },
  },
  url: {
    description: "Web link answer.",
    extra_properties: {},
    usage_notes: "Applicable validation operators: equals, not_equals, starts_with, ends_with, matches_pattern, max_length, url_domain_in, url_domain_not_in, depends_on_parent.",
    example: { id: "url_ab12cd", type: "url", label: Object.assign({}, TRANSLATED_TEXT_EXAMPLE, { en: "Website" }), mandatory: false, validation_rules: [], design: { spacing_below_px: 16 } },
  },
  phone: {
    description: "Phone number answer.",
    extra_properties: {},
    usage_notes: "Applicable validation operators: equals, not_equals, matches_pattern, min_length, max_length, must_equal_field, depends_on_parent.",
    example: { id: "phone_ab12cd", type: "phone", label: Object.assign({}, TRANSLATED_TEXT_EXAMPLE, { en: "Phone number" }), mandatory: true, validation_rules: [], design: { spacing_below_px: 16 } },
  },
  single_select: {
    description: "Choose exactly one option, rendered as touch-friendly radio rows.",
    extra_properties: {
      options: "Array of { id, label, value } - value is what gets stored/compared, must be unique across the field's own options. Ignored when parent_dependency_enabled is true.",
      parent_dependency_enabled: "Optional boolean, default false. When true, options come from parent_option_groups instead of the flat 'options' list.",
      parent_option_groups: "Only used when parent_dependency_enabled is true - array of { id, parent_field_id, operator, value, options }. operator is one of equals/not_equals/includes/not_includes/less_than/greater_than, compared against the current answer of parent_field_id. Every group whose condition currently matches contributes its own 'options' (same shape as the top-level options) to what the respondent sees; with none matching, the field has nothing to select. Different groups may reference entirely different parent fields.",
    },
    usage_notes:
      "Applicable validation operators: equals, not_equals, includes, not_includes, depends_on_parent. Prefer select_group instead when the option list is long (10+). For a single always-on parent link, cascading_select is simpler; parent_option_groups is for multiple different conditions/parents feeding into one field's own options.",
    example: { id: "single_select_ab12cd", type: "single_select", label: Object.assign({}, TRANSLATED_TEXT_EXAMPLE, { en: "Gender" }), options: [option_example(1), option_example(2)], mandatory: true, validation_rules: [], design: { spacing_below_px: 16 } },
  },
  select_group: {
    description: "Choose exactly one option from a native dropdown - functionally identical to single_select but far more compact for long option lists.",
    extra_properties: {
      options: "Array of { id, label, value } - value is what gets stored/compared, must be unique across the field's own options. Ignored when parent_dependency_enabled is true.",
      parent_dependency_enabled: "Optional boolean, default false. When true, options come from parent_option_groups instead of the flat 'options' list.",
      parent_option_groups: "Only used when parent_dependency_enabled is true - array of { id, parent_field_id, operator, value, options }. operator is one of equals/not_equals/includes/not_includes/less_than/greater_than, compared against the current answer of parent_field_id. Every group whose condition currently matches contributes its own 'options' (same shape as the top-level options) to what the respondent sees; with none matching, the field has nothing to select. Different groups may reference entirely different parent fields.",
    },
    usage_notes:
      "Applicable validation operators: equals, not_equals, includes, not_includes, depends_on_parent. For a single always-on parent link, cascading_select is simpler; parent_option_groups is for multiple different conditions/parents feeding into one field's own options.",
    example: { id: "select_group_ab12cd", type: "select_group", label: Object.assign({}, TRANSLATED_TEXT_EXAMPLE, { en: "District" }), options: [option_example(1), option_example(2)], mandatory: true, validation_rules: [], design: { spacing_below_px: 16 } },
  },
  geolocation: {
    description: "Captures a location: search by place name or auto-detect the respondent's current position, reverse-geocoded into Rwanda's administrative levels (province/district/sector/cell/village/street) whenever online. Carries no question label of its own, like paragraph/file.",
    extra_properties: {},
    usage_notes:
      "Has no Validation tab and no applicable validation operators - coordinates are always device-detected (never typed), falling back to (0, 0) when detection is unavailable, so there is nothing meaningful to validate. The stored answer is always an object: { __map__location__data: true, latitude, longitude, accuracy, province, district, sector, cell, village, street, full_address, is_manual } - the __map__location__data flag is a fixed marker (always true) letting any code inspecting raw submission data identify a geolocation answer unambiguously; any address field the reverse geocoder could not resolve, or that was never looked up (offline), is null. 'mandatory' is satisfied once latitude/longitude are set, regardless of whether the address fields resolved.",
    example: { id: "geolocation_ab12cd", type: "geolocation", mandatory: true, validation_rules: [], design: { spacing_below_px: 16 } },
  },
  cascading_select: {
    description: "A dropdown whose visible options are filtered by the current answer of another ('parent') single-choice field - e.g. District depends on Province.",
    extra_properties: {
      parent_field_id: "The id of the field this one depends on.",
      options: "Array of { id, label, value, parent_value } - parent_value must match one of the parent field's own option values.",
    },
    usage_notes: "Applicable validation operators: equals, not_equals, includes, not_includes, depends_on_parent. The parent field must appear earlier in the form and be a choice-type field.",
    example: {
      id: "cascading_select_ab12cd",
      type: "cascading_select",
      label: Object.assign({}, TRANSLATED_TEXT_EXAMPLE, { en: "District" }),
      parent_field_id: "single_select_ab12cd",
      options: [Object.assign({}, option_example(1), { parent_value: "option_1" })],
      mandatory: false,
      validation_rules: [],
      design: { spacing_below_px: 16 },
    },
  },
  multi_select: {
    description: "Choose zero or more options, rendered as checkboxes.",
    extra_properties: {
      options: "Array of { id, label, value } - value must be unique across the field's own options. Ignored when parent_dependency_enabled is true.",
      parent_dependency_enabled: "Optional boolean, default false. When true, options come from parent_option_groups instead of the flat 'options' list.",
      parent_option_groups: "Only used when parent_dependency_enabled is true - array of { id, parent_field_id, operator, value, options }. operator is one of equals/not_equals/includes/not_includes/less_than/greater_than, compared against the current answer of parent_field_id. Every group whose condition currently matches contributes its own 'options' (same shape as the top-level options) to what the respondent sees; with none matching, every checkbox is disabled. Different groups may reference entirely different parent fields.",
    },
    usage_notes:
      "Applicable validation operators: includes, not_includes, min_selections, max_selections, exact_selections, depends_on_parent. Stored answer is an array of the selected values.",
    example: { id: "multi_select_ab12cd", type: "multi_select", label: Object.assign({}, TRANSLATED_TEXT_EXAMPLE, { en: "Which services did you use?" }), options: [option_example(1), option_example(2)], mandatory: false, validation_rules: [], design: { spacing_below_px: 16 } },
  },
  likert_scale: {
    description: "Rate agreement on a numbered scale (e.g. 1-5), with optional low/high end labels.",
    extra_properties: { scale_size: "Integer 2-10 - number of points on the scale.", low_label: "Translated text shown at the low end.", high_label: "Translated text shown at the high end." },
    usage_notes: "Applicable validation operators: min_value, max_value, not_equals, depends_on_parent. Stored answer is the chosen integer.",
    example: { id: "likert_scale_ab12cd", type: "likert_scale", label: Object.assign({}, TRANSLATED_TEXT_EXAMPLE, { en: "How satisfied are you with this service?" }), scale_size: 5, low_label: Object.assign({}, BLANK_TEXT, { en: "Not satisfied" }), high_label: Object.assign({}, BLANK_TEXT, { en: "Very satisfied" }), mandatory: false, validation_rules: [], design: { spacing_below_px: 16 } },
  },
  ranking: {
    description: "Order a fixed list of options by preference, using move-up/move-down controls.",
    extra_properties: { options: "Array of { id, label, value } - defines the items to be ranked." },
    usage_notes: "Applicable validation operators: min_selections, max_selections, exact_selections, depends_on_parent. Stored answer is an array of values in the respondent's chosen order.",
    example: { id: "ranking_ab12cd", type: "ranking", label: Object.assign({}, TRANSLATED_TEXT_EXAMPLE, { en: "Rank these by importance" }), options: [option_example(1), option_example(2)], mandatory: false, validation_rules: [], design: { spacing_below_px: 16 } },
  },
  date: {
    description: "Calendar date answer.",
    extra_properties: { exclude_weekends: "Boolean - when true, Saturdays/Sundays cannot be picked." },
    usage_notes: "Applicable validation operators: min_date, max_date, depends_on_parent. Stored answer is an ISO date string.",
    example: { id: "date_ab12cd", type: "date", label: Object.assign({}, TRANSLATED_TEXT_EXAMPLE, { en: "Date of birth" }), mandatory: true, exclude_weekends: false, validation_rules: [], design: { spacing_below_px: 16 } },
  },
  time: {
    description: "Time-only answer.",
    extra_properties: {},
    usage_notes: "Applicable validation operators: min_value, max_value, depends_on_parent.",
    example: { id: "time_ab12cd", type: "time", label: Object.assign({}, TRANSLATED_TEXT_EXAMPLE, { en: "Preferred visit time" }), mandatory: false, validation_rules: [], design: { spacing_below_px: 16 } },
  },
  date_time: {
    description: "Combined date-and-time answer.",
    extra_properties: { exclude_weekends: "Boolean - when true, Saturdays/Sundays cannot be picked." },
    usage_notes: "Applicable validation operators: min_date, max_date, depends_on_parent.",
    example: { id: "date_time_ab12cd", type: "date_time", label: Object.assign({}, TRANSLATED_TEXT_EXAMPLE, { en: "Interview start" }), mandatory: false, exclude_weekends: false, validation_rules: [], design: { spacing_below_px: 16 } },
  },
  duration: {
    description: "A length of time entered as a number (e.g. minutes).",
    extra_properties: {},
    usage_notes: "Applicable validation operators: same numeric set as 'number' (equals, not_equals, min_value, max_value, multiple_of, is_integer, is_positive, is_negative, length_is, min_length, max_length, depends_on_parent).",
    example: { id: "duration_ab12cd", type: "duration", label: Object.assign({}, TRANSLATED_TEXT_EXAMPLE, { en: "Interview duration (minutes)" }), mandatory: false, validation_rules: [], design: { spacing_below_px: 16 } },
  },
  image: {
    description: "Respondent captures or uploads a photo. Uploaded straight to disk storage the moment it's picked - the submission only ever holds {name, type, size, url} (or a plain {url, is_link:true} if the respondent pasted a link instead), never the file's own bytes.",
    extra_properties: {
      max_size_value: "Number or null - rejects files larger than this, in max_size_unit's unit (null = unlimited, the default).",
      max_size_unit: "One of 'kb', 'mb', 'gb' - defaults to 'mb'.",
      allowed_file_type_groups: "Array of group keys restricting accepted extensions, e.g. ['images']. Empty = unrestricted. Valid keys: images, documents, videos, audio.",
      allow_link_input: "Boolean - when true, the respondent may paste a URL instead of uploading a file.",
    },
    usage_notes: "Applicable validation operators: max_file_size_mb, max_file_size_kb, max_file_size_gb, depends_on_parent.",
    example: { id: "image_ab12cd", type: "image", label: Object.assign({}, TRANSLATED_TEXT_EXAMPLE, { en: "Photo of the site" }), mandatory: false, max_size_value: null, max_size_unit: "mb", allowed_file_type_groups: ["images"], allow_link_input: false, validation_rules: [], design: { spacing_below_px: 16 } },
  },
  video: {
    description: "Respondent captures or uploads a video. Uploaded straight to disk storage the moment it's picked - the submission only ever holds {name, type, size, url}, never the file's own bytes.",
    extra_properties: {
      max_size_value: "Number or null - rejects files larger than this, in max_size_unit's unit (null = unlimited, the default).",
      max_size_unit: "One of 'kb', 'mb', 'gb' - defaults to 'mb'.",
      allowed_file_type_groups: "Array of group keys restricting accepted extensions, e.g. ['videos']. Empty = unrestricted. Valid keys: images, documents, videos, audio.",
      allow_link_input: "Boolean - when true, the respondent may paste a URL instead of uploading a file.",
    },
    usage_notes: "Applicable validation operators: max_file_size_mb, max_file_size_kb, max_file_size_gb, depends_on_parent.",
    example: { id: "video_ab12cd", type: "video", label: Object.assign({}, TRANSLATED_TEXT_EXAMPLE, { en: "Video walkthrough" }), mandatory: false, max_size_value: null, max_size_unit: "mb", allowed_file_type_groups: ["videos"], allow_link_input: false, validation_rules: [], design: { spacing_below_px: 16 } },
  },
  audio: {
    description: "Respondent records or uploads audio. Uploaded straight to disk storage the moment it's picked - the submission only ever holds {name, type, size, url}, never the file's own bytes.",
    extra_properties: {
      max_size_value: "Number or null - rejects files larger than this, in max_size_unit's unit (null = unlimited, the default).",
      max_size_unit: "One of 'kb', 'mb', 'gb' - defaults to 'mb'.",
      allowed_file_type_groups: "Array of group keys restricting accepted extensions, e.g. ['audio']. Empty = unrestricted. Valid keys: images, documents, videos, audio.",
      allow_link_input: "Boolean - when true, the respondent may paste a URL instead of uploading a file.",
    },
    usage_notes: "Applicable validation operators: max_file_size_mb, max_file_size_kb, max_file_size_gb, depends_on_parent.",
    example: { id: "audio_ab12cd", type: "audio", label: Object.assign({}, TRANSLATED_TEXT_EXAMPLE, { en: "Voice note" }), mandatory: false, max_size_value: null, max_size_unit: "mb", allowed_file_type_groups: ["audio"], allow_link_input: false, validation_rules: [], design: { spacing_below_px: 16 } },
  },
  file_upload: {
    description: "Respondent uploads any file (pdf, docx, spreadsheet, etc.). Uploaded straight to disk storage the moment it's picked - the submission only ever holds {name, type, size, url}, never the file's own bytes.",
    extra_properties: {
      max_size_value: "Number or null - rejects files larger than this, in max_size_unit's unit (null = unlimited, the default).",
      max_size_unit: "One of 'kb', 'mb', 'gb' - defaults to 'mb'.",
      allowed_file_type_groups: "Array of group keys restricting accepted extensions, e.g. ['documents']. Empty = unrestricted. Valid keys: images, documents, videos, audio.",
      allow_link_input: "Boolean - when true, the respondent may paste a URL instead of uploading a file.",
    },
    usage_notes: "Applicable validation operators: max_file_size_mb, max_file_size_kb, max_file_size_gb, depends_on_parent.",
    example: { id: "file_upload_ab12cd", type: "file_upload", label: Object.assign({}, TRANSLATED_TEXT_EXAMPLE, { en: "Supporting document" }), mandatory: false, max_size_value: null, max_size_unit: "mb", allowed_file_type_groups: [], allow_link_input: false, validation_rules: [], design: { spacing_below_px: 16 } },
  },
  signature: {
    description: "Respondent draws a signature on a canvas, exported as a PNG and uploaded straight to disk storage - the submission only ever holds {name, type, size, url}, never the image's own bytes.",
    extra_properties: {},
    usage_notes: "Applicable validation operators: max_file_size_mb, max_file_size_kb, max_file_size_gb, depends_on_parent.",
    example: { id: "signature_ab12cd", type: "signature", label: Object.assign({}, TRANSLATED_TEXT_EXAMPLE, { en: "Respondent signature" }), mandatory: true, validation_rules: [], design: { spacing_below_px: 16 } },
  },
  hidden: {
    description: "Not shown to the respondent - either pre-filled by the link/context, or computed live from other answers.",
    extra_properties: { computed: "{ enabled: boolean, formula: <JSONLogic object> } - when enabled, the value is recalculated from other answers on every change." },
    usage_notes: "Use 'computed.formula' with JSONLogic to derive a value, e.g. { \"+\": [{ \"var\": \"number_a\" }, { \"var\": \"number_b\" }] } to sum two numeric fields. Standard JSONLogic operators (var, ==, !=, >, <, >=, <=, +, -, *, /, %, if, and, or, !, in, cat) are all available, plus this system's custom operators (see validation_operators_reference).",
    example: { id: "hidden_ab12cd", type: "hidden", computed: { enabled: true, formula: { "+": [{ var: "number_a" }, { var: "number_b" }] } }, design: { spacing_below_px: 16 } },
  },
};

/**
 * Assembles the full, self-contained "how to build a DCS form" document -
 * derived live from this app's own field type registry and validation
 * operator tables (so it can never silently drift out of date), plus the
 * hand-authored per-type usage documentation above. Meant to be copied
 * verbatim and pasted into an external AI assistant alongside a plain-
 * language description of the desired form, so the AI can reply with a
 * ready-to-paste form JSON.
 */
export function build_form_creation_guide(selected_types) {
  const type_filter = selected_types && selected_types.length > 0 ? new Set(selected_types) : null;
  const field_types = {};
  DCS_FIELD_TYPE_REGISTRY.forEach((entry) => {
    if (type_filter && !type_filter.has(entry.type)) return;
    const docs = FIELD_TYPE_DOCS[entry.type] || {};
    field_types[entry.type] = {
      category: entry.category,
      description: docs.description || "",
      extra_properties: docs.extra_properties || {},
      usage_notes: docs.usage_notes || "",
      applicable_validation_operators: entry.category === "data" ? get_applicable_operators(entry.type).map((operator) => operator.id) : [],
      example: docs.example || null,
    };
  });

  return {
    how_to_use: [
      "This document fully describes the Data Collection System (DCS) form schema used by this application.",
      "Paste this ENTIRE document into an external AI assistant together with a plain-language description of the form you want built.",
      "Ask the AI to reply with ONLY one JSON object shaped like { \"fields\": [ ... ] } - no prose, no markdown code fences - built strictly from the field_types described below.",
      "Copy that JSON reply, paste it into the 'Paste form JSON here' box in this same overlay, then click 'Create form'.",
      "Every field id must be a unique string across the whole form, including inside group/section children. Recommended pattern: '<type>_<6 random lowercase letters/digits>', e.g. 'text_a1b2c3'.",
      "Every translated text value (label, help_text, placeholder, required_message, valid_message, option labels, low_label/high_label, paragraph content) is an object with 'en', 'kn' and 'fr' string keys. A blank string for a language is fine.",
      "After pasting, choose 'Add pasted fields' to append them after whatever is already on the canvas, or 'Overwrite with pasted fields' to replace the canvas entirely.",
      "Instead of writing every field of a saved template out by hand, one entry in 'fields' can be a template placeholder (see template_placeholder_shape) referencing it by id - it is expanded into real fields automatically.",
    ],
    top_level_form_shape: {
      fields: "Array of field objects, in the order they should render top to bottom. This is the entire schema - there is no other top-level key.",
    },
    template_placeholder_shape: {
      description: "One entry in 'fields' (or in a group/section's 'children') can be this shape instead of a real field, to import a previously saved template's fields in place.",
      __is__template__: "Required string - the target template's id.",
      fields: "Optional array. Leave empty ([]) to have the template's fields fetched and expanded automatically. Or pre-fill it with the template's own already-known field objects to skip the fetch.",
      note: "Every field produced by expanding a placeholder is tagged with its own __is__template__ property (the source template's id) - this is separate from the placeholder itself and is just provenance, not something to set by hand.",
      example: { __is__template__: "648f1c2b9a1e4d0012ab34cd", fields: [] },
    },
    common_field_properties: {
      id: "Required, unique string across the whole form.",
      type: "Required. One of the keys listed in field_types below.",
      label: "Translated text object - the question/heading text. Not used by 'paragraph' or 'file'.",
      placeholder: "Translated text object - only meaningful for text, number, email, url, phone.",
      help_text: "Translated text object - small hint shown under the label.",
      mandatory: "Boolean - whether an answer is required. Not applicable to content-only types (paragraph, header, file, image_block, horizontal_line, section) or 'hidden'.",
      required_message: "Translated text object - error shown when mandatory and left blank.",
      valid_message: "Translated text object - small confirmation shown once a valid answer is given.",
      default_value: "Optional pre-filled value, or null.",
      validation_rules: "Array of validation rule objects (see validation_rule_shape) - empty array if none. Not applicable to content-only types.",
      visibility_condition: "A JSONLogic object, or null to always show the field (see visibility_condition).",
      computed: "{ enabled: boolean, formula: <JSONLogic object|null> } - only meaningfully used on 'hidden' fields (see field_types.hidden).",
      design: "Design object (see design_object) - present on every field type.",
    },
    design_object: {
      spacing_below_px: "Number, default 16 - the vertical gap left below this component before the next one.",
      full_device_width: "Boolean, content types only (paragraph, header, file, image_block, horizontal_line, section) - true breaks the component out to the full device width instead of the form's own column width.",
      width_percent: "Number 0-100, content types only (except image_block), ignored when full_device_width is true - how wide this component's own column is, as a percent of the form width.",
      offset_percent: "Number 0-100, content types only (except image_block), ignored when full_device_width is true - horizontal position of the column within the remaining slack (0 = flush left, 100 = flush right).",
      background_color: "Hex color string or null - box background color. Applies to every type except horizontal_line.",
      border_enabled: "Boolean - whether the component has its own box border. Applies to every type except horizontal_line.",
      border_color: "Hex color string - box border color (or, for horizontal_line specifically, the line's own color).",
      border_width: "Number, pixels - box border thickness (not used by horizontal_line).",
      text_color: "Hex color string, header/paragraph only - the text color.",
      font_family: "CSS font-family string, header/paragraph only.",
      list_type: "One of 'disc','circle','square','decimal','lower-roman','upper-roman','none' - paragraph only, renders it as a list.",
    },
    validation_rule_shape: {
      id: "Unique string within the field's own validation_rules array.",
      operator: "One of the validation_operators_reference ids that is applicable to this field's type (see field_types.<type>.applicable_validation_operators).",
      value: "The value the operator checks against (string/number as appropriate) - omit/blank when the operator does not need one (see needs_value in validation_operators_reference).",
      parent_field_id: "Only for operators that need a parent field (must_equal_field, not_equal_field, depends_on_parent) - the id of the other field being compared against.",
      parent_value: "Only for 'depends_on_parent' - the value the parent field must currently equal for this rule to apply.",
      message: "Translated text object - the error shown when this rule fails (severity 'error') or a warning is shown (severity 'warning').",
      valid_message: "Translated text object - shown once this rule currently passes.",
      severity: "'error' (blocks submission) or 'warning' (shown but does not block submission).",
      condition: "The actual JSONLogic condition evaluated - build it yourself following the pattern for that operator id (see validation_operators_reference), or omit it and this app will not auto-generate it for a hand-authored/pasted rule, so always include a correct 'condition'.",
    },
    visibility_condition: {
      description: "A JSONLogic object evaluated against all of the form's current answers (by field id) - when it evaluates to a value other than false, the field is shown; null means always shown.",
      example: { "==": [{ var: "single_select_ab12cd" }, "option_1" ] },
    },
    validation_operators_reference: DCS_VALIDATION_OPERATORS.map((operator) => ({
      id: operator.id,
      description: OPERATOR_DESCRIPTIONS[operator.id] || "",
      needs_value: !!operator.needsValue,
      needs_parent_field: !!operator.needsParent,
      needs_parent_value: !!operator.needsParentValue,
    })),
    jsonlogic_reference: {
      standard_operators: "var, ==, !=, >, <, >=, <=, +, -, *, /, %, if, and, or, !, in, cat, missing, merge - the full standard JSONLogic operator set (used by computed formulas and hand-built conditions).",
      custom_operators: [
        "starts_with(value, prefix)", "ends_with(value, suffix)", "regex_match(value, pattern, flags?)",
        "in_array(value, arrayOrString)", "not_in_array(value, arrayOrString)",
        "length_is(value, n)", "min_length(value, n)", "max_length(value, n)",
        "words_is(value, n)", "min_words(value, n)", "max_words(value, n)",
        "email_domain_in(email, csvDomains)", "email_domain_not_in(email, csvDomains)",
        "url_domain_in(url, csvDomains)", "url_domain_not_in(url, csvDomains)",
        "date_diff_days(dateA, dateB)", "gps_accuracy_ok(accuracyMeters, thresholdMeters)",
      ],
    },
    field_types,
  };
}
