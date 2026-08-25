import { evaluate_rule } from "./engine.js";
import { flatten_fields, build_dependency_graph, build_field_parent_map, is_visible_through_ancestors } from "./dependencyGraph.js";
import { get_field_text, get_field_options_state } from "../fields/fieldText.js";

const PARENT_GROUP_CAPABLE_TYPES = ["single_select", "multi_select", "select_group"];

/**
 * True when a value should be treated as empty for a mandatory-response
 * check.
 */
function is_empty_value(value) {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  return value.toString().trim().length === 0;
}

/**
 * Resolves every computed value and every field's effective (ancestor- and
 * parent-group-aware) visibility, stripping a field's own stored answer the
 * instant it is determined hidden or locked. A respondent can change an
 * earlier answer that hides a field they had already answered (or hides
 * its whole containing group/section) - that stale answer must never
 * linger in state to be autosaved, queued, or submitted alongside the
 * questions actually asked. Clearing one field can in turn change what a
 * field further down the form should be able to see (e.g. a follow-up
 * question conditioned on the now-cleared answer), so this repeats until
 * nothing changes rather than resolving only one hop. Mirrors
 * resolve_effective_form_state in dc_backend/jsonlogic/validate_submission.js.
 */
function resolve_effective_form_state(flat_fields, fields_by_id, evaluation_order, parent_map, submitted_data) {
  const working_data = Object.assign({}, submitted_data);
  let own_visible_by_id = new Map();
  let own_locked_by_id = new Map();
  let changed = true;
  let safety_counter = 0;

  while (changed && safety_counter <= flat_fields.length) {
    changed = false;
    safety_counter += 1;
    own_visible_by_id = new Map();
    own_locked_by_id = new Map();

    evaluation_order.forEach((field_id) => {
      const field = fields_by_id.get(field_id);
      if (!field || !field.type) return;

      if (field.computed && field.computed.enabled && field.computed.formula) {
        const computed_result = evaluate_rule(field.computed.formula, working_data);
        working_data[field_id] = computed_result.value;
      }

      const visibility_result = field.visibility_condition
        ? evaluate_rule(field.visibility_condition, working_data)
        : { value: true, error: null };
      own_visible_by_id.set(field_id, visibility_result.error ? true : visibility_result.value !== false);

      // A select-family field split into parent-driven condition groups
      // (field.parent_dependency_enabled) renders nothing at all once no
      // group currently matches (see get_field_options_state in
      // fields/fieldText.js) - it must be treated here exactly like an
      // invisible field.
      own_locked_by_id.set(
        field_id,
        PARENT_GROUP_CAPABLE_TYPES.includes(field.type) && field.parent_dependency_enabled
          ? get_field_options_state(field, working_data, false).is_locked
          : false,
      );
    });

    flat_fields.forEach((field) => {
      const field_id = field.id;
      const is_effectively_visible =
        own_visible_by_id.get(field_id) !== false && is_visible_through_ancestors(field_id, parent_map, own_visible_by_id);
      if ((!is_effectively_visible || own_locked_by_id.get(field_id)) && working_data[field_id] !== undefined) {
        delete working_data[field_id];
        changed = true;
      }
    });
  }

  return { working_data, own_visible_by_id, own_locked_by_id };
}

/**
 * Validates a form response entirely in the browser, using the exact same
 * dependency-ordered evaluation as the server: computes derived values,
 * applies visibility, then checks every mandatory response and every
 * validation rule independently so a field can fail more than one
 * condition at once and each shows its own message. Mirrors
 * dc_backend/jsonlogic/validate_submission.js so client and server never
 * disagree, and lets the UI catch problems before a round trip.
 */
export function validate_submission_client_side(schema, submitted_data, language, translate) {
  const flat_fields = flatten_fields(schema.fields);
  const fields_by_id = new Map(flat_fields.map((field) => [field.id, field]));
  const dependency_result = build_dependency_graph(schema.fields);
  const parent_map = build_field_parent_map(schema.fields);

  const field_errors = {};
  const field_valid_messages = {};

  // A cycle only means computed/visibility values among the cyclic fields
  // can't be resolved in a guaranteed-correct order - it must never mean
  // those fields are skipped. Silently dropping them from evaluation was
  // exactly what let a submission through while some fields' mandatory and
  // validation rules were never actually checked. Every field always gets
  // evaluated: the acyclic ones in dependency order, the cyclic ones
  // afterwards on a best-effort basis.
  const evaluation_order =
    dependency_result.order.length > 0
      ? dependency_result.order.concat(dependency_result.cyclic_fields)
      : [...fields_by_id.keys()];

  const { working_data, own_visible_by_id, own_locked_by_id } = resolve_effective_form_state(
    flat_fields,
    fields_by_id,
    evaluation_order,
    parent_map,
    submitted_data,
  );

  // A field's own visibility only ever describes itself - a group or
  // section hidden by its own visibility_condition can contain a mandatory
  // child field with no visibility_condition of its own at all, and that
  // child was never actually shown to the respondent either.
  flat_fields.forEach((field) => {
    if (!field || !field.type) return;
    const field_id = field.id;

    const is_effectively_visible =
      own_visible_by_id.get(field_id) !== false && is_visible_through_ancestors(field_id, parent_map, own_visible_by_id);

    if (!is_effectively_visible || own_locked_by_id.get(field_id)) return;

    if (field.mandatory && is_empty_value(working_data[field_id])) {
      field_errors[field_id] = (field_errors[field_id] || []).concat([
        get_field_text(field.required_message, language) || translate("DCS_REQUIRED_FIELD_ERROR"),
      ]);
    }

    (field.validation_rules || []).forEach((validation_rule) => {
      if (!validation_rule.condition) return;
      const rule_result = evaluate_rule(validation_rule.condition, working_data);
      const satisfied = rule_result.error ? false : rule_result.value !== false;

      if (!satisfied) {
        const severity = validation_rule.severity === "warning" ? "warning" : "error";
        field_errors[field_id] = (field_errors[field_id] || []).concat([
          {
            message: get_field_text(validation_rule.message, language) || translate("DCS_VALIDATION_FAILED_GENERIC"),
            severity,
          },
        ]);
        return;
      }

      const rule_valid_message = get_field_text(validation_rule.valid_message, language);
      if (rule_valid_message && !field_valid_messages[field_id]) {
        field_valid_messages[field_id] = rule_valid_message;
      }
    });
  });

  Object.keys(field_valid_messages).forEach((field_id) => {
    if (field_errors[field_id]) delete field_valid_messages[field_id];
  });

  const has_blocking_errors = Object.keys(field_errors).some((field_id) =>
    field_errors[field_id].some((entry) => typeof entry === "string" || entry.severity === "error"),
  );

  return {
    valid: !has_blocking_errors,
    field_errors,
    field_valid_messages,
    resolved_data: working_data,
  };
}
