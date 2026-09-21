const crypto = require("crypto");
const fs = require("fs");

/**
 * In-memory registry of running / finished export jobs. A job writes its
 * spreadsheet to a temporary file while the client follows its progress
 * (long-poll), then downloads the file by job id. Finished jobs and their
 * files are dropped after a while; losing the registry on a restart only
 * costs a stale progress screen.
 */
const jobs = new Map();

const FINISHED_JOB_TTL_MS = 20 * 60 * 1000;
const LONG_POLL_TIMEOUT_MS = 20000;
const LONG_POLL_TICK_MS = 300;

function create_job(total, meta) {
  const job = Object.assign(
    {
      id: crypto.randomBytes(12).toString("hex"),
      status: "running",
      stage: "counting",
      total,
      processed: 0,
      percent: 0,
      error: null,
      cancel_requested: false,
      file_path: null,
      filename: null,
      started_at: new Date(),
      finished_at: null,
    },
    meta || {},
  );
  jobs.set(job.id, job);
  return job;
}

const get_job = (job_id) => jobs.get(job_id) || null;

function update_progress(job_id, patch) {
  const job = jobs.get(job_id);
  if (!job) return;
  Object.assign(job, patch);
  job.percent = job.total > 0 ? Math.min(99, Math.round((job.processed / job.total) * 100)) : 99;
}

function cancel_job(job_id) {
  const job = jobs.get(job_id);
  if (!job) return null;
  if (job.status === "running") job.cancel_requested = true;
  return job;
}

const is_cancel_requested = (job_id) => {
  const job = jobs.get(job_id);
  return !!(job && job.cancel_requested);
};

function finish_job(job_id, status, error_message) {
  const job = jobs.get(job_id);
  if (!job) return;
  job.status = status;
  job.error = error_message || null;
  job.stage = status === "completed" ? "ready" : status;
  if (status === "completed") job.percent = 100;
  job.finished_at = new Date();
}

function remove_file(job) {
  if (!job || !job.file_path) return;
  fs.promises.unlink(job.file_path).catch(() => {});
  job.file_path = null;
}

/** The exact shape sent to the client - never the internal object itself. */
function job_view(job) {
  return {
    job_id: job.id,
    status: job.status,
    stage: job.stage,
    total: job.total,
    processed: job.processed,
    percent: job.percent,
    filename: job.filename,
    cancel_requested: job.cancel_requested === true,
    error: job.error,
  };
}

/**
 * Long-poll helper: resolves as soon as the job's progress moves past the
 * percent the client already knows (or the job finishes), otherwise after
 * LONG_POLL_TIMEOUT_MS with the current state.
 */
function wait_for_progress(job_id, known_percent) {
  return new Promise((resolve) => {
    const started = Date.now();
    const check = () => {
      const job = jobs.get(job_id);
      if (!job) return resolve(null);
      const moved = !Number.isFinite(known_percent) || job.percent !== known_percent;
      if (moved || job.status !== "running" || Date.now() - started >= LONG_POLL_TIMEOUT_MS) return resolve(job);
      setTimeout(check, LONG_POLL_TICK_MS);
    };
    check();
  });
}

const cleanup_interval = setInterval(() => {
  const now = Date.now();
  jobs.forEach((job, id) => {
    if (job.finished_at && now - job.finished_at.getTime() > FINISHED_JOB_TTL_MS) {
      remove_file(job);
      jobs.delete(id);
    }
  });
}, 60 * 1000);
if (cleanup_interval.unref) cleanup_interval.unref();

module.exports = {
  create_job,
  get_job,
  update_progress,
  cancel_job,
  is_cancel_requested,
  finish_job,
  remove_file,
  job_view,
  wait_for_progress,
};
