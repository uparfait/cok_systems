const form_approvers_model = require("../models/form_approvers_model.js");
const { build_approval_state } = require("./approval.js");
const { resolve_location_chain } = require("./approval_routing.js");

/**
 * Every scalar value a record holds, normalized - the haystack a generated
 * approver's condition values are matched against by the routing query.
 */
function record_match_values(data) {
  const values = new Set();
  Object.values(data || {}).forEach((value) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry !== undefined && entry !== null && typeof entry !== "object") values.add(String(entry).trim().toLowerCase());
      });
      return;
    }
    if (typeof value === "object") return;
    values.add(String(value).trim().toLowerCase());
  });
  return Array.from(values);
}

/**
 * The approval config one submission is routed with: the form's own
 * (hand-made) approvers plus whichever generated approvers this record's
 * answers can match, in stored order. The generated pool lives in its own
 * collection, so only the handful of matching approvers is ever loaded -
 * never the whole pool.
 */
async function config_with_generated_for_submission(form_group_id, approval_config, resolved_data) {
  if (!approval_config || approval_config.enabled !== true) return approval_config;
  const generated = await form_approvers_model.find_matching_generated_approvers(form_group_id, record_match_values(resolved_data));
  if (generated.length === 0) return approval_config;
  return Object.assign({}, approval_config, { approvers: (approval_config.approvers || []).concat(generated) });
}

/**
 * The full approval state one (test) submission deserves under the form's
 * current flow: hand-made approvers plus the generated ones its answers
 * match, run through the exact same build_approval_state a real submit
 * uses - conditions, location scoping, tokens and all. The location chain
 * is only resolved when some approver actually carries a location, so bulk
 * generation never pays for lookups nothing needs. Never sends any email.
 */
async function build_test_submission_approval(form_group_id, approval_config, resolved_data) {
  const effective_config = await config_with_generated_for_submission(form_group_id, approval_config, resolved_data);
  if (!effective_config || effective_config.enabled !== true) return null;
  const needs_locations = (effective_config.approvers || []).some(
    (approver) => approver && approver.level && approver.location_id !== null && approver.location_id !== undefined,
  );
  const location_chain = needs_locations ? await resolve_location_chain(resolved_data) : [];
  return build_approval_state(effective_config, location_chain, resolved_data);
}

/**
 * The approval state under the form's OWN approvers only - what a record
 * gets when the form has no generated pool at all. Location scoping is
 * still resolved when a hand-made approver carries a location; nothing is
 * looked up otherwise.
 */
async function build_approval_without_pool(approval_config, resolved_data) {
  if (!approval_config || approval_config.enabled !== true) return null;
  const needs_locations = (approval_config.approvers || []).some(
    (approver) => approver && approver.level && approver.location_id !== null && approver.location_id !== undefined,
  );
  const location_chain = needs_locations ? await resolve_location_chain(resolved_data) : [];
  return build_approval_state(approval_config, location_chain, resolved_data);
}

module.exports = {
  build_approval_without_pool,
  record_match_values,
  config_with_generated_for_submission,
  build_test_submission_approval,
};
