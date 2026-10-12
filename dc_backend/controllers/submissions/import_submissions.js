const fs = require("fs");
const forms_model = require("../../models/forms_model.js");
const imports_model = require("../../models/form_imports_model.js");
const { manager_context } = require("../forms/translation_links.js");
const { fillable_fields, fillable_schema_fields, template_headers } = require("../../utilities/import_fields.js");
const { csv_line } = require("../../utilities/csv_parser.js");
const { read_import_rows } = require("../../utilities/import_rows.js");
const { build_xlsx_template } = require("../../utilities/import_template_xlsx.js");
const { build_plan, required_left_empty, run_import_job } = require("../../utilities/import_runner.js");
const { sanitize_filename } = require("../../utilities/export_columns.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { translate } = require("../../i18n/index.js");

const PREVIEW_ROWS = 5;

function remove_file(file) {
  if (file && file.path) fs.unlink(file.path, () => {});
}

/**
 * CSV / Excel import of a form's responses, for the people who may edit
 * the form (the same check the form's other editor-only actions use):
 *
 *   GET  /import/template          the headers template (csv or xlsx)
 *   POST /import/upload            the .csv or .xlsx file, read into a session
 *   POST /import/:import_id/run    starts the background run
 *   GET  /import/:import_id/status the run's progress and outcome
 */

/**
 * One header row - the fillable fields, a location as its three columns -
 * as CSV, or with ?format=xlsx as a workbook whose choice columns offer
 * their options to pick from (see utilities/import_template_xlsx.js).
 */
async function import_template(req, res) {
  try {
    const context = await manager_context(req, res);
    if (!context) return undefined;
    // English unless asked otherwise, like the export: the file usually
    // goes to someone outside the app.
    const lang = (req.query && req.query.language) || "en";
    const as_xlsx = req.query && req.query.format === "xlsx";
    const fields = fillable_fields(context.active_version, lang, translate);
    const headers = template_headers(fields);
    const base_name = `${sanitize_filename(context.active_version.form_name || "form")}_template`;
    if (as_xlsx) {
      const buffer = await build_xlsx_template(headers, fields, lang);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${base_name}.xlsx"`);
      res.setHeader("Content-Length", buffer.length);
      return res.status(200).send(buffer);
    }
    const body = String.fromCharCode(0xfeff) + csv_line(headers) + "\r\n";
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${base_name}.csv"`);
    return res.status(200).send(body);
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

/**
 * Takes the uploaded .csv or .xlsx (multer has already refused anything
 * else, see utilities/upload.js), reads it through utilities/import_rows.js
 * (the same door the run reads it through), opens an import session that
 * keeps the file on disk, and answers with the headers, a five-row preview
 * and the form's fillable fields for the mapping screen.
 */
async function import_upload(req, res) {
  const file = req.file;
  try {
    const context = await manager_context(req, res);
    if (!context) {
      remove_file(file);
      return undefined;
    }
    if (req.import_file_rejected) return res.status(422).json(warning_response(req, "IMPORT_FILE_TYPE"));
    if (!file) return res.status(400).json(warning_response(req, "FILE_REQUIRED"));

    const parsed = await read_import_rows(file.path);
    if (parsed.headers.length === 0 || parsed.headers.every((header) => header === "")) {
      remove_file(file);
      return res.status(422).json(warning_response(req, "IMPORT_CSV_EMPTY"));
    }
    if (parsed.rows.length === 0) {
      remove_file(file);
      return res.status(422).json(warning_response(req, "IMPORT_CSV_NO_ROWS"));
    }

    const version = context.active_version;
    const session = await imports_model.create_import({
      form_group_id: req.params.form_group_id,
      version: Number(version.version),
      project_id: version.project_id,
      user: { user_id: String(req.user.user_id), name: req.user.full_name || "", email: req.user.email || "" },
      file_name: file.originalname,
      file_path: file.path,
      headers: parsed.headers,
      row_count: parsed.rows.length,
      preview: parsed.rows.slice(0, PREVIEW_ROWS),
    });
    const fields = fillable_fields(version, req.language, translate);
    return res.status(201).json(
      success_response(
        req,
        "IMPORT_UPLOADED",
        {
          import_id: session._id.toString(),
          file_name: file.originalname,
          headers: parsed.headers,
          row_count: parsed.rows.length,
          preview: session.preview,
          fields,
        },
        { count: parsed.rows.length },
      ),
    );
  } catch (error) {
    remove_file(file);
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

/**
 * Starts the run from { mapping, defaults } and answers at once with
 * { running: true }; the client follows it on the status route. Refused
 * before anything starts when nothing is mapped, when a required field
 * would stay empty, or when this session already ran.
 */
async function import_run(req, res) {
  try {
    const context = await manager_context(req, res);
    if (!context) return undefined;
    const { form_group_id, import_id } = req.params;
    const session = await imports_model.find_import(form_group_id, import_id);
    if (!session) return res.status(404).json(warning_response(req, "IMPORT_NOT_FOUND"));
    if (session.status !== "uploaded") return res.status(409).json(warning_response(req, "IMPORT_ALREADY_RUN", null, { data: imports_model.import_view(session) }));

    const version_doc = (await forms_model.get_version_document(form_group_id, session.version)) || context.active_version;
    const field_views = fillable_fields(version_doc, req.language, translate);
    const schema_fields = fillable_schema_fields(version_doc);
    const { mapping, defaults } = req.body || {};
    const plan = build_plan(field_views, schema_fields, mapping, defaults, session.headers.length);
    if (plan.mapped_count === 0) return res.status(400).json(warning_response(req, "IMPORT_MAPPING_REQUIRED"));
    const missing = required_left_empty(plan);
    if (missing.length > 0) {
      return res.status(422).json(warning_response(req, "IMPORT_REQUIRED_EMPTY", { fields: missing.join(", ") }, { required_fields: missing }));
    }
    if (!session.file_path || !fs.existsSync(session.file_path)) return res.status(410).json(warning_response(req, "IMPORT_FILE_GONE"));

    const claimed = await imports_model.claim_run(session._id);
    if (!claimed) return res.status(409).json(warning_response(req, "IMPORT_ALREADY_RUN"));

    const language = req.language;
    const user = req.user;
    setImmediate(() => run_import_job(claimed, version_doc, plan, language, user));
    return res.status(202).json(success_response(req, "IMPORT_STARTED", Object.assign({ running: true }, imports_model.import_view(claimed))));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

/** Where the run stands: status, stage, rows done of total, and the outcome message. */
async function import_status(req, res) {
  try {
    const context = await manager_context(req, res);
    if (!context) return undefined;
    const session = await imports_model.find_import(req.params.form_group_id, req.params.import_id);
    if (!session) return res.status(404).json(warning_response(req, "IMPORT_NOT_FOUND"));
    return res.status(200).json(success_response(req, "IMPORT_STATUS_FETCHED", imports_model.import_view(session)));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = { import_template, import_upload, import_run, import_status };
