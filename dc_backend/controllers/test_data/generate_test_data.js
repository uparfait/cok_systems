const forms_model = require("../../models/forms_model.js");
const submissions_model = require("../../models/submissions_model.js");
const project_access = require("../../utilities/project_access.js");
const test_jobs = require("../../utilities/test_jobs.js");
const { generate_test_record } = require("../../utilities/test_data_generator.js");
const { build_test_submission_approval } = require("../../utilities/generated_approvers.js");
const { validate_submission_data } = require("../../jsonlogic/validate_submission.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

const INSERT_BATCH_SIZE = 200;
const HOUR_MS = 3600 * 1000;

function random_int(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Spreads submission timestamps across the requested window: each full or
 * partial hour bucket gets a random count between min and max records per
 * hour, each record landing at a random moment inside its own bucket.
 */
function build_timestamps(from, to, min_per_hour, max_per_hour) {
  const timestamps = [];
  let bucket_start = from.getTime();
  const end = to.getTime();
  while (bucket_start < end) {
    const bucket_end = Math.min(bucket_start + HOUR_MS, end);
    const count = random_int(min_per_hour, max_per_hour);
    for (let index = 0; index < count; index += 1) {
      timestamps.push(new Date(bucket_start + Math.random() * (bucket_end - bucket_start)));
    }
    bucket_start = bucket_end;
  }
  timestamps.sort((a, b) => a - b);
  return timestamps;
}

/**
 * The background loop that actually generates and stores the records - runs
 * detached from the request that started it; the client follows along via
 * the long-poll job endpoint. Every record goes through the exact same
 * validate_submission_data gate as a real public submit; a record that
 * cannot pass after a few fresh attempts is counted failed and never saved.
 */
async function run_generation(job_id, form_version, routing_config, timestamps) {
  let buffer = [];
  let saved = 0;
  let failed = 0;
  let processed = 0;

  const flush = async () => {
    if (buffer.length === 0) return;
    await submissions_model.insert_test_submissions(buffer);
    buffer = [];
  };

  try {
    for (const submitted_at of timestamps) {
      let validation_result = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const record = generate_test_record(form_version.schema);
        validation_result = validate_submission_data(form_version.schema, record, "en");
        if (validation_result.valid) break;
      }

      if (validation_result && validation_result.valid) {
        buffer.push({
          form_group_id: form_version.form_group_id,
          version: Number(form_version.version),
          project_id: form_version.project_id,
          data: validation_result.resolved_data,
          client_submission_id: null,
          // Routed through the form's current approval flow (hand-made
          // approvers plus the generated pool) exactly like a real submit -
          // conditions decide who signs - but no email is ever sent.
          approval: await build_test_submission_approval(form_version.form_group_id, routing_config, validation_result.resolved_data),
          [submissions_model.TEST_DATA_FLAG]: true,
          submitted_at,
        });
        saved += 1;
      } else {
        failed += 1;
      }

      processed += 1;
      test_jobs.update_progress(job_id, { processed, saved, failed });
      if (buffer.length >= INSERT_BATCH_SIZE) await flush();
      // Generation is pure CPU work - yielding every few records keeps the
      // event loop (and the long-poll progress endpoint) responsive.
      if (processed % 20 === 0) await new Promise((resolve) => setImmediate(resolve));
    }
    await flush();
    test_jobs.finish_job(job_id, "completed");
  } catch (error) {
    try {
      await flush();
    } catch (flush_error) {
      // The batch that failed to land is already reflected in the error state.
    }
    test_jobs.finish_job(job_id, "error", error.message);
  }
}

/**
 * Starts a test-data generation job for one specific form version: builds
 * the timestamp plan from the requested window and per-hour rates, answers
 * immediately with a job id, and generates in the background.
 */
async function generate_test_data(req, res) {
  try {
    const { form_group_id } = req.params;
    const { version, from, to, min_per_hour, max_per_hour } = req.body || {};

    if (!form_group_id || version === undefined || version === null) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }

    const access = await project_access.can_view_form_group(req.user, form_group_id);
    if (access.found && !access.allowed) {
      return res.status(403).json(warning_response(req, "ACCESS_DENIED"));
    }

    const from_date = new Date(from);
    const to_date = new Date(to);
    if (!from || !to || Number.isNaN(from_date.getTime()) || Number.isNaN(to_date.getTime()) || from_date >= to_date) {
      return res.status(400).json(warning_response(req, "TEST_DATA_RANGE_INVALID"));
    }

    const min_rate = parseInt(min_per_hour, 10);
    const max_rate = parseInt(max_per_hour, 10);
    if (!Number.isFinite(min_rate) || !Number.isFinite(max_rate) || min_rate < 0 || max_rate < 1 || min_rate > max_rate) {
      return res.status(400).json(warning_response(req, "TEST_DATA_RATE_INVALID"));
    }

    const form_version = await forms_model.get_version_document(form_group_id, version);
    if (!form_version) {
      return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    }

    const timestamps = build_timestamps(from_date, to_date, min_rate, max_rate);
    if (timestamps.length === 0) {
      return res.status(400).json(warning_response(req, "TEST_DATA_EMPTY_RANGE"));
    }

    // Approvals are routed against the ACTIVE version's flow - that is
    // where the approval page saves approvers - regardless of which version
    // the records are generated into.
    const active_version = await forms_model.get_active_version(form_group_id);
    const routing_config = (active_version || form_version).approval_config || null;

    const job = test_jobs.create_job(timestamps.length);
    setImmediate(() => run_generation(job.id, form_version, routing_config, timestamps));

    return res.status(202).json(success_response(req, "TEST_DATA_GENERATION_STARTED", { job_id: job.id, total: timestamps.length }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = generate_test_data;
