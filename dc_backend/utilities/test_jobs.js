const crypto = require("crypto");

// In-memory registry of running/finished test-data generation jobs. Jobs
// are transient progress trackers only - the generated records themselves
// live in MongoDB - so losing them on a restart costs nothing but a stale
// progress screen.
const jobs = new Map();

const FINISHED_JOB_TTL_MS = 15 * 60 * 1000;
const LONG_POLL_TIMEOUT_MS = 20000;
const LONG_POLL_TICK_MS = 400;

function create_job(total) {
  const job = {
    id: crypto.randomBytes(12).toString("hex"),
    status: "running",
    total,
    processed: 0,
    saved: 0,
    failed: 0,
    percent: 0,
    error: null,
    started_at: new Date(),
    finished_at: null,
  };
  jobs.set(job.id, job);
  return job;
}

function get_job(job_id) {
  return jobs.get(job_id) || null;
}

function update_progress(job_id, patch) {
  const job = jobs.get(job_id);
  if (!job) return;
  Object.assign(job, patch);
  job.percent = job.total > 0 ? Math.min(100, Math.round((job.processed / job.total) * 100)) : 100;
}

function finish_job(job_id, status, error_message) {
  const job = jobs.get(job_id);
  if (!job) return;
  job.status = status;
  job.error = error_message || null;
  if (status === "completed") job.percent = 100;
  job.finished_at = new Date();
}

/** The exact shape sent to the client - never the internal object itself. */
function job_view(job) {
  return {
    job_id: job.id,
    status: job.status,
    total: job.total,
    processed: job.processed,
    saved: job.saved,
    failed: job.failed,
    percent: job.percent,
    // Approval-generation jobs also report how many approvers the cascade
    // enumeration produced; other jobs simply never set this.
    approvers: job.approvers === undefined ? null : job.approvers,
    error: job.error,
  };
}

/**
 * Long-poll helper: resolves as soon as the job's progress moves past the
 * percent the client already knows (or the job finishes), otherwise after
 * LONG_POLL_TIMEOUT_MS with the current state - so the client sees live
 * progress without hammering the endpoint.
 */
function wait_for_progress(job_id, known_percent) {
  return new Promise((resolve) => {
    const started = Date.now();
    const check = () => {
      const job = jobs.get(job_id);
      if (!job) return resolve(null);
      const moved = !Number.isFinite(known_percent) || job.percent !== known_percent;
      if (moved || job.status !== "running" || Date.now() - started >= LONG_POLL_TIMEOUT_MS) {
        return resolve(job);
      }
      setTimeout(check, LONG_POLL_TICK_MS);
    };
    check();
  });
}

const cleanup_interval = setInterval(() => {
  const now = Date.now();
  jobs.forEach((job, id) => {
    if (job.finished_at && now - job.finished_at.getTime() > FINISHED_JOB_TTL_MS) jobs.delete(id);
  });
}, 60 * 1000);
if (cleanup_interval.unref) cleanup_interval.unref();

module.exports = {
  create_job,
  get_job,
  update_progress,
  finish_job,
  job_view,
  wait_for_progress,
};
