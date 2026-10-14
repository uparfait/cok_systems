const submissions_model = require("../../models/submissions_model.js");
const projects_model = require("../../models/projects_model.js");
const project_access = require("../../utilities/project_access.js");
const { is_valid_object_id } = require("../../utilities/object_id.js");

const MAX_PER_REQUEST = 500;

/**
 * Validates a hand-picked set of record ids and resolves the rows the user
 * may delete. Every id is resolved first and each distinct form behind
 * them is permission-checked once, so a selection spanning versions (or,
 * through a shared table, more than one form) can never delete a single
 * row the requesting user may not manage. Answers { status, key } when
 * the set is refused, else { submissions }.
 */
async function resolve_deletable_submissions(user, submission_ids) {
  if (!Array.isArray(submission_ids) || submission_ids.length === 0) return { status: 400, key: "VALIDATION_FAILED" };
  if (submission_ids.length > MAX_PER_REQUEST) return { status: 400, key: "VALIDATION_FAILED" };
  if (submission_ids.some((id) => !is_valid_object_id(id))) return { status: 400, key: "INVALID_ID" };

  const submissions = await submissions_model.find_submissions_by_ids(submission_ids);
  if (submissions.length === 0) return { status: 404, key: "SUBMISSION_NOT_FOUND" };

  // One permission answer per form, not per row.
  const by_form = new Map();
  submissions.forEach((submission) => {
    if (!by_form.has(submission.form_group_id)) by_form.set(submission.form_group_id, submission.project_id);
  });
  for (const [form_group_id, project_id] of by_form) {
    const project = await projects_model.find_project_by_id(project_id);
    const management = await project_access.resolve_form_management(user, project, form_group_id);
    if (!management.edit_forms) return { status: 403, key: "FORM_ACTION_FORBIDDEN" };
  }
  return { submissions };
}

module.exports = { resolve_deletable_submissions, MAX_PER_REQUEST };
