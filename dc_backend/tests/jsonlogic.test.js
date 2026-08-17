const assert = require("assert");
const { evaluate_rule, is_valid_rule_structure } = require("../jsonlogic/engine.js");
const { build_dependency_graph } = require("../jsonlogic/dependency_graph.js");
const { validate_form_schema } = require("../jsonlogic/validate_schema.js");
const { validate_submission_data } = require("../jsonlogic/validate_submission.js");

/**
 * Runs every assertion in this file, printing which case failed instead of
 * only the raw assertion diff.
 */
function run_all_tests() {
  test_custom_operations();
  test_rule_structure_guard();
  test_dependency_graph_order();
  test_dependency_graph_cycle_detection();
  test_schema_validation_rejects_bad_form();
  test_schema_validation_accepts_good_form();
  test_submission_validation_mandatory_and_computed();
  test_every_validation_operator_pass_and_fail();
}

/**
 * Confirms every custom JSONLogic operation behaves as documented.
 */
function test_custom_operations() {
  assert.strictEqual(evaluate_rule({ ends_with: [{ var: "code" }, "99"] }, { code: "RAB199" }).value, true);
  assert.strictEqual(evaluate_rule({ starts_with: [{ var: "code" }, "RAB"] }, { code: "RAB199" }).value, true);
  assert.strictEqual(evaluate_rule({ regex_match: [{ var: "phone" }, "^\\+250"] }, { phone: "+250788123456" }).value, true);
  assert.strictEqual(evaluate_rule({ date_diff_days: ["2026-01-01", "2026-01-05"] }, {}).value, 4);
  assert.strictEqual(evaluate_rule({ in_array: [{ var: "role" }, ["admin", "manager"]] }, { role: "manager" }).value, true);
  assert.strictEqual(evaluate_rule({ gps_accuracy_ok: [{ var: "accuracy" }, 10] }, { accuracy: 5 }).value, true);
  assert.strictEqual(evaluate_rule({ length_is: [{ var: "pin" }, 4] }, { pin: "1234" }).value, true);
}

/**
 * Confirms oversized or malformed rules never reach evaluation.
 */
function test_rule_structure_guard() {
  // Rule size and nesting depth are generous (large real-world forms with
  // hundreds of rules must never hit these), but still bounded - so a
  // pathological payload still gets rejected rather than crashing the
  // evaluator. These fixtures exceed the configured ceilings on purpose.
  const huge_rule = { and: [] };
  for (let i = 0; i < 20000; i++) huge_rule.and.push({ "==": [1, 1] });
  assert.strictEqual(is_valid_rule_structure(huge_rule).valid, false);

  let deeply_nested = { var: "x" };
  for (let i = 0; i < 80; i++) deeply_nested = { "!": deeply_nested };
  assert.strictEqual(is_valid_rule_structure(deeply_nested).valid, false);

  let reasonable_rule = { var: "x" };
  for (let i = 0; i < 10; i++) reasonable_rule = { "!": reasonable_rule };
  assert.strictEqual(is_valid_rule_structure(reasonable_rule).valid, true);
}

/**
 * Confirms fields are ordered so a dependency is always evaluated before
 * anything that reads it.
 */
function test_dependency_graph_order() {
  const fields = [
    { id: "total", type: "hidden", computed: { enabled: true, formula: { "+": [{ var: "a" }, { var: "b" }] } } },
    { id: "a", type: "number" },
    { id: "b", type: "number" },
  ];
  const result = build_dependency_graph(fields);
  assert.strictEqual(result.has_cycle, false);
  assert.ok(result.order.indexOf("a") < result.order.indexOf("total"));
  assert.ok(result.order.indexOf("b") < result.order.indexOf("total"));
}

/**
 * Confirms two fields depending on each other are flagged as a cycle rather
 * than silently accepted.
 */
function test_dependency_graph_cycle_detection() {
  const fields = [
    { id: "field_a", type: "hidden", computed: { enabled: true, formula: { var: "field_b" } } },
    { id: "field_b", type: "hidden", computed: { enabled: true, formula: { var: "field_a" } } },
  ];
  const result = build_dependency_graph(fields);
  assert.strictEqual(result.has_cycle, true);
}

/**
 * Confirms an invalid schema (bad field type, missing label on a data
 * field) is rejected.
 */
function test_schema_validation_rejects_bad_form() {
  const bad_type_schema = { fields: [{ id: "q1", type: "not_a_real_type", label: { en: "Q1" } }] };
  assert.strictEqual(validate_form_schema(bad_type_schema).valid, false);

  const unlabeled_data_field_schema = { fields: [{ id: "q1", type: "text", label: { en: "" } }] };
  assert.strictEqual(validate_form_schema(unlabeled_data_field_schema).valid, false);
}

