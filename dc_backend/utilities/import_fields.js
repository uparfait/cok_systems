const { NON_DATA_TYPES, flatten_fields, get_field_text } = require("./export_columns.js");

/**
 * The fields a CSV import can fill on a form version, described for the
 * mapping screen and for the headers template. A field is fillable when
 * a respondent could answer it: layout blocks (sections, headings,
 * paragraphs, shown files and images), computed fields and constant
 * presets (the form writes those itself) are left out. A location field
 * is one field with three sub-targets: latitude, longitude, accuracy.
 */
const LANGUAGES = ["en", "kn", "fr"];
const OPTION_TYPES = ["single_select", "multi_select", "ranking", "select_group", "cascading_select"];
const GEO_PARTS = ["latitude", "longitude", "accuracy"];

function is_fillable(field) {
  if (!field || typeof field !== "object" || !field.type || !field.id) return false;
  if (NON_DATA_TYPES.includes(field.type)) return false;
  if (field.computed && field.computed.enabled && field.computed.formula) return false;
  const preset = field.default_config;
  if (preset && preset.enabled === true && preset.mode === "constant") return false;
  return true;
}

/** The same header text the export writes, then any language, then the field id. */
function import_label(field, language, translate) {
  const own = get_field_text(field.label, language);
  if (own) return own;
  if (field.type === "geolocation") return translate("DCS_GEO_TABLE_HEADER_LABEL", language);
  const any = LANGUAGES.map((code) => get_field_text(field.label, code)).find(Boolean);
  return any || field.id;
}

/** Every spelling a CSV header may use for this field: its labels in every language and its id. */
function field_names(field, label) {
  const names = new Set([label, field.id]);
  LANGUAGES.forEach((code) => {
    const text = get_field_text(field.label, code);
    if (text) names.add(text);
  });
  return Array.from(names);
}

const is_api_sourced = (field) => !!(field.data_source && field.data_source.type === "api");

/** A field's options, its own and those of every parent-driven group, each once. */
function all_options(field) {
  const own = Array.isArray(field.options) ? field.options : [];
  const grouped = (Array.isArray(field.parent_option_groups) ? field.parent_option_groups : []).flatMap((group) => (group && Array.isArray(group.options) ? group.options : []));
  const seen = new Set();
  return own.concat(grouped).filter((option) => {
    if (!option || option.value === undefined || option.value === null || String(option.value).trim() === "") return false;
    const key = String(option.value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function option_views(field, language) {
  return all_options(field).map((option) => ({
    value: option.value,
    label: get_field_text(option.label, language) || String(option.value),
  }));
}

function describe_field(field, language, translate) {
  const label = import_label(field, language, translate);
  const view = {
    id: field.id,
    label,
    names: field_names(field, label),
    type: field.type,
    required: field.mandatory === true,
  };
  if (OPTION_TYPES.includes(field.type)) {
    view.options = option_views(field, language);
    view.api_sourced = is_api_sourced(field);
  }
  if (field.type === "likert_scale") view.scale_size = Number(field.scale_size) || 5;
  if (field.type === "geolocation") view.sub_targets = GEO_PARTS.slice();
  return view;
}

/** The fillable fields of a version, in form order, as the client sees them. */
function fillable_fields(version_doc, language, translate) {
  const schema = (version_doc && version_doc.schema) || {};
  return flatten_fields(schema.fields)
    .filter(is_fillable)
    .map((field) => describe_field(field, language, translate));
}

/** The raw schema fields behind the fillable list, by id - what value conversion reads. */
function fillable_schema_fields(version_doc) {
  const schema = (version_doc && version_doc.schema) || {};
  return new Map(flatten_fields(schema.fields).filter(is_fillable).map((field) => [field.id, field]));
}

/**
 * One header per field; a location field spreads into "<label> latitude",
 * "<label> longitude", "<label> accuracy" - the very three columns the
 * export writes for it (utilities/export_columns.js).
 */
function template_headers(fields) {
  const headers = [];
  fields.forEach((field) => {
    if (field.type === "geolocation") GEO_PARTS.forEach((part) => headers.push(`${field.label} ${part}`));
    else headers.push(field.label);
  });
  return headers;
}

module.exports = {
  OPTION_TYPES,
  GEO_PARTS,
  is_fillable,
  import_label,
  all_options,
  is_api_sourced,
  fillable_fields,
  fillable_schema_fields,
  template_headers,
};
