const fs = require("fs");
const config = require("../configurations/config.js");
const submissions_model = require("../models/submissions_model.js");
const tracked_records_model = require("../models/tracked_records_model.js");
const imports_model = require("../models/form_imports_model.js");
const { validate_submission_data } = require("../jsonlogic/validate_submission.js");
const { is_enabled: is_tracking_enabled, key_ids_of, tracking_fields_for_new, key_field_labels } = require("./tracking.js");
const { read_import_rows } = require("./import_rows.js");
const { GEO_PARTS } = require("./import_fields.js");
const { convert_cell, convert_location, convert_system, is_blank } = require("./import_values.js");
const { MEDIA_TYPES, is_http_link, download_media, run_pool } = require("./import_media.js");
const { translate } = require("../i18n/index.js");

/**
 * The import run. Pass one reads EVERY row and checks it exactly as the
 * public submit does - the cell conversions (types, options, ranges),
 * then validate_submission_data against the version the row names (or
 * the active one), then the tracked key's uniqueness inside the file and
 * against the form - collecting every problem as { row, column, field,
 * reason } with the row number the spreadsheet shows. Anything found
 * means nothing is written. A clean file goes to pass two: media links
 * are downloaded (failures keep the link and are listed), then the batch
 * of 50 is written; a batch that fails to write removes everything the
 * import wrote, downloaded files included. No transaction: the import id
 * every record carries is what the rollback deletes by. The uploaded
 * file is deleted whatever the outcome.
 */
const BATCH_SIZE = 50;
const CHECK_PROGRESS_EVERY = 200;
const KEY_CHUNK = 500;
const MAX_REPORTED_ERRORS = 200;
const MAX_NOTES = 500;
const MAX_MEDIA_FAILURES = 500;

const column_index = (value, width) => (Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) < width ? Number(value) : null);

/**
 * { entries, mapped_count, headers }: one entry per target (data field or
 * record field) with the column (or the three part columns) it reads and,
 * when a client still sends defaults, what to put when the cell is empty.
 * Mapping rows that name an unknown target, a column outside the file or
 * a part on a non-location field are ignored.
 */
function build_plan(field_views, schema_fields, mapping, defaults, headers, versions) {
  const width = Array.isArray(headers) ? headers.length : Number(headers) || 0;
  const entries = field_views.map((view) => ({
    view,
    field: schema_fields.get(view.id) || null,
    system: view.system || null,
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
      if (!entry.field || entry.field.type !== "geolocation" || !GEO_PARTS.includes(row.part)) return;
      entry.parts[row.part] = column;
    } else {
      entry.column = column;
    }
    mapped_count += 1;
  });
  const default_map = defaults && typeof defaults === "object" ? defaults : {};
  entries.forEach((entry) => {
    const choice = default_map[entry.view.id];
    if (entry.system || !choice || typeof choice !== "object" || choice.mode !== "use") return;
    entry.use_default = true;
    entry.default_value = choice.value;
  });
  return { entries, mapped_count, headers: Array.isArray(headers) ? headers : [], versions: (versions || []).map(Number) };
}

const is_mapped = (entry) => entry.column !== null || GEO_PARTS.some((part) => entry.parts[part] !== null);

/** The header of the column an entry reads (a location: its first mapped part), for messages; "" when unmapped. */
function column_name(plan, entry) {
  const index = entry.column !== null ? entry.column : GEO_PARTS.map((part) => entry.parts[part]).find((value) => value !== null);
  return index === undefined || index === null ? "" : plan.headers[index] || "";
}

function default_is_blank(entry) {
  const value = entry.default_value;
  if (entry.field && entry.field.type === "geolocation") return !value || typeof value !== "object" || is_blank(value.latitude) || is_blank(value.longitude);
  return is_blank(value);
}

/** The labels of the required fields no column feeds (and no usable default): refused before the run starts. */
function required_left_empty(plan) {
  return plan.entries
    .filter((entry) => !entry.system && entry.view.required)
    .filter((entry) => (entry.use_default ? default_is_blank(entry) : !is_mapped(entry)))
    .map((entry) => entry.view.label);
}

/**
 * One row: its answers, the record fields it names (meta), every cell
 * that could not be read, and every value matched to an option by other
 * than its exact text.
 */
