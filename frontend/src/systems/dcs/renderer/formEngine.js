import { evaluate_rule, build_trimmed_evaluation_data } from "../jsonlogic/engine.js";
import { build_dependency_graph, flatten_fields, build_field_parent_map, is_visible_through_ancestors } from "../jsonlogic/dependencyGraph.js";
import { get_field_options_state } from "../fields/fieldText.js";

const PARENT_GROUP_CAPABLE_TYPES = ["single_select", "multi_select", "select_group"];

/**
 * True when a field should currently be shown, given the rest of the
 * answers so far. Fields without a visibility_condition are always shown.
 * A rule evaluation error fails open (visible), mirroring the server.
 * Evaluated against a trimmed snapshot of the answers so an earlier
 * answer's accidental leading/trailing whitespace never flips this field's
 * visibility live while the respondent is still typing - values itself is
 * never touched.
 */
export function evaluate_field_visibility(field, values) {
  if (!field.visibility_condition) return true;
  const result = evaluate_rule(field.visibility_condition, build_trimmed_evaluation_data(values || {}));
  return result.error ? true : result.value !== false;
}

/**
 * Recomputes every enabled computed field's value, in dependency-safe
 * order, so hidden/derived fields always reflect the latest answers - used
 * identically on the client as the server uses at submission time.
 */
export function compute_derived_values(schema, values) {
  const flat_fields = flatten_fields(schema.fields);
  const fields_by_id = new Map(flat_fields.map((field) => [field.id, field]));
  const dependency_result = build_dependency_graph(schema.fields);
  const evaluation_order = dependency_result.order.length > 0 ? dependency_result.order : [...fields_by_id.keys()];

  const working_values = Object.assign({}, values);

  evaluation_order.forEach((field_id) => {
    const field = fields_by_id.get(field_id);
    if (!field || !field.computed || !field.computed.enabled || !field.computed.formula) return;
    const result = evaluate_rule(field.computed.formula, build_trimmed_evaluation_data(working_values));
    working_values[field_id] = result.value;
  });

  return working_values;
}

// Content-only blocks (paragraph, header, ...), groups/sections themselves
// (their children are counted individually instead) and hidden fields
// (never shown to the respondent, so there is nothing for them to "fill")
// never count toward the completion percentage.
const PROGRESS_EXCLUDED_TYPES = new Set([
  "paragraph", "header", "file", "image_block", "horizontal_line", "section", "group", "hidden",
]);

function is_value_filled(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return String(value).trim().length > 0;
}

/**
 * Percentage of the form's currently-visible, answerable fields that
 * already have a value - the respondent's own progress, not a fixed
 * question count, since a field hidden by a conditional rule was never
 * something they needed to fill in.
 */
export function compute_form_progress_percent(fields, values) {
  const flat_fields = flatten_fields(fields || []);
  const parent_map = build_field_parent_map(fields || []);
  // A field's own visibility only ever describes itself - a group or
  // section hidden by its own visibility_condition can contain a child
  // field with no visibility_condition of its own at all, and that child
  // was never something the respondent could see (or needed to fill in)
  // either.
  const own_visible_by_id = new Map(flat_fields.map((field) => [field.id, evaluate_field_visibility(field, values)]));

  const answerable_fields = flat_fields.filter((field) => {
    if (PROGRESS_EXCLUDED_TYPES.has(field.type)) return false;
    if (!own_visible_by_id.get(field.id) || !is_visible_through_ancestors(field.id, parent_map, own_visible_by_id)) return false;
    // A select-family field split into parent-driven condition groups
    // renders nothing at all once no group currently matches - it was
    // never something the respondent needed (or could) fill in either.
    if (PARENT_GROUP_CAPABLE_TYPES.includes(field.type) && field.parent_dependency_enabled) {
      return !get_field_options_state(field, build_trimmed_evaluation_data(values), false).is_locked;
    }
    return true;
  });
  if (answerable_fields.length === 0) return 100;
  const filled_count = answerable_fields.filter((field) => is_value_filled(values ? values[field.id] : undefined)).length;
  return Math.round((filled_count / answerable_fields.length) * 100);
}