/**
 * Confirms a well-formed schema passes validation, with no title required
 * and content (form design) components exempt from needing a label.
 */
function test_schema_validation_accepts_good_form() {
  const good_schema = {
    fields: [
      { id: "header_1", type: "header", label: { en: "" } },
      { id: "full_name", type: "text", label: { en: "Full name", kn: "Amazina" }, mandatory: true },
    ],
  };
  const result = validate_form_schema(good_schema);
  assert.strictEqual(result.valid, true);
}

/**
 * Confirms a mandatory field blocks submission when empty and that a
 * computed hidden field is derived server-side regardless of client input.
 */
function test_submission_validation_mandatory_and_computed() {
  const schema = {
    fields: [
      { id: "age", type: "number", label: { en: "Age" }, mandatory: true },
      {
        id: "is_adult",
        type: "hidden",
        label: { en: "Is adult" },
        computed: { enabled: true, formula: { ">=": [{ var: "age" }, 18] } },
      },
    ],
  };

  const missing_result = validate_submission_data(schema, {}, "en");
  assert.strictEqual(missing_result.valid, false);
  assert.ok(missing_result.field_errors.age);

  const complete_result = validate_submission_data(schema, { age: 21, is_adult: "tampered" }, "en");
  assert.strictEqual(complete_result.valid, true);
  assert.strictEqual(complete_result.resolved_data.is_adult, true);
}

/**
 * Builds the exact JSONLogic condition each validation operator produces -
 * mirrors build_validation_condition() in
 * frontend/src/systems/dcs/builder/validationOperators.js line for line -
 * so this exercises the real shape every operator actually generates, not
 * a hand-simplified stand-in for it.
 */
function build_validation_condition_for_test(operator_id, value, parent_field_id, parent_value) {
  const field_var = { var: "f" };
  const numeric_value = Number(value);
  switch (operator_id) {
    case "equals": return { "==": [field_var, value] };
    case "not_equals": return { "!=": [field_var, value] };
    case "includes": return { in_array: [value, field_var] };
    case "not_includes": return { not_in_array: [value, field_var] };
    case "starts_with": return { starts_with: [field_var, value] };
    case "ends_with": return { ends_with: [field_var, value] };
    case "length_is": return { length_is: [field_var, numeric_value] };
    case "min_length": return { min_length: [field_var, numeric_value] };
    case "max_length": return { max_length: [field_var, numeric_value] };
    case "matches_pattern": return { regex_match: [field_var, value] };
    case "not_matches_pattern": return { "!": [{ regex_match: [field_var, value] }] };
    case "greater_than": return { ">": [field_var, numeric_value] };
    case "less_than": return { "<": [field_var, numeric_value] };
    case "min_value": return { ">=": [field_var, numeric_value] };
    case "max_value": return { "<=": [field_var, numeric_value] };
    case "multiple_of": return { "==": [{ "%": [field_var, numeric_value] }, 0] };
    case "is_integer": return { "==": [{ "%": [field_var, 1] }, 0] };
    case "is_positive": return { ">": [field_var, 0] };
    case "is_negative": return { "<": [field_var, 0] };
    case "min_date": return { ">=": [field_var, value] };
    case "max_date": return { "<=": [field_var, value] };
    case "min_selections": return { min_length: [field_var, numeric_value] };
    case "max_selections": return { max_length: [field_var, numeric_value] };
    case "exact_selections": return { length_is: [field_var, numeric_value] };
    case "email_domain_in": return { email_domain_in: [field_var, value] };
    case "email_domain_not_in": return { email_domain_not_in: [field_var, value] };
    case "url_domain_in": return { url_domain_in: [field_var, value] };
    case "url_domain_not_in": return { url_domain_not_in: [field_var, value] };
    case "must_equal_field": return { "==": [field_var, { var: parent_field_id }] };
    case "not_equal_field": return { "!=": [field_var, { var: parent_field_id }] };
    case "max_file_size_mb": return { "<=": [{ var: "f.size" }, numeric_value * 1024 * 1024] };
    case "max_file_size_kb": return { "<=": [{ var: "f.size" }, numeric_value * 1024] };
    case "max_file_size_gb": return { "<=": [{ var: "f.size" }, numeric_value * 1024 * 1024 * 1024] };
    case "depends_on_parent":
      return { if: [{ "==": [{ var: parent_field_id }, parent_value] }, { "==": [field_var, value] }, true] };
    default: return null;
  }
}

/**
 * Every validation-criteria operator offered in the field settings drawer,
 * checked one by one: each must independently accept data that satisfies
 * it and independently reject data that violates it. Catches exactly the
 * class of bug found in "must not contain" (not_includes evaluated the
 * field's string value as if it were an array and so was always
 * vacuously true) by exercising every operator, not just the ones a
 * manual test happened to cover.
 */
