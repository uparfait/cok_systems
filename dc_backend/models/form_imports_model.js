const { get_db } = require("../db_connection/db.js");
const { to_object_id } = require("../utilities/object_id.js");

const COLLECTION_NAME = "form_imports";

/**
 * One CSV import of a form: the uploaded file (kept on disk and parsed
 * again when the run starts - the rows never sit in Mongo, a large file
 * would not fit the 16 MB document cap and nothing needs a second copy),
 * its headers, a short preview, and then the run's own progress: status
 * uploaded | running | done | failed, done_rows / total_rows, created,
 * failed_rows and the error that stopped it.
 */
async function create_import(fields) {
  const document = Object.assign(
    {
      status: "uploaded",
      stage: null,
      done_rows: 0,
      total_rows: fields.row_count || 0,
      created: 0,
      failed_rows: 0,
      error: null,
      message: null,
      created_at: new Date(),
      started_at: null,
      finished_at: null,
    },
    fields,
  );
  const result = await get_db().collection(COLLECTION_NAME).insertOne(document);
  return Object.assign({ _id: result.insertedId }, document);
}

async function find_import(form_group_id, import_id) {
  const object_id = to_object_id(import_id);
  if (!object_id) return null;
  return get_db().collection(COLLECTION_NAME).findOne({ _id: object_id, form_group_id });
}

/**
 * Claims the import for one run: only a session still "uploaded" can be
 * taken, so a second click or a second tab never runs the same file
 * twice. Returns the claimed document, or null when it was not free.
 */
async function claim_run(import_id) {
  return get_db()
    .collection(COLLECTION_NAME)
    .findOneAndUpdate(
      { _id: to_object_id(import_id), status: "uploaded" },
      { $set: { status: "running", stage: "checking", started_at: new Date(), done_rows: 0, created: 0, failed_rows: 0, error: null, message: null } },
      { returnDocument: "after" },
    );
}

async function update_progress(import_id, patch) {
  await get_db().collection(COLLECTION_NAME).updateOne({ _id: to_object_id(import_id) }, { $set: patch });
}

async function finish_import(import_id, status, patch) {
  await get_db()
    .collection(COLLECTION_NAME)
    .updateOne({ _id: to_object_id(import_id) }, { $set: Object.assign({ status, finished_at: new Date() }, patch || {}) });
}

/** A session given up before its run: marked cancelled only while it is still "uploaded". */
async function cancel_import(import_id) {
  const result = await get_db()
    .collection(COLLECTION_NAME)
    .updateOne({ _id: to_object_id(import_id), status: "uploaded" }, { $set: { status: "cancelled", finished_at: new Date() } });
  return result.modifiedCount > 0;
}

/** The files the running imports are reading right now - what a sweep of old uploads must leave alone. */
async function list_running_file_paths() {
  const documents = await get_db()
    .collection(COLLECTION_NAME)
    .find({ status: "running" }, { projection: { file_path: 1 } })
    .toArray();
  return documents.map((document) => document.file_path).filter(Boolean);
}

/** The shape the client polls - never the file path or the user record. */
function import_view(document) {
  return {
    import_id: document._id.toString(),
    status: document.status,
    stage: document.stage || null,
    file_name: document.file_name,
    sheet_name: document.sheet_name || null,
    total_rows: document.total_rows || 0,
    checked_rows: document.checked_rows || 0,
    done_rows: document.done_rows || 0,
    created: document.created || 0,
    failed_rows: document.failed_rows || 0,
    error: document.error || null,
    errors: Array.isArray(document.errors) ? document.errors : [],
    error_count: document.error_count || 0,
    notes: Array.isArray(document.notes) ? document.notes : [],
    note_count: document.note_count || 0,
    message: document.message || null,
    started_at: document.started_at || null,
    finished_at: document.finished_at || null,
  };
}

module.exports = { create_import, find_import, claim_run, update_progress, finish_import, cancel_import, list_running_file_paths, import_view };
