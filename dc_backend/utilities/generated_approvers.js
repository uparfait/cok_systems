const form_approvers_model = require("../models/form_approvers_model.js");

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

module.exports = {
  record_match_values,
  config_with_generated_for_submission,
};
