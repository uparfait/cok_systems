import { get, set } from "idb-keyval";
import { submit_response } from "../services/submissionsService.js";
import { upload_file_with_progress } from "../services/uploadService.js";

const QUEUE_KEY = "dcs_submission_queue";
const RETRY_INTERVAL_MS = 60000;

/**
 * Generates a client-side idempotency key so a retried submission can never
 * be stored twice on the server.
 */
function generate_client_submission_id() {
  return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Reads the whole offline queue.
 */
async function read_queue() {
  const queue = await get(QUEUE_KEY);
  return Array.isArray(queue) ? queue : [];
}

/**
 * Persists the whole offline queue.
 */
async function write_queue(queue) {
  await set(QUEUE_KEY, queue);
}

/**
 * Adds a completed, ready-to-send response to the queue, always saved
 * immediately regardless of connectivity, before any network attempt is
 * made. This queue only ever holds responses the respondent has actually
 * submitted (or is retrying after a failed attempt) - draftStore.js is the
 * entirely separate store for a still-in-progress, not-yet-submitted
 * response, so the two can never end up mixed together.
 */
export async function enqueue_submission(form_group_id, version, data) {
  const queue = await read_queue();
  const item = {
    id: generate_client_submission_id(),
    client_submission_id: generate_client_submission_id(),
    form_group_id,
    version,
    data,
    status: "pending",
    attempts: 0,
    field_errors: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  queue.push(item);
  await write_queue(queue);
  return item;
}

/**
 * Lists every queued item, oldest first.
 */
export async function list_queue() {
  return read_queue();
}

/**
 * Removes an item from the queue once it has been sent successfully, or at
 * the respondent's own request (e.g. discarding a failed one).
 */
export async function remove_from_queue(item_id) {
  const queue = await read_queue();
  await write_queue(queue.filter((item) => item.id !== item_id));
}

/**
 * Applies a partial update to a queued item.
 */
export async function update_queue_item(item_id, patch) {
  const queue = await read_queue();
  const next_queue = queue.map((item) => (item.id === item_id ? Object.assign({}, item, patch) : item));
  await write_queue(next_queue);
}

/**
 * True for a media answer that was picked while offline (or whose upload
 * attempt failed) and is still holding its raw file locally instead of a
 * real server URL.
 */
function is_pending_upload_value(value) {
  return !!value && typeof value === "object" && value.status === "pending_upload" && value.pending_file;
}

/**
 * Uploads every still-pending file inside one queued item's data, strictly
 * one at a time - a submission can never be sent to the server while any
 * of its answers still only holds a local blob, since that blob is not
 * something the JSON payload can carry. on_file_progress, when given, fires
 * with a live percentage for whichever file is currently uploading, so the
 * UI can show real progress instead of just an indeterminate spinner while
 * a record with attachments works its way through sync. Returns the
 * item's data with every uploaded field replaced by its real URL, or
 * throws (with is_network_error set) the moment any single file fails,
 * leaving the remaining files - and the submission itself - untouched for
 * the next retry.
 */
async function upload_pending_files(item, on_file_progress) {
  const pending_entries = Object.entries(item.data || {}).filter(([, value]) => is_pending_upload_value(value));
  if (pending_entries.length === 0) return item.data;

  const next_data = Object.assign({}, item.data);
  for (const [field_id, value] of pending_entries) {
    const uploaded = await upload_file_with_progress(item.form_group_id, {
      version: item.version,
      field_id,
      file: value.pending_file,
      onProgress: (percent) => {
        if (on_file_progress) on_file_progress({ item_id: item.id, field_id, percent });
      },
    });
    next_data[field_id] = { name: uploaded.name, type: uploaded.type, size: uploaded.size, url: uploaded.url };
    await update_queue_item(item.id, { data: next_data });
  }
  return next_data;
}

/**
 * Processes the queue strictly in submission order, one item at a time -
 * proceeding to the next only once the previous one actually succeeded. A
 * network error (including one from a still-pending file upload) leaves
 * the item pending for the next tick. A definitive backend rejection halts
 * processing of every subsequent item so the caller can surface the error
 * and let the user fix and resubmit that specific response first.
 * on_item_result, when given, fires after every single item (sent or
 * rejected) - not just once at the very end - so a caller uploading
 * several records at once can refresh its own state in real time as each
 * one lands, instead of only once the whole batch finishes.
 */
export async function process_queue_once(on_item_result, on_file_progress) {
  const queue = await read_queue();
  let sent_count = 0;
  let blocked_item = null;

  for (const item of queue) {
    if (item.status !== "pending") continue;

    try {
      const uploaded_data = await upload_pending_files(item, on_file_progress);
      await submit_response(item.form_group_id, {
        version: item.version,
        data: uploaded_data,
        client_submission_id: item.client_submission_id,
      });
      await remove_from_queue(item.id);
      sent_count += 1;
      if (on_item_result) await on_item_result({ item, sent: true });
    } catch (error) {
      if (error.is_network_error) {
        await update_queue_item(item.id, { attempts: (item.attempts || 0) + 1 });
        break;
      }

      const field_errors = (error && error.field_errors) || null;
      const message = (error && error.message) || null;
      await update_queue_item(item.id, { status: "error", field_errors });
      blocked_item = Object.assign({}, item, { field_errors, message });
      if (on_item_result) await on_item_result({ item: blocked_item, sent: false });
      break;
    }
  }

  return { sent_count, blocked_item };
}

/**
 * Starts the background retry loop. Only ever attempts a sync while the
 * browser reports being online, checking every RETRY_INTERVAL_MS (and never
 * overlapping a still-running attempt). onStart fires the instant a check
 * actually begins (so the caller can show a "submitting" indicator only
 * while something is really happening, not on every idle tick), onItemResult
 * fires after each individual item, onFileProgress fires with a live
 * percentage while a pending attachment is uploading, and onComplete fires
 * once the whole attempt is done. Returns a stop function to clear the
 * interval on unmount.
 */
export function start_auto_sync({ onStart, onItemResult, onFileProgress, onComplete } = {}) {
  let is_syncing = false;

  const interval_id = window.setInterval(async () => {
    if (!window.navigator.onLine || is_syncing) return;
    is_syncing = true;
    if (onStart) onStart();
    try {
      const result = await process_queue_once(onItemResult, onFileProgress);
      if (onComplete) await onComplete(result);
    } catch (sync_error) {
      console.error(sync_error);
    } finally {
      is_syncing = false;
    }
  }, RETRY_INTERVAL_MS);

  return () => window.clearInterval(interval_id);
}
