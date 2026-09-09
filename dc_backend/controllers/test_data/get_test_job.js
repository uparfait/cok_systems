const test_jobs = require("../../utilities/test_jobs.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Long-poll progress endpoint for a running test-data generation job: pass
 * the percent already shown (known_percent) and the response is held back
 * until the job moves past it, finishes, or the poll window elapses.
 */
async function get_test_job(req, res) {
  try {
    const { job_id } = req.params;
    const known_percent = req.query && req.query.known_percent !== undefined ? Number(req.query.known_percent) : NaN;

    const job = await test_jobs.wait_for_progress(job_id, known_percent);
    if (!job) {
      return res.status(404).json(warning_response(req, "TEST_DATA_JOB_NOT_FOUND"));
    }

    return res.status(200).json(success_response(req, "TEST_DATA_JOB_FETCHED", test_jobs.job_view(job)));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_test_job;
