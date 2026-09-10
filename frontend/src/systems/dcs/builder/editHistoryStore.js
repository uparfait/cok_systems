const STORAGE_PREFIX = "dcs_edit_history_";
const STORAGE_VERSION = 1;
// Deep enough to undo a real editing session, shallow enough that a schema
// carrying long option lists still fits in a browser's storage quota.
const MAX_ENTRIES = 60;

function storage_key(scope_id) {
  return `${STORAGE_PREFIX}${scope_id}`;
}

function empty_state(scope_id, baseline) {
  return { version: STORAGE_VERSION, scope_id, baseline: baseline || [], entries: [], cursor: 0, updated_at: new Date().toISOString() };
}

/**
 * The stored session for one form, or null when there is nothing tracked
 * for it. Anything unreadable or written by an older shape is treated as
 * nothing rather than thrown at the author.
 */
export function read_history(scope_id) {
  if (!scope_id) return null;
  try {
    const raw = window.localStorage.getItem(storage_key(scope_id));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.entries)) return null;
    return parsed;
  } catch (read_error) {
    return null;
  }
}

/**
 * Persists the session, trimming the oldest entries away once more than
 * one quota-sized attempt has failed. A browser that refuses to store
 * anything at all (private mode, storage blocked) must not break editing,
 * so a final failure is simply given up on.
 */
export function write_history(scope_id, state) {
  if (!scope_id) return state;
  const next_state = Object.assign({}, state, { updated_at: new Date().toISOString() });
  try {
    window.localStorage.setItem(storage_key(scope_id), JSON.stringify(next_state));
    return next_state;
  } catch (write_error) {
    const kept = Math.max(1, Math.floor(next_state.entries.length / 2));
    const dropped = next_state.entries.length - kept;
    const trimmed = Object.assign({}, next_state, {
      entries: next_state.entries.slice(dropped),
      cursor: Math.max(0, next_state.cursor - dropped),
      // The oldest surviving entry's own "before" state is gone with the
      // entries dropped above it, so the earliest state that can still be
      // returned to becomes the baseline.
      baseline: dropped > 0 && next_state.entries[dropped - 1] ? next_state.entries[dropped - 1].fields : next_state.baseline,
    });
    try {
      window.localStorage.setItem(storage_key(scope_id), JSON.stringify(trimmed));
      return trimmed;
    } catch (retry_error) {
      return next_state;
    }
  }
}

export function clear_history(scope_id) {
  if (!scope_id) return;
  try {
    window.localStorage.removeItem(storage_key(scope_id));
  } catch (clear_error) {
    // Nothing to recover from - the session simply stays where it is.
  }
}

/**
 * Appends one tracked edit. Anything that had been undone is dropped
 * first: once a new edit is made, the branch that was undone can no longer
 * be redone into, which is what every undo stack does.
 */
export function append_entry(state, record, next_fields) {
  const kept_entries = state.entries.slice(0, state.cursor);
  const entry = {
    id: `edit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    message_key: record.message_key,
    message_vars: record.message_vars || {},
    // Which fields the edit touched, so stepping back onto it can point at
    // them in the canvas rather than leaving the author to spot what moved.
    field_ids: record.field_ids || [],
    fields: next_fields,
  };
  const entries = kept_entries.concat([entry]);
  const overflow = Math.max(0, entries.length - MAX_ENTRIES);
  return Object.assign({}, state, {
    entries: entries.slice(overflow),
    cursor: entries.length - overflow,
    baseline: overflow > 0 ? entries[overflow - 1].fields : state.baseline,
  });
}

/**
 * The fields as they stood after the first `cursor` entries - the state the
 * editor should be showing. With the cursor at zero that is the baseline:
 * the schema as it was last published.
 */
export function fields_at_cursor(state) {
  if (!state || state.cursor <= 0) return state ? state.baseline : [];
  const entry = state.entries[state.cursor - 1];
  return entry ? entry.fields : state.baseline;
}

export { empty_state, MAX_ENTRIES };
