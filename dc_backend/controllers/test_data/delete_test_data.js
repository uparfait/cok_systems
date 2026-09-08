const submissions_model = require("../../models/submissions_model.js");
const project_access = require("../../utilities/project_access.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Permanently deletes generated test records of one form. Only ever touches
 * records carrying the internal test marker - real submissions are
 * untouchable here no matter what range is sent. from/to (submitted_at
 * range) and version each narrow the delete; sending none wipes every test
 * record the form has.
 */
async function delete_test_data(req, res) {
  try {
    const { form_group_id } = req.params;
    const { from, to, version } = req.body || {};

    if (!form_group_id) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }

    const access = await project_access.can_view_form_group(req.user, form_group_id);
    if (access.found && !access.allowed) {
      return res.status(403).json(warning_response(req, "ACCESS_DENIED"));
    }

    let start = null;
    let end = null;
    if (from || to) {
      start = new Date(from);
      end = new Date(to);
      if (!from || !to || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
        return res.status(400).json(warning_response(req, "TEST_DATA_RANGE_INVALID"));
      }
    }

    const deleted = await submissions_model.delete_test_submissions(form_group_id, start, end, version);

    return res.status(200).json(success_response(req, "TEST_DATA_DELETED", { deleted }, { count: deleted }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = delete_test_data;
