const os = require("os");
const path = require("path");
const submissions_model = require("../../models/submissions_model.js");
const forms_model = require("../../models/forms_model.js");
const project_access = require("../../utilities/project_access.js");
const export_jobs = require("../../utilities/export_jobs.js");
const { XlsxStreamWriter } = require("../../utilities/xlsx_stream_writer.js");
const { resolve_period_bounds } = require("../../utilities/period_bounds.js");
const { resolve_client_origin } = require("../../utilities/approval_email.js");
const { format_respondent } = require("../../utilities/respondent.js");
const { build_diffed_columns, format_cell, sanitize_filename } = require("../../utilities/export_columns.js");
const { is_enabled: is_tracking_enabled } = require("../../utilities/tracking.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { translate } = require("../../i18n/index.js");

// Progress is reported and the event loop released every PROGRESS_EVERY
// rows; Mongo hands rows over in batches of BATCH_SIZE.
const PROGRESS_EVERY = 250;
const BATCH_SIZE = 1000;
const STYLE_HEADER = 1;
const STYLE_TITLE = 2;
const STYLE_TOTAL = 3;
const STYLE_NOTE = 4;

/**
 * Writes the export in the background: one Mongo cursor over the range
 * (no page-by-page skipping), every row streamed straight into a zipped
 * .xlsx on disk by the hand-rolled writer (constant memory, no cell
 * objects), cells formatted from precomputed column keys. The client
 * follows the job's progress and downloads the file when it is ready.
 */
async function run_export(job, form_group_id, bounds, columns, field_type_by_id, title, lang, origin, tracking) {
  const keys = columns.map((column) => column.key);
  const types = columns.map((column) => field_type_by_id.get(column.key) || null);
  const version_at = keys.indexOf("version");
  const by_at = keys.indexOf("submitted_by");
  const at_at = keys.indexOf("submitted_at");
  const id_at = keys.indexOf("record_id");
  const data_at = keys.map((key, index) => (index === version_at || index === by_at || index === at_at || index === id_at ? -1 : index));
  const writer = new XlsxStreamWriter(job.file_path, { widths: keys.map(() => 22), sheet_name: "Data" });
  let cursor = null;

  try {
    if (title) {
      writer.add_row([title], STYLE_TITLE);
      writer.add_row([]);
    }
    writer.add_row(columns.map((column) => column.label), STYLE_HEADER);

    export_jobs.update_progress(job.id, { stage: "writing" });
    let processed = 0;
    let cancelled = false;
    cursor = submissions_model.stream_in_range(form_group_id, bounds, tracking, BATCH_SIZE);
    for await (const submission of cursor) {
      const data = submission.data || {};
      const values = new Array(keys.length);
      for (let index = 0; index < keys.length; index += 1) {
        if (data_at[index] !== -1) values[index] = format_cell(data[keys[index]], types[index], origin);
      }
      if (id_at >= 0) values[id_at] = submission._id ? submission._id.toString() : "";
      if (version_at >= 0) values[version_at] = submission.version || "";
      if (by_at >= 0) values[by_at] = format_respondent(submission.respondent);
      if (at_at >= 0) values[at_at] = submission.submitted_at ? new Date(submission.submitted_at).toISOString() : "";
      const wait = writer.add_row(values);
      if (wait) await wait;
      processed += 1;
      if (processed % PROGRESS_EVERY === 0) {
        export_jobs.update_progress(job.id, { processed });
        if (export_jobs.is_cancel_requested(job.id)) {
          cancelled = true;
          break;
        }
        await new Promise((resolve) => setImmediate(resolve));
      }
    }
    await cursor.close().catch(() => {});
    export_jobs.update_progress(job.id, { processed, stage: cancelled ? "cancelled" : "finishing" });

    if (cancelled) {
      await writer.abort();
      export_jobs.remove_file(job);
      export_jobs.finish_job(job.id, "cancelled");
      return;
    }
    if (processed === 0) writer.add_row([translate("NO_DATA_TO_EXPORT", lang)], STYLE_NOTE);
    writer.add_row([]);
    writer.add_row([`${translate("TABLE_TOTAL", lang)}: ${processed}`], STYLE_TOTAL);
    await writer.finish();
    export_jobs.finish_job(job.id, "completed");
  } catch (error) {
    if (cursor) await cursor.close().catch(() => {});
    await writer.abort();
    export_jobs.remove_file(job);
    export_jobs.finish_job(job.id, "error", error.message);
  }
}

/**
 * Starts an export job for a form's responses in an optional period and
 * answers at once with the job id and how many rows it will write.
 */
async function start_export(req, res) {
  try {
    const { form_group_id } = req.params;
    const { period = "all", from, to, title, language } = req.body || {};
    // The exporter picks the language in the dialog. Nothing picked means
    // English, not whatever the browser happens to be reading the app in -
    // a data file usually leaves the building, and English is the one
    // everybody downstream can read.
    const lang = language || "en";

    if (!form_group_id) return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    const access = await project_access.can_view_form_group(req.user, form_group_id);
    if (access.found && !access.allowed) return res.status(403).json(warning_response(req, "ACCESS_DENIED"));

    const bounds = resolve_period_bounds(period, from, to);
    if (bounds === undefined) return res.status(400).json(warning_response(req, "VALIDATION_FAILED"));

    const versions = await forms_model.get_versions_by_group(form_group_id);
    if (!versions || versions.length === 0) return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));

    // The range is read over the records' stages, exactly as the table
    // reads it, so the file holds the same cars the table listed - one
    // line each, carrying the value each held at the range's end.
    const active_version = versions.find((entry) => entry.is_active) || versions[0];
    const tracking = active_version && is_tracking_enabled(active_version.tracking) ? active_version.tracking : null;

    const total = await submissions_model.count_in_range(form_group_id, bounds, tracking);
    const { columns, field_type_by_id } = build_diffed_columns(versions, lang, translate);
    const filename = sanitize_filename(title || "export") + ".xlsx";
    const job = export_jobs.create_job(total, { filename });
    job.file_path = path.join(os.tmpdir(), `dcs_export_${job.id}.xlsx`);
    const origin = resolve_client_origin(req);

    setImmediate(() => run_export(job, form_group_id, bounds, columns, field_type_by_id, title, lang, origin, tracking));
    return res.status(202).json(success_response(req, "EXPORT_STARTED", export_jobs.job_view(job)));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = start_export;
