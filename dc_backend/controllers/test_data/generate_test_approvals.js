const { faker } = require("@faker-js/faker");
const forms_model = require("../../models/forms_model.js");
const form_approvers_model = require("../../models/form_approvers_model.js");
const submissions_model = require("../../models/submissions_model.js");
const { build_test_submission_approval } = require("../../utilities/generated_approvers.js");
const project_access = require("../../utilities/project_access.js");
const test_jobs = require("../../utilities/test_jobs.js");
const { flatten_fields } = require("../../jsonlogic/dependency_graph.js");
const { locations_at_level } = require("../../utilities/test_data_generator.js");
const { is_test_approver } = require("../../utilities/approval.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

const ON_REJECT_OPTIONS = ["stop", "continue"];
const MAX_POOL_NODES = 200000;
const TRAIL_SEPARATOR = "\u0001";

function normalize(value) {
  return String(value === undefined || value === null ? "" : value).trim().toLowerCase();
}

function trail_key(trail) {
  return trail.map(normalize).join(TRAIL_SEPARATOR);
}

function field_label_text(field) {
  if (field && field.label) {
    return field.label.en || field.label.kn || field.label.fr || field.id;
  }
  return field ? field.id : "";
}

function is_api_field(field) {
  return !!field && !!field.data_source && field.data_source.type === "api";
}

// Mirrors the frontend's parent_link_of: a cascading_select points at its
// parent via parent_field_id, a parent-dependent select_group via its
// parent_option_groups.
function parent_link_of(field, fields_by_id) {
  if (!field) return null;
  if (field.parent_field_id && fields_by_id.has(field.parent_field_id)) return field.parent_field_id;
  if (field.type === "select_group" && field.parent_dependency_enabled) {
    const group = (field.parent_option_groups || []).find((entry) => entry && entry.parent_field_id && fields_by_id.has(entry.parent_field_id));
    if (group) return group.parent_field_id;
  }
  return null;
}

/** The field's whole cascade path, root first, ending at the field itself. */
function chain_path_for(field, fields_by_id) {
  const path = [field];
  let current = field;
  for (let guard = 0; guard < 20; guard += 1) {
    const parent_id = parent_link_of(current, fields_by_id);
    if (!parent_id) break;
    const parent = fields_by_id.get(parent_id);
    if (!parent) break;
    path.unshift(parent);
    current = parent;
  }
  return path;
}

function root_option_values(field) {
  if (field.type === "select_group" && field.parent_dependency_enabled) {
    return (field.parent_option_groups || []).flatMap((group) => (group.options || []).map((option) => String(option.value)));
  }
  return (field.options || []).map((option) => String(option.value)).filter((value) => value.trim() !== "");
}

/** The child field's own values under one exact parent value - never mixed across parents. */
function child_option_values(field, parent_field, parent_value) {
  if (field.type === "cascading_select") {
    return (field.options || [])
      .filter((option) => normalize(option.parent_value) === normalize(parent_value))
      .map((option) => String(option.value))
      .filter((value) => value.trim() !== "");
  }
  if (field.type === "select_group" && field.parent_dependency_enabled) {
    const values = [];
    (field.parent_option_groups || []).forEach((group) => {
      if (!group || group.parent_field_id !== parent_field.id) return;
      if (normalize(group.value) !== normalize(parent_value)) return;
      values.push(...(group.options || []).map((option) => String(option.value)));
    });
    return values.filter((value) => value.trim() !== "");
  }
  return root_option_values(field);
}

/**
 * Walks one whole cascade top to bottom and enumerates EVERY node: each
 * province, then every district under each province, then every sector
 * under each district, and so on to the chain's deepest chosen level. An
 * api-sourced chain walks the country location tree; an options-based
 * chain (school -> age -> allowed, or the select_group location template)
 * walks its own linked options the same way. Returns one Map per level:
 * trail key -> node.
 */
function enumerate_chain_pool(chain_fields, counter) {
  const pools = chain_fields.map(() => new Map());

  const walk = (level_index, trail) => {
    if (counter.total >= MAX_POOL_NODES) return;
    const field = chain_fields[level_index];
    let values;
    if (is_api_field(field)) {
      values = locations_at_level(field.data_source.level || "provinces", trail).map((item) =>
        typeof item === "string" ? item : item.name,
      );
    } else if (level_index === 0) {
      values = root_option_values(field);
    } else {
      values = child_option_values(field, chain_fields[level_index - 1], trail[trail.length - 1]);
    }

    for (const value of values) {
      if (counter.total >= MAX_POOL_NODES) return;
      const next_trail = trail.concat([String(value)]);
      const key = trail_key(next_trail);
      if (!pools[level_index].has(key)) {
        pools[level_index].set(key, { trail: next_trail });
        counter.total += 1;
      }
      if (level_index + 1 < chain_fields.length) walk(level_index + 1, next_trail);
    }
  };

  walk(0, []);
  return pools;
}

/**
 * Generates test approvers INTO THE FORM'S OWN APPROVAL FLOW - the exact
 * config the Approval tab displays and build_approval_state routes real
 * submissions with. Each chosen field is one GROUP: the cascade is walked
 * top to bottom and every node at the group's depth becomes one approver
 * whose conditions carry the whole parent-to-child trail (province AND
 * district AND sector...), so same-named children under different parents
 * can never collide. Saved in place on the active version - no new form
 * version, and no submission record is ever touched.
 */
async function generate_test_approvals(req, res) {
  try {
    const { form_group_id } = req.params;
    const { levels } = req.body || {};

    if (!form_group_id) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }

    const requested_levels = (Array.isArray(levels) ? levels : [])
      .filter((level) => level && typeof level.field_id === "string" && level.field_id.trim())
      .map((level) => ({
        field_id: level.field_id.trim(),
        force: level.force !== false,
        on_reject: ON_REJECT_OPTIONS.includes(level.on_reject) ? level.on_reject : "stop",
      }));
    if (requested_levels.length === 0) {
      return res.status(400).json(warning_response(req, "TEST_APPROVAL_FIELDS_REQUIRED"));
    }

    const access = await project_access.can_view_form_group(req.user, form_group_id);
    if (access.found && !access.allowed) {
      return res.status(403).json(warning_response(req, "ACCESS_DENIED"));
    }

    const form_version = (await forms_model.get_active_version(form_group_id)) || (await forms_model.get_latest_version(form_group_id));
    if (!form_version) {
      return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    }
    const fields_by_id = new Map(flatten_fields(form_version.schema.fields || []).map((field) => [field.id, field]));

    const ordered_levels = requested_levels.filter((level) => fields_by_id.has(level.field_id));
    if (ordered_levels.length === 0) {
      return res.status(400).json(warning_response(req, "TEST_APPROVAL_FIELDS_REQUIRED"));
    }

    // Enumerate the pool now - it is fast and lets a too-deep group be
    // rejected before anything starts.
    const counter = { total: 0 };
    const chain_data = new Map();
    const seen_groups = new Set();
    const generated_approvers = [];

    for (const level of ordered_levels) {
      const field = fields_by_id.get(level.field_id);
      const path = chain_path_for(field, fields_by_id);
      const root_id = path[0].id;
      if (!chain_data.has(root_id) || chain_data.get(root_id).path.length < path.length) {
        chain_data.set(root_id, { path, pools: null });
      }
      const group_key = `${root_id}|${level.field_id}`;
      if (seen_groups.has(group_key)) continue;
      seen_groups.add(group_key);
    }
    chain_data.forEach((chain) => {
      chain.pools = enumerate_chain_pool(chain.path, counter);
    });

    const emitted = new Set();
    ordered_levels.forEach((level) => {
      const field = fields_by_id.get(level.field_id);
      const path = chain_path_for(field, fields_by_id);
      const root_id = path[0].id;
      const chain = chain_data.get(root_id);
      const depth = chain.path.findIndex((entry) => entry.id === level.field_id);
      if (depth < 0 || emitted.has(`${root_id}|${depth}`)) return;
      emitted.add(`${root_id}|${depth}`);
      chain.pools[depth].forEach((node) => {
        generated_approvers.push({
          // A real-looking random person - the place/value this approver is
          // scoped to lives in the conditions, never in the name.
          name: faker.person.fullName(),
          role: field_label_text(field),
          // Random, faker-generated identity details - the email is not a
          // real inbox and that is fine for test approvers.
          email: faker.internet.email().toLowerCase(),
          message: faker.lorem.sentence(),
          level: null,
          location_id: null,
          location_name: "",
          conditions: chain.path.slice(0, depth + 1).map((chain_field, index) => ({
            field_id: chain_field.id,
            value: node.trail[index],
          })),
          force: level.force !== false,
          on_reject: level.on_reject,
          this_is_a_test_approval: true,
        });
      });
    });

    if (generated_approvers.length === 0) {
      return res.status(400).json(warning_response(req, "TEST_APPROVAL_FIELDS_REQUIRED"));
    }

    const job = test_jobs.create_job(generated_approvers.length);
    setImmediate(() => run_config_save(job.id, form_version, generated_approvers));

    return res
      .status(202)
      .json(success_response(req, "TEST_APPROVALS_GENERATION_STARTED", { job_id: job.id, total: generated_approvers.length }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

async function run_config_save(job_id, form_version, generated_approvers) {
  try {
    // Real, hand-made approvers already on the flow are kept untouched -
    // only previously generated test approvers are replaced by this run.
    // An unmarked leftover identical to a generated approver (from a save
    // made before the marker survived saving) is treated as generated too,
    // so regenerating can never double the same approval. Matching ignores
    // name, email and message - all three are randomized on every
    // generation; a generated approver's true identity is its role plus its
    // full conditions trail.
    const test_identity = (approver) =>
      JSON.stringify([
        String(approver.role || "").toLowerCase(),
        (approver.conditions || []).map((condition) => [String(condition.field_id), String(condition.value).toLowerCase()]),
      ]);
    const generated_identities = new Set(generated_approvers.map((approver) => test_identity(approver)));
    const kept_identities = new Set();
    const existing = form_version.approval_config || {};
    const kept_approvers = (existing.approvers || []).filter((approver) => {
      if (!approver || is_test_approver(approver)) return false;
      const identity = test_identity(approver);
      if (generated_identities.has(identity) || kept_identities.has(identity)) return false;
      kept_identities.add(identity);
      return true;
    });
    // The form's own config keeps only the hand-made approvers; the whole
    // generated pool goes to its own collection, one document each, where
    // listing and routing page it with plain limit/skip queries.
    await forms_model.update_approval_config(form_version.form_group_id, form_version.version, {
      enabled: true,
      approvers: kept_approvers,
    });
    const inserted = await form_approvers_model.replace_generated_approvers(form_version.form_group_id, generated_approvers);

    // Phase 2: the fresh flow is applied to every EXISTING test record (and
    // only test records) - each one gets the approval state its own answers
    // deserve under the new approvers, matched by conditions exactly like a
    // real submit, no emails.
    const test_submissions = await submissions_model.list_test_submissions(form_version.form_group_id);
    test_jobs.update_progress(job_id, {
      processed: generated_approvers.length,
      saved: inserted,
      failed: generated_approvers.length - inserted,
      approvers: inserted,
      total: generated_approvers.length + test_submissions.length,
    });

    const routing_config = { enabled: true, approvers: kept_approvers };
    let entries = [];
    let processed = generated_approvers.length;
    for (const submission of test_submissions) {
      entries.push({
        _id: submission._id,
        approval: await build_test_submission_approval(form_version.form_group_id, routing_config, submission.data),
      });
      processed += 1;
      test_jobs.update_progress(job_id, { processed });
      if (entries.length >= 500) {
        await submissions_model.set_test_approvals(entries);
        entries = [];
      }
    }
    await submissions_model.set_test_approvals(entries);

    test_jobs.finish_job(job_id, "completed");
  } catch (error) {
    test_jobs.finish_job(job_id, "error", error.message);
  }
}

module.exports = generate_test_approvals;
