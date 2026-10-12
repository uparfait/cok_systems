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
 * The import run. Pass one reads EVERY row and checks it exactly as the
 * public submit does - the cell conversions (types, options, ranges),
 * then validate_submission_data (mandatory, visibility and parent-group
 * logic, presets, computed fields, exclusive options, every per-field
 * rule rebuilt from its operator, media checks), then the tracked key's
 * uniqueness inside the file and against the form - and collects every
 * problem as { row, column, field, reason } with the row number the
 * spreadsheet shows. Anything found means nothing is written. Only a
 * clean file goes to pass two, written in batches of 50; a batch that
 * fails to write removes everything the import wrote. No transaction:
 * the import id every record carries is what the rollback deletes by.
 * The uploaded file is deleted whatever the outcome.
 */
const BATCH_SIZE = 50;
const CHECK_PROGRESS_EVERY = 200;
const KEY_CHUNK = 500;
const MAX_REPORTED_ERRORS = 200;
const MAX_NOTES = 500;

const column_index = (value, width) => (Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) < width ? Number(value) : null);

/**
 * { entries, mapped_count, headers }: one entry per fillable field with
 * the column (or the three part columns) it reads and, when a client still
 * sends defaults, what to put when the cell is empty. Mapping rows that
 * name an unknown field, a column outside the file or a part on a
 * non-location field are ignored.
 */
function build_plan(field_views, schema_fields, mapping, defaults, headers) {
  const width = Array.isArray(headers) ? headers.length : Number(headers) || 0;
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
  return { entries, mapped_count, headers: Array.isArray(headers) ? headers : [] };
}

const is_mapped = (entry) => entry.column !== null || GEO_PARTS.some((part) => entry.parts[part] !== null);

/** The header of the column an entry reads (a location: its first mapped part), for messages; "" when unmapped. */
function column_name(plan, entry) {
  const index = entry.column !== null ? entry.column : GEO_PARTS.map((part) => entry.parts[part]).find((value) => value !== null);
  return index === undefined || index === null ? "" : plan.headers[index] || "";
}

function default_is_blank(entry) {
  const value = entry.default_value;
  if (entry.field.type === "geolocation") return !value || typeof value !== "object" || is_blank(value.latitude) || is_blank(value.longitude);
  return is_blank(value);
}

/** The labels of the required fields no column feeds (and no usable default): refused before the run starts. */
function required_left_empty(plan) {
  return plan.entries
    .filter((entry) => entry.view.required)
    .filter((entry) => (entry.use_default ? default_is_blank(entry) : !is_mapped(entry)))
    .map((entry) => entry.view.label);
}

/** One row's answers, every cell of it that could not be read, and every value matched to an option by other than its exact text. */
function build_row(plan, cells, language) {
  const data = {};
  const errors = [];
  const notes = [];
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
    if (converted.error) errors.push({ field: entry.view.label, reason: converted.error, column: column_name(plan, entry) });
    else if (converted.value !== undefined) data[entry.field.id] = converted.value;
    if (!converted.error && converted.notes) converted.notes.forEach((note) => notes.push({ field: entry.view.label, column: column_name(plan, entry), from: note.from, to: note.to }));
  }
  return { data, errors, notes };
}

/** Every blocking message of a failed validation, each with its field and the column that fed it. */
function blocking_problems(field_errors, plan, label_of) {
  const by_id = new Map(plan.entries.map((entry) => [entry.view.id, entry]));
  const problems = [];
  Object.keys(field_errors).forEach((field_id) => {
    const column = by_id.has(field_id) ? column_name(plan, by_id.get(field_id)) : "";
    field_errors[field_id].forEach((entry) => {
      if (typeof entry === "string") problems.push({ field: label_of(field_id), reason: entry, column });
      else if (entry && entry.severity === "error") problems.push({ field: label_of(field_id), reason: entry.message, column });
    });
  });
  return problems;
}

/** One problem as a line: the row as the spreadsheet shows it, the column, the field and the reason. */
function problem_line(problem, language) {
  const vars = { row: problem.row, field: problem.field, detail: problem.reason, column: problem.column };
  return translate(problem.column ? "IMPORT_ROW_ERROR" : "IMPORT_ROW_ERROR_NO_COLUMN", language, vars);
}

/** The message of a run that stopped on its own: a reader's refusal or an unexpected error. */
function failure_message(error, language) {
  if (error.row_number) return problem_line({ row: error.row_number, column: error.column, field: error.field, reason: error.detail }, language);
  if (error.code && String(error.code).startsWith("IMPORT_")) return translate(error.code, language, error.vars || {});
  return translate("IMPORT_FAILED_UNEXPECTED", language, { detail: error.message });
}

const release = () => new Promise((resolve) => setImmediate(resolve));

