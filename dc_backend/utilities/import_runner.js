const fs = require("fs");
const submissions_model = require("../models/submissions_model.js");
const tracked_records_model = require("../models/tracked_records_model.js");
const imports_model = require("../models/form_imports_model.js");
const { validate_submission_data } = require("../jsonlogic/validate_submission.js");
const { is_enabled: is_tracking_enabled, tracking_fields_for_new, key_field_label } = require("./tracking.js");
const { read_import_rows } = require("./import_rows.js");
const { GEO_PARTS } = require("./import_fields.js");
const { convert_cell, convert_location, is_blank } = require("./import_values.js");
const { translate } = require("../i18n/index.js");

/**
 * The import run: the mapping and the empty-value defaults become a plan,
 * every CSV row becomes a submission through the same validation the
 * public form goes through, and the rows are written in batches of 50 with
 * the progress kept on the import session for the client to poll.
 *
 * All or nothing: the rows are all checked before the first write, and a
 * batch that fails to write removes everything the import wrote so far.
 * No transaction is used - the import id every record carries is what
 * the rollback deletes by.
 */
const BATCH_SIZE = 50;
const CHECK_PROGRESS_EVERY = 200;
const KEY_CHUNK = 500;

const column_index = (value, width) => (Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) < width ? Number(value) : null);

/**
 * { entries, mapped_count }: one entry per fillable field with the column
 * (or the three part columns) it reads and what to put when the cell is
 * empty. Mapping rows that name an unknown field, a column outside the
 * file or a part on a non-location field are ignored.
 */
function build_plan(field_views, schema_fields, mapping, defaults, width) {
  const entries = field_views.map((view) => ({
    view,
    field: schema_fields.get(view.id),
    column: null,
    parts: { latitude: null, longitude: null, accuracy: null },
    use_default: false,
    default_value: undefined,
  }));
  const by_id = new Map(entries.map((entry) => [entry.view.id, entry]));
  let mapped_count = 0;
  (Array.isArray(mapping) ? mapping : []).forEach((row) => {
    if (!row || typeof row !== "object") return;
    const entry = by_id.get(row.field_id);
    const column = column_index(row.column, width);
    if (!entry || column === null) return;
    if (row.part) {
      if (entry.field.type !== "geolocation" || !GEO_PARTS.includes(row.part)) return;
      entry.parts[row.part] = column;
    } else {
      entry.column = column;
    }
    mapped_count += 1;
  });
  const default_map = defaults && typeof defaults === "object" ? defaults : {};
  entries.forEach((entry) => {
    const choice = default_map[entry.view.id];
    if (!choice || typeof choice !== "object" || choice.mode !== "use") return;
    entry.use_default = true;
    entry.default_value = choice.value;
  });
  return { entries, mapped_count };
}

const is_mapped = (entry) => entry.column !== null || GEO_PARTS.some((part) => entry.parts[part] !== null);

function default_is_blank(entry) {
  const value = entry.default_value;
  if (entry.field.type === "geolocation") return !value || typeof value !== "object" || is_blank(value.latitude) || is_blank(value.longitude);
  return is_blank(value);
}

/** The labels of the required fields that would stay empty: unmapped without a usable default, or "use this value" left blank. */
function required_left_empty(plan) {
  return plan.entries
    .filter((entry) => entry.view.required)
    .filter((entry) => (entry.use_default ? default_is_blank(entry) : !is_mapped(entry)))
    .map((entry) => entry.view.label);
}

/** One row's answers, or the first cell that could not be read. */
function build_row(plan, cells, language) {
  const data = {};
  for (const entry of plan.entries) {
    let converted;
    if (entry.field.type === "geolocation") {
      const parts = {};
      GEO_PARTS.forEach((part) => {
        parts[part] = entry.parts[part] === null ? "" : cells[entry.parts[part]];
      });
      converted = convert_location(parts, entry.column === null ? "" : cells[entry.column], language);
      if (!converted.error && converted.value === undefined && entry.use_default) converted = convert_location(entry.default_value || {}, "", language);
    } else {
      converted = convert_cell(entry.field, entry.column === null ? "" : cells[entry.column], language);
      if (!converted.error && converted.value === undefined && entry.use_default) converted = convert_cell(entry.field, entry.default_value, language);
    }
    if (converted.error) return { error: { field: entry.view.label, detail: converted.error } };
    if (converted.value !== undefined) data[entry.field.id] = converted.value;
  }
  return { data };
}

function row_error(row_number, field, detail) {
  const error = new Error(`${row_number}: ${field}: ${detail}`);
  error.row_number = row_number;
  error.field = field;
  error.detail = detail;
  return error;
}

/** The first blocking message of a failed validation, with the field it belongs to. */
function first_blocking(field_errors, label_of) {
  for (const field_id of Object.keys(field_errors)) {
    for (const entry of field_errors[field_id]) {
      if (typeof entry === "string") return { field: label_of(field_id), detail: entry };
      if (entry && entry.severity === "error") return { field: label_of(field_id), detail: entry.message };
    }
  }
  return { field: "", detail: "" };
}

