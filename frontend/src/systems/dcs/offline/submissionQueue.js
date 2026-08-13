import { get, set } from "idb-keyval";
import { submit_response } from "../services/submissionsService.js";

const QUEUE_KEY = "dcs_submission_queue";
const RETRY_INTERVAL_MS = 10000;

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
 * Adds a filled-in response to the offline queue, always saved immediately
 * regardless of connectivity, before any network attempt is made.
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
 * Removes an item from the queue once it has been sent successfully.
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
 * Processes the queue strictly in submission order. A network error leaves
 * the item pending for the next tick. A definitive backend rejection halts
 * processing of every subsequent item so the caller can surface the error
 * and let the user fix and resubmit that specific response first.
 */
export async function process_queue_once() {
  const queue = await read_queue();
  let sent_count = 0;
  let blocked_item = null;

  for (const item of queue) {
    if (item.status !== "pending") continue;

    try {
      await submit_response(item.form_group_id, {
        version: item.version,
        data: item.data,
        client_submission_id: item.client_submission_id,
      });
      await remove_from_queue(item.id);
      sent_count += 1;
    } catch (error) {
      if (error.is_network_error) {
        await update_queue_item(item.id, { attempts: (item.attempts || 0) + 1 });
        break;
      }

      const field_errors = (error && error.field_errors) || null;
      await update_queue_item(item.id, { status: "error", field_errors });
      blocked_item = Object.assign({}, item, { field_errors });
      break;
    }
  }

  return { sent_count, blocked_item };
}

/**
 * Starts the background retry loop. Only ever attempts a sync while the
 * browser reports being online, checking every RETRY_INTERVAL_MS. Returns a
 * stop function to clear the interval on unmount.
 */
export function start_auto_sync(on_progress) {
  let is_syncing = false;

  const interval_id = window.setInterval(async () => {
    if (!window.navigator.onLine || is_syncing) return;
    is_syncing = true;
    try {
      const result = await process_queue_once();
      if (on_progress) on_progress(result);
    } catch (sync_error) {
      console.error(sync_error);
    } finally {
      is_syncing = false;
    }
  }, RETRY_INTERVAL_MS);

  return () => window.clearInterval(interval_id);
}