async function run_import_job(session, version_doc, plan, language, user) {
  const import_id = session._id;
  const form_group_id = session.form_group_id;
  const labels = new Map(plan.entries.map((entry) => [entry.view.id, entry.view.label]));
  const label_of = (field_id) => labels.get(field_id) || field_id;
  const tracking = is_tracking_enabled(version_doc.tracking) ? version_doc.tracking : null;
  const key_label = tracking ? key_field_label(version_doc.schema, tracking, language) : "";
  const key_column = tracking ? column_name(plan, plan.entries.find((entry) => entry.view.id === tracking.key_field_id) || { column: null, parts: {} }) : "";
  const started = Date.now();
  const by = { user_id: user ? String(user.user_id) : null, name: user ? user.full_name || "" : "" };
  let wrote_any = false;
  let row_numbers = [];
  const row_of = (index) => row_numbers[index] || index + 2;

  const problems = [];
  let problem_count = 0;
  const report = (row, problem) => {
    problem_count += 1;
    if (problems.length < MAX_REPORTED_ERRORS) problems.push({ row, column: problem.column || "", field: problem.field || "", reason: problem.reason || "" });
  };
  const notes = [];
  let note_count = 0;
  const remember = (row, note) => {
    note_count += 1;
    if (notes.length < MAX_NOTES) notes.push({ row, column: note.column || "", field: note.field || "", from: note.from, to: note.to });
  };
  const outcome_notes = () => ({ notes, note_count });

  /** The checked answers of one row (every problem reported, every near match remembered on the first pass), or null when the row has any problem. */
  const check_row = (cells, index, first_pass) => {
    const built = build_row(plan, cells, language);
    built.errors.forEach((problem) => report(row_of(index), problem));
    if (first_pass) built.notes.forEach((note) => remember(row_of(index), note));
    const validation = validate_submission_data(version_doc.schema, built.data, language);
    if (!validation.valid) blocking_problems(validation.field_errors, plan, label_of).forEach((problem) => report(row_of(index), problem));
    return built.errors.length === 0 && validation.valid ? validation.resolved_data : null;
  };

  const to_document = (resolved_data, index) => {
    const submitted_at = new Date(started + index);
    return Object.assign(
      {
        form_group_id,
        version: Number(version_doc.version),
        project_id: version_doc.project_id,
        submitted_at,
        data: resolved_data,
        client_submission_id: null,
        respondent: null,
        approval: null,
        source: "import",
        import_id,
        imported_by: by,
      },
      tracking_fields_for_new(tracking, resolved_data, submitted_at, null),
    );
  };

  try {
    const parsed = await read_import_rows(session.file_path);
    const rows = parsed.rows;
    row_numbers = parsed.row_numbers || [];
    await imports_model.update_progress(import_id, { total_rows: rows.length, stage: "checking", checked_rows: 0 });

    const key_rows = new Map();
    for (let index = 0; index < rows.length; index += 1) {
      const resolved = check_row(rows[index], index, true);
      if (resolved && tracking && tracking.key_unique) {
        const key = to_document(resolved, index).record_key;
        if (key && key_rows.has(key)) report(row_of(index), { column: key_column, field: key_label, reason: translate("IMPORT_DUPLICATE_KEY", language, { value: key, row: key_rows.get(key) }) });
        else if (key) key_rows.set(key, row_of(index));
      }
      if ((index + 1) % CHECK_PROGRESS_EVERY === 0) {
        await imports_model.update_progress(import_id, { checked_rows: index + 1 });
        await release();
      }
    }
    const keys = Array.from(key_rows.keys());
    for (let start = 0; start < keys.length; start += KEY_CHUNK) {
      const existing = await tracked_records_model.list_existing_record_keys(form_group_id, keys.slice(start, start + KEY_CHUNK));
      existing.forEach((key) => report(key_rows.get(key), { column: key_column, field: key_label, reason: translate("TRACKING_KEY_EXISTS", language, { field: key_label }) }));
    }

    if (problem_count > 0) {
      problems.sort((a, b) => a.row - b.row);
      await imports_model.finish_import(import_id, "failed", Object.assign({
        stage: "failed",
        checked_rows: rows.length,
        created: 0,
        failed_rows: new Set(problems.map((problem) => problem.row)).size,
        failed_row: problems[0].row,
        failed_field: problems[0].field,
        failed_column: problems[0].column,
        error: problem_line(problems[0], language),
        errors: problems,
        error_count: problem_count,
        message: translate("IMPORT_NOTHING_SAVED_FIX", language),
      }, outcome_notes()));
      return;
    }

    await imports_model.update_progress(import_id, { stage: "saving", checked_rows: rows.length, done_rows: 0 });
    let created = 0;
    for (let start = 0; start < rows.length; start += BATCH_SIZE) {
      const batch = rows.slice(start, start + BATCH_SIZE).map((cells, offset) => to_document(check_row(cells, start + offset, false), start + offset));
      wrote_any = true;
      created += await submissions_model.insert_imported_submissions(batch);
      await imports_model.update_progress(import_id, { done_rows: created, created });
      await release();
    }
    await imports_model.finish_import(import_id, "done", Object.assign({
      stage: "done",
      done_rows: created,
      created,
      failed_rows: 0,
      error: null,
      errors: [],
      error_count: 0,
      message: translate("IMPORT_SAVED", language, { count: created }),
    }, outcome_notes()));
  } catch (error) {
    if (wrote_any) await submissions_model.delete_by_import_id(form_group_id, import_id).catch(() => 0);
    await imports_model.finish_import(import_id, "failed", Object.assign({
      stage: "failed",
      created: 0,
      failed_rows: 0,
      error: failure_message(error, language),
      errors: [],
      error_count: 0,
      message: translate("IMPORT_NOTHING_SAVED", language),
    }, outcome_notes()));
  } finally {
    if (session.file_path) fs.promises.unlink(session.file_path).catch(() => {});
  }
}

module.exports = { BATCH_SIZE, MAX_REPORTED_ERRORS, MAX_NOTES, build_plan, required_left_empty, build_row, failure_message, run_import_job };
