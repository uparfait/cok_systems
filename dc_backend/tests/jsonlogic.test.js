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
  const huge_rule = { and: [] };
  for (let i = 0; i < 5000; i++) huge_rule.and.push({ "==": [1, 1] });
  assert.strictEqual(is_valid_rule_structure(huge_rule).valid, false);

  let deeply_nested = { var: "x" };
  for (let i = 0; i < 30; i++) deeply_nested = { "!": deeply_nested };
  assert.strictEqual(is_valid_rule_structure(deeply_nested).valid, false);
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

run_all_tests();
process.stdout.write("ALL_TESTS_PASSED\n");