const release = () => new Promise((resolve) => setImmediate(resolve));

async function run_import_job(session, version_doc, plan, language, user) {
  const import_id = session._id;
  const form_group_id = session.form_group_id;
  const labels = new Map(plan.entries.map((entry) => [entry.view.id, entry.view.label]));
  const label_of = (field_id) => labels.get(field_id) || field_id;
  const tracking = is_tracking_enabled(version_doc.tracking) ? version_doc.tracking : null;
  const key_label = tracking ? key_field_label(version_doc.schema, tracking, language) : "";
  const started = Date.now();
  const by = { user_id: user ? String(user.user_id) : null, name: user ? user.full_name || "" : "" };
  let wrote_any = false;

  const build_document = (cells, index) => {
    const row_number = index + 2;
    const built = build_row(plan, cells, language);
    if (built.error) throw row_error(row_number, built.error.field, built.error.detail);
    const validation = validate_submission_data(version_doc.schema, built.data, language);
    if (!validation.valid) {
      const first = first_blocking(validation.field_errors, label_of);
      throw row_error(row_number, first.field, first.detail);
    }
    const submitted_at = new Date(started + index);
    return Object.assign(
      {
        form_group_id,
        version: Number(version_doc.version),
        project_id: version_doc.project_id,
        submitted_at,
        data: validation.resolved_data,
        client_submission_id: null,
        respondent: null,
        approval: null,
        source: "import",
        import_id,
        imported_by: by,
      },
      tracking_fields_for_new(tracking, validation.resolved_data, submitted_at, null),
    );
  };

  try {
    const parsed = await read_import_rows(session.file_path);
    const rows = parsed.rows;
    await imports_model.update_progress(import_id, { total_rows: rows.length, stage: "checking", checked_rows: 0 });

    // Pass one: every row read and validated, nothing written yet. On a
    // tracked form whose key must be unique, the keys are checked against
    // each other and against the records the form already holds.
    const key_rows = new Map();
    for (let index = 0; index < rows.length; index += 1) {
      const document = build_document(rows[index], index);
      if (tracking && tracking.key_unique && document.record_key) {
        if (key_rows.has(document.record_key)) throw row_error(index + 2, key_label, translate("IMPORT_DUPLICATE_KEY", language, { value: document.record_key, row: key_rows.get(document.record_key) }));
        key_rows.set(document.record_key, index + 2);
      }
      if ((index + 1) % CHECK_PROGRESS_EVERY === 0) {
        await imports_model.update_progress(import_id, { checked_rows: index + 1 });
        await release();
      }
    }
    const keys = Array.from(key_rows.keys());
    for (let start = 0; start < keys.length; start += KEY_CHUNK) {
      const existing = await tracked_records_model.list_existing_record_keys(form_group_id, keys.slice(start, start + KEY_CHUNK));
      if (existing.length > 0) throw row_error(key_rows.get(existing[0]), key_label, translate("TRACKING_KEY_EXISTS", language, { field: key_label }));
    }

    // Pass two: written in batches of 50, the progress kept on the session.
    await imports_model.update_progress(import_id, { stage: "saving", checked_rows: rows.length, done_rows: 0 });
    let created = 0;
    for (let start = 0; start < rows.length; start += BATCH_SIZE) {
      const batch = rows.slice(start, start + BATCH_SIZE).map((cells, offset) => build_document(cells, start + offset));
      wrote_any = true;
      created += await submissions_model.insert_imported_submissions(batch);
      await imports_model.update_progress(import_id, { done_rows: created, created });
      await release();
    }
    await imports_model.finish_import(import_id, "done", {
      stage: "done",
      done_rows: created,
      created,
      failed_rows: 0,
      error: null,
      message: translate("IMPORT_SAVED", language, { count: created }),
    });
  } catch (error) {
    if (wrote_any) await submissions_model.delete_by_import_id(form_group_id, import_id).catch(() => 0);
    const detail = error.row_number
      ? translate("IMPORT_ROW_ERROR", language, { row: error.row_number, field: error.field, detail: error.detail })
      : translate("IMPORT_FAILED_UNEXPECTED", language, { detail: error.message });
    await imports_model.finish_import(import_id, "failed", {
      stage: "failed",
      created: 0,
      failed_rows: error.row_number ? 1 : 0,
      failed_row: error.row_number || null,
      failed_field: error.field || null,
      error: detail,
      message: translate("IMPORT_NOTHING_SAVED", language),
    });
  } finally {
    if (session.file_path) fs.promises.unlink(session.file_path).catch(() => {});
  }
}

module.exports = { BATCH_SIZE, build_plan, required_left_empty, build_row, run_import_job };
