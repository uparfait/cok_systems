const { flatten_fields } = require("../jsonlogic/dependency_graph.js");
const { SUBMITTED_AT_FIELD, TIME_SOURCE_FIELDS } = require("./constants.js");

/**
 * Classifies a form's fields into the roles the dashboard understands:
 * categorical fields can group and split, numeric fields can be summed and
 * plotted on scatter axes, date fields (plus the submitted_at pseudo field)
 * can drive time series. Everything else (free text, media, signatures) is
 * not chartable and never offered.
 */

const CATEGORICAL_TYPES = ["single_select", "multi_select", "cascading_select", "select_group", "likert_scale"];
const MULTI_VALUE_TYPES = ["multi_select", "ranking"];
const NUMERIC_TYPES = ["number"];
// The one field type that captures a real position: latitude, longitude
// and what was read back around them.
const GEO_TYPES = ["geolocation"];
const DATE_TYPES = ["date", "date_time"];

/**
 * A DERIVED field: a hidden field the form computes itself (a status that
 * follows from other answers, a total, a comparison). Its value is stored
 * with the answers at submission, so a dashboard may read it like any
 * answered field - group, split, legend or filter by it when it holds a
 * label, sum or average it when it holds a number. Both roles are open
 * because the catalog cannot know which a formula yields; a numeric
 * formula on a label simply skips every answer, as on any text field.
 */
function is_derived_field(field) {
  return !!field && field.type === "hidden" && !!field.computed && field.computed.enabled === true;
}

function field_label_text(field) {
  if (field && field.label) {
    return field.label.en || field.label.kn || field.label.fr || field.id;
  }
  return field ? field.id : "";
}

/**
 * Mirrors the frontend's parent link resolution: a cascading_select points
 * at its parent via parent_field_id, a parent-dependent select_group via
 * its parent_option_groups. Used by the treemap to nest child values under
 * their own parent values.
 */
function parent_field_id_of(field, fields_by_id) {
  if (!field) return null;
  if (field.parent_field_id && fields_by_id.has(field.parent_field_id)) return field.parent_field_id;
  if (field.type === "select_group" && field.parent_dependency_enabled) {
    const group = (field.parent_option_groups || []).find(
      (entry) => entry && entry.parent_field_id && fields_by_id.has(entry.parent_field_id),
    );
    if (group) return group.parent_field_id;
  }
  return null;
}

/**
 * The full catalog for one form schema: a Map of id -> field plus the field
 * ids usable in each dashboard role.
 */
function build_field_catalog(schema) {
  const flat = flatten_fields((schema && schema.fields) || []);
  const fields_by_id = new Map(flat.map((field) => [field.id, field]));

  const categorical = [];
  const numeric = [];
  const dates = [];
  const geo = [];
  const derived = [];
  flat.forEach((field) => {
    if (!field || !field.id) return;
    if (is_derived_field(field)) {
      derived.push(field.id);
      categorical.push(field.id);
      numeric.push(field.id);
    }
    if (CATEGORICAL_TYPES.includes(field.type)) categorical.push(field.id);
    if (NUMERIC_TYPES.includes(field.type)) numeric.push(field.id);
    if (DATE_TYPES.includes(field.type)) dates.push(field.id);
    if (GEO_TYPES.includes(field.type)) geo.push(field.id);
  });

  return {
    fields_by_id,
    categorical_ids: categorical,
    numeric_ids: numeric,
    date_ids: dates,
    geo_ids: geo,
    derived_ids: derived,
  };
}

function is_categorical(catalog, field_id) {
  return catalog.categorical_ids.includes(field_id);
}

function is_numeric(catalog, field_id) {
  return catalog.numeric_ids.includes(field_id);
}

function is_time_source(catalog, field_id) {
  return TIME_SOURCE_FIELDS.includes(field_id) || catalog.date_ids.includes(field_id);
}

/**
 * True when the field stores an array of values (each entry must be counted
 * on its own, so its pipeline unwinds before grouping).
 */
function is_multi_value(catalog, field_id) {
  const field = catalog.fields_by_id.get(field_id);
  return !!field && MULTI_VALUE_TYPES.includes(field.type);
}

module.exports = {
  build_field_catalog,
  is_derived_field,
  field_label_text,
  parent_field_id_of,
  is_categorical,
  is_numeric,
  is_time_source,
  is_multi_value,
};