function build_row(plan, cells, language) {
  const data = {};
  const meta = {};
  const errors = [];
  const notes = [];
  for (const entry of plan.entries) {
    let converted;
    if (entry.system) {
      converted = convert_system(entry.view, entry.column === null ? "" : cells[entry.column], language, plan.versions);
      if (!converted.error && converted.value !== undefined) meta[entry.system] = converted.value;
    } else if (entry.field.type === "geolocation") {
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
    else if (!entry.system && converted.value !== undefined) data[entry.field.id] = converted.value;
    if (!converted.error && converted.notes) converted.notes.forEach((note) => notes.push({ field: entry.view.label, column: column_name(plan, entry), from: note.from, to: note.to }));
  }
  return { data, meta, errors, notes };
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

/** One problem as a line: the row as the spreadsheet shows it, the column, the field and the reason; a row-level problem (a duplicate) is its own sentence. */
function problem_line(problem, language) {
  if (!problem.field && !problem.column) return problem.reason;
  const vars = { row: problem.row, field: problem.field, detail: problem.reason, column: problem.column };
  return translate(problem.column ? "IMPORT_ROW_ERROR" : "IMPORT_ROW_ERROR_NO_COLUMN", language, vars);
}

/** "9", "9 and 14", "2, 5 and 9" - the rows a duplicate repeats. */
function rows_text(rows, language) {
  if (rows.length === 1) return String(rows[0]);
  return `${rows.slice(0, -1).join(", ")} ${translate("IMPORT_LIST_AND", language)} ${rows[rows.length - 1]}`;
}

/**
 * What makes two rows the same record: every MAPPED data cell after the
 * import's own normalisation (the record fields do not count; an empty
 * cell equals an empty cell).
 */
function row_signature(plan, data) {
  return JSON.stringify(plan.entries.filter((entry) => !entry.system && is_mapped(entry)).map((entry) => (data[entry.field.id] === undefined ? null : data[entry.field.id])));
}

/** The message of a run that stopped on its own: a reader's refusal or an unexpected error. */
function failure_message(error, language) {
  if (error.row_number) return problem_line({ row: error.row_number, column: error.column, field: error.field, reason: error.detail }, language);
  if (error.code && String(error.code).startsWith("IMPORT_")) return translate(error.code, language, error.vars || {});
  return translate("IMPORT_FAILED_UNEXPECTED", language, { detail: error.message });
}

const release = () => new Promise((resolve) => setImmediate(resolve));

/** A capped list with a count of everything offered to it. */
function capped_list(limit) {
  const items = [];
  let count = 0;
  return {
    items,
    add(item) {
      count += 1;
      if (items.length < limit) items.push(item);
    },
    get count() {
      return count;
    },
  };
}

async function run_import_job(session, version_doc, plan, language, user, versions) {
  const import_id = session._id;
  const form_group_id = session.form_group_id;
  const labels = new Map(plan.entries.map((entry) => [entry.view.id, entry.view.label]));
  const label_of = (field_id) => labels.get(field_id) || field_id;
  const version_docs = new Map((versions || []).map((entry) => [Number(entry.version), entry]));
  const version_for = (meta) => (meta && meta.version !== undefined ? version_docs.get(meta.version) || version_doc : version_doc);
  // A key problem is reported under the first key field's column, named
  // with every key field's label ("National ID / Plot number").
  const tracking_of = (doc) => (is_tracking_enabled(doc.tracking) ? doc.tracking : null);
  const tracking = tracking_of(version_doc);
  const key_label = tracking ? key_field_labels(version_doc.schema, tracking, language).join(" / ") : "";
  const first_key_id = tracking ? key_ids_of(tracking)[0] : null;
  const key_column = tracking ? column_name(plan, plan.entries.find((entry) => entry.view.id === first_key_id) || { column: null, parts: {} }) : "";
  const started = Date.now();
  const by = { user_id: user ? String(user.user_id) : null, name: user ? user.full_name || "" : "" };
  let wrote_any = false;
  let row_numbers = [];
  const row_of = (index) => row_numbers[index] || index + 2;
  const downloaded = [];

  const problems = capped_list(MAX_REPORTED_ERRORS);
  const report = (row, problem) => problems.add({ row, column: problem.column || "", field: problem.field || "", reason: problem.reason || "" });
  const notes = capped_list(MAX_NOTES);
  const media_failures = capped_list(MAX_MEDIA_FAILURES);
  const outcome_lists = () => ({ notes: notes.items, note_count: notes.count, media_failures: media_failures.items, media_failure_count: media_failures.count });

  const seen_rows = new Map();
  let duplicate_count = 0;
  const register_row = (built, index) => {
    const signature = row_signature(plan, built.data);
    const twins = seen_rows.get(signature);
    if (!twins) {
      seen_rows.set(signature, [row_of(index)]);
      return;
    }
    duplicate_count += 1;
    report(row_of(index), { column: "", field: "", reason: translate(twins.length === 1 ? "IMPORT_DUPLICATE_ROW" : "IMPORT_DUPLICATE_ROW_MANY", language, { row: row_of(index), rows: rows_text(twins, language) }) });
    twins.push(row_of(index));
  };

  /** The checked answers of one row (every problem reported, every near match remembered and the row's signature kept on the first pass), or null when the row has any problem. */
  const check_row = (cells, index, first_pass) => {
    const built = build_row(plan, cells, language);
    built.errors.forEach((problem) => report(row_of(index), problem));
    if (first_pass) built.notes.forEach((note) => notes.add({ row: row_of(index), column: note.column || "", field: note.field || "", from: note.from, to: note.to }));
    if (first_pass) register_row(built, index);
    const doc_version = version_for(built.meta);
    const validation = validate_submission_data(doc_version.schema, built.data, language);
    if (!validation.valid) blocking_problems(validation.field_errors, plan, label_of).forEach((problem) => report(row_of(index), problem));
    return built.errors.length === 0 && validation.valid ? { data: validation.resolved_data, meta: built.meta, doc_version } : null;
  };

  const to_document = (checked, index) => {
    const submitted_at = checked.meta.submitted_at || new Date(started + index);
    return Object.assign(
      {
        form_group_id,
        version: Number(checked.doc_version.version),
        project_id: checked.doc_version.project_id,
        submitted_at,
        updated_at: checked.meta.updated_at || null,
        data: checked.data,
        client_submission_id: null,
        respondent: null,
        approval: null,
        source: "import",
        import_id,
        imported_by: by,
      },
      tracking_fields_for_new(tracking_of(checked.doc_version), checked.data, submitted_at, null),
      checked.meta.updated_at ? { updated_at: checked.meta.updated_at } : {},
    );
  };

  /** Media links of a batch fetched (a few at once); a failed one keeps its link and is listed. */
  const fetch_media = async (batch, start) => {
    const tasks = [];
    plan.entries.forEach((entry) => {
      if (!entry.field || !MEDIA_TYPES.includes(entry.field.type)) return;
      batch.forEach((document, offset) => {
        const value = document.data[entry.field.id];
        if (value && typeof value === "object" && value.is_link && is_http_link(value.url)) tasks.push({ document, entry, link: value.url, index: start + offset });
      });
    });
    if (tasks.length === 0) return;
    await run_pool(tasks, config.import_media_parallel, async (task) => {
      const result = await download_media(task.link, task.entry.field);
      if (result.value) {
        task.document.data[task.entry.field.id] = result.value;
        downloaded.push(result.path);
        return;
      }
      media_failures.add({ row: row_of(task.index), column: column_name(plan, task.entry), field: task.entry.view.label, link: task.link, reason: translate(result.failure.key, language, result.failure.vars) });
    });
  };

  try {
    const parsed = await read_import_rows(session.file_path);
    const rows = parsed.rows;
    row_numbers = parsed.row_numbers || [];
    await imports_model.update_progress(import_id, { total_rows: rows.length, stage: "checking", checked_rows: 0 });

    const key_rows = new Map();
    for (let index = 0; index < rows.length; index += 1) {
      const checked = check_row(rows[index], index, true);
      if (checked && tracking && tracking.key_unique) {
        const key = to_document(checked, index).record_key;
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

    if (problems.count > 0) {
      problems.items.sort((a, b) => a.row - b.row);
      const first = problems.items[0];
      await imports_model.finish_import(import_id, "failed", Object.assign({
        stage: "failed",
        checked_rows: rows.length,
        created: 0,
        failed_rows: new Set(problems.items.map((problem) => problem.row)).size,
        failed_row: first.row,
        failed_field: first.field,
        failed_column: first.column,
        error: problem_line(first, language),
        errors: problems.items,
        error_count: problems.count,
        message: translate(duplicate_count > 0 && duplicate_count === problems.count ? "IMPORT_NOTHING_SAVED_DUPLICATES" : "IMPORT_NOTHING_SAVED_FIX", language),
      }, outcome_lists()));
      return;
    }

    await imports_model.update_progress(import_id, { stage: "saving", checked_rows: rows.length, done_rows: 0 });
    let created = 0;
    for (let start = 0; start < rows.length; start += BATCH_SIZE) {
      const batch = rows.slice(start, start + BATCH_SIZE).map((cells, offset) => to_document(check_row(cells, start + offset, false), start + offset));
      await fetch_media(batch, start);
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
    }, outcome_lists()));
  } catch (error) {
    if (wrote_any) await submissions_model.delete_by_import_id(form_group_id, import_id).catch(() => 0);
    await Promise.all(downloaded.map((file_path) => fs.promises.unlink(file_path).catch(() => {})));
    await imports_model.finish_import(import_id, "failed", Object.assign({
      stage: "failed",
      created: 0,
      failed_rows: 0,
      error: failure_message(error, language),
      errors: [],
      error_count: 0,
      message: translate("IMPORT_NOTHING_SAVED", language),
    }, outcome_lists()));
  } finally {
    if (session.file_path) fs.promises.unlink(session.file_path).catch(() => {});
  }
}

module.exports = { BATCH_SIZE, MAX_REPORTED_ERRORS, MAX_NOTES, MAX_MEDIA_FAILURES, build_plan, required_left_empty, build_row, failure_message, run_import_job };