function test_every_validation_operator_pass_and_fail() {
  const cases = [
    ["equals", "abc", null, null, { f: "abc" }, { f: "xyz" }],
    ["not_equals", "abc", null, null, { f: "xyz" }, { f: "abc" }],
    ["includes", "claude", null, null, { f: "hello claude" }, { f: "hello world" }],
    ["not_includes", "claude", null, null, { f: "hello world" }, { f: "hello claude" }],
    // Case-insensitive on purpose: a "must (not) contain claude" rule has
    // to catch "Claude"/"CLAUDE" too, not just an exact-case match.
    ["includes", "claude", null, null, { f: "hello Claude" }, { f: "hello world" }],
    ["not_includes", "claude", null, null, { f: "hello world" }, { f: "hello CLAUDE" }],
    ["starts_with", "hel", null, null, { f: "hello" }, { f: "xhello" }],
    ["ends_with", "llo", null, null, { f: "hello" }, { f: "hellox" }],
    ["length_is", "5", null, null, { f: "hello" }, { f: "hell" }],
    ["min_length", "3", null, null, { f: "hello" }, { f: "hi" }],
    ["max_length", "3", null, null, { f: "hi" }, { f: "hello" }],
    ["matches_pattern", "^[a-z]+$", null, null, { f: "hello" }, { f: "Hello1" }],
    ["not_matches_pattern", "^[a-z]+$", null, null, { f: "Hello1" }, { f: "hello" }],
    ["greater_than", "5", null, null, { f: 6 }, { f: 5 }],
    ["less_than", "5", null, null, { f: 4 }, { f: 5 }],
    ["min_value", "5", null, null, { f: 5 }, { f: 4 }],
    ["max_value", "5", null, null, { f: 5 }, { f: 6 }],
    ["multiple_of", "5", null, null, { f: 10 }, { f: 11 }],
    ["is_integer", null, null, null, { f: 4 }, { f: 4.5 }],
    ["is_positive", null, null, null, { f: 1 }, { f: -1 }],
    ["is_negative", null, null, null, { f: -1 }, { f: 1 }],
    ["min_date", "2024-01-01", null, null, { f: "2024-06-01" }, { f: "2023-01-01" }],
    ["max_date", "2024-12-31", null, null, { f: "2024-06-01" }, { f: "2025-01-01" }],
    ["min_selections", "2", null, null, { f: ["a", "b"] }, { f: ["a"] }],
    ["max_selections", "2", null, null, { f: ["a"] }, { f: ["a", "b", "c"] }],
    ["exact_selections", "2", null, null, { f: ["a", "b"] }, { f: ["a"] }],
    ["email_domain_in", "gmail.com,yahoo.com", null, null, { f: "x@gmail.com" }, { f: "x@outlook.com" }],
    ["email_domain_not_in", "outlook.com", null, null, { f: "x@gmail.com" }, { f: "x@outlook.com" }],
    ["url_domain_in", "example.com", null, null, { f: "https://example.com/a" }, { f: "https://other.com/a" }],
    ["url_domain_not_in", "other.com", null, null, { f: "https://example.com/a" }, { f: "https://other.com/a" }],
    ["must_equal_field", null, "p", null, { f: "x", p: "x" }, { f: "x", p: "y" }],
    ["not_equal_field", null, "p", null, { f: "x", p: "y" }, { f: "x", p: "x" }],
    ["max_file_size_mb", "1", null, null, { f: { size: 500000 } }, { f: { size: 2000000 } }],
    ["max_file_size_kb", "500", null, null, { f: { size: 400000 } }, { f: { size: 600000 } }],
    ["max_file_size_gb", "1", null, null, { f: { size: 500000000 } }, { f: { size: 2000000000 } }],
    ["depends_on_parent", "yes-value", "p", "trigger", { f: "yes-value", p: "trigger" }, { f: "no", p: "trigger" }],
  ];

  cases.forEach(([operator_id, value, parent_field_id, parent_value, pass_data, fail_data]) => {
    const condition = build_validation_condition_for_test(operator_id, value, parent_field_id, parent_value);
    const pass_result = evaluate_rule(condition, pass_data);
    const fail_result = evaluate_rule(condition, fail_data);
    assert.strictEqual(pass_result.value !== false && !pass_result.error, true, `${operator_id}: expected pass_data to satisfy the rule`);
    assert.strictEqual(fail_result.value === false || !!fail_result.error, true, `${operator_id}: expected fail_data to violate the rule`);
  });
}

run_all_tests();
process.stdout.write("ALL_TESTS_PASSED\n");
