const fs = require("fs");
const export_jobs = require("../../utilities/export_jobs.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Long-poll progress of an export job: pass the percent already shown
 * (known_percent) and the answer is held until the job moves past it,
 * finishes, or the poll window elapses.
 */
async function get_export_job(req, res) {
  try {
    const known_percent = req.query && req.query.known_percent !== undefined ? Number(req.query.known_percent) : NaN;
    const job = await export_jobs.wait_for_progress(req.params.job_id, known_percent);
    if (!job) return res.status(404).json(warning_response(req, "EXPORT_JOB_NOT_FOUND"));
    return res.status(200).json(success_response(req, "EXPORT_JOB_FETCHED", export_jobs.job_view(job)));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

/** Streams the finished spreadsheet; the file stays available until the job expires. */
async function download_export(req, res) {
  try {
    const job = export_jobs.get_job(req.params.job_id);
    if (!job) return res.status(404).json(warning_response(req, "EXPORT_JOB_NOT_FOUND"));
    if (job.status !== "completed" || !job.file_path) return res.status(409).json(warning_response(req, "EXPORT_NOT_READY"));
    const stat = await fs.promises.stat(job.file_path).catch(() => null);
    if (!stat) return res.status(404).json(warning_response(req, "EXPORT_JOB_NOT_FOUND"));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${job.filename || "export.xlsx"}"`);
    res.setHeader("Content-Length", stat.size);
    res.setHeader("X-Total-Records", job.processed);
    fs.createReadStream(job.file_path).pipe(res);
    return undefined;
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

/** Asks a running export to stop; what was written is discarded. */
async function cancel_export(req, res) {
  try {
    const job = export_jobs.cancel_job(req.params.job_id);
    if (!job) return res.status(404).json(warning_response(req, "EXPORT_JOB_NOT_FOUND"));
    return res.status(200).json(success_response(req, "EXPORT_CANCEL_REQUESTED", export_jobs.job_view(job)));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = { get_export_job, download_export, cancel_export };
