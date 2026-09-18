const test_jobs = require("../../utilities/test_jobs.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Asks a running test-data job to stop. The generation loop sees the
 * request before its next record, stores what it already has and finishes
 * with status "cancelled" - the records saved so far stay, nothing half
 * written is lost. A job that already finished is returned as it is.
 */
async function cancel_test_job(req, res) {
  try {
    const job = test_jobs.cancel_job(req.params.job_id);
    if (!job) return res.status(404).json(warning_response(req, "TEST_DATA_JOB_NOT_FOUND"));
    return res.status(200).json(success_response(req, "TEST_DATA_JOB_CANCEL_REQUESTED", test_jobs.job_view(job)));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = cancel_test_job;
