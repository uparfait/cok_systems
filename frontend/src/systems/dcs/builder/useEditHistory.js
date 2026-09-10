import { useCallback, useEffect, useRef, useState } from "react";
import { describe_fields_change, track_message_text } from "./editDiffMessage.js";
import {
  append_entry,
  clear_history,
  empty_state,
  fields_at_cursor,
  read_history,
  write_history,
} from "./editHistoryStore.js";

const EDITABLE_TAGS = ["INPUT", "TEXTAREA", "SELECT"];

/**
 * True while the keystroke belongs to whatever the author is typing in.
 * The browser's own undo inside a text box is the right behavior there;
 * taking it over would make Ctrl+Z revert a whole field edit instead of
 * the last few characters typed.
 */
function is_typing_target(target) {
  if (!target) return false;
  return EDITABLE_TAGS.includes(target.tagName) || target.isContentEditable === true;
}

/**
 * Edit tracking for the form builder: every change to the fields is
 * recorded in this browser, chronologically, with a message saying what it
 * was, and can be stepped back and forward through - from the keyboard
 * (Ctrl+Z / Ctrl+Shift+Z or Ctrl+Y) or from the history panel.
 *
 * The record survives a reload, so edits that were never published come
 * back on the next visit. They are NOT applied on their own: restored is
 * handed back for the author to apply or delete deliberately, because
 * silently reviving edits over a schema that may have been republished
 * elsewhere is not a decision this hook gets to make. A successful publish
 * clears everything, since the edits have become the form itself.
 *
 * scopeId being empty turns tracking off entirely (used where a builder is
 * not editing a persistent form).
 */
export function useEditHistory({ scopeId, fields, onFieldsChange, translate, language, onToast, onHighlight }) {
  const [state, setState] = useState(() => empty_state(scopeId, fields));
  const [restored, setRestored] = useState(null);
  // "Decide later" only hides the question, it never answers it: restored
  // stays set, so the form stays locked until the author actually chooses.
  const [is_restored_deferred, setIsRestoredDeferred] = useState(false);
  const fields_ref = useRef(fields);
  const state_ref = useRef(state);
  const is_applying_ref = useRef(false);

  fields_ref.current = fields;
  state_ref.current = state;

  // Read once per form. A stored session whose cursor sits past the
  // baseline is an unpublished edit the author left behind; one sitting AT
  // the baseline has nothing to offer and is just adopted silently so its
  // redo branch stays available.
  useEffect(() => {
    if (!scopeId) return;
    const stored = read_history(scopeId);
    if (!stored) {
      setState(empty_state(scopeId, fields_ref.current));
      setRestored(null);
      return;
    }
    setState(stored);
    setRestored(stored.cursor > 0 ? { count: stored.cursor, updated_at: stored.updated_at } : null);
    setIsRestoredDeferred(false);
    // fields_ref is deliberately read rather than depended on: this must
    // run when the form changes, not on every keystroke that edits it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId]);

  const defer_restored = useCallback(() => setIsRestoredDeferred(true), []);
  const resume_restored = useCallback(() => setIsRestoredDeferred(false), []);

  const commit = useCallback(
    (next_state) => {
      const written = write_history(scopeId, next_state);
      setState(written);
    },
    [scopeId],
  );

  /**
   * Records one mutation. Returns the fields unchanged so callers can wrap
   * their existing change handler around it.
   */
  const track = useCallback(
    (next_fields) => {
      if (!scopeId || is_applying_ref.current) return;
      const previous_fields = fields_ref.current || [];
      if (JSON.stringify(previous_fields) === JSON.stringify(next_fields)) return;
      const record = describe_fields_change(previous_fields, next_fields);
      commit(append_entry(state_ref.current, record, next_fields));
    },
    [scopeId, commit],
  );

  const step = useCallback(
    (direction) => {
      const current = state_ref.current;
      if (!scopeId) return;
      // While a restored session is still waiting on the author, the
      // cursor describes edits the editor is not showing yet - stepping
      // through it would move the editor to a state nothing on screen
      // accounts for. The banner has to be answered first.
      if (restored) {
        if (onToast) onToast(translate("DCS_TRACK_TOAST_RESOLVE_RESTORED"), "info");
        return;
      }

      if (direction === -1) {
        if (current.cursor <= 0) {
          if (onToast) onToast(translate("DCS_TRACK_TOAST_NOTHING_UNDO"), "info");
          return;
        }
        const undone_entry = current.entries[current.cursor - 1];
        const next_state = Object.assign({}, current, { cursor: current.cursor - 1 });
        is_applying_ref.current = true;
        onFieldsChange(fields_at_cursor(next_state));
        is_applying_ref.current = false;
        if (onHighlight) onHighlight(undone_entry.field_ids);
        commit(next_state);
        if (onToast) {
          onToast(
            translate("DCS_TRACK_TOAST_UNDONE", { action: track_message_text(undone_entry, translate, language) }),
            "info",
          );
        }
        return;
      }

      if (current.cursor >= current.entries.length) {
        if (onToast) onToast(translate("DCS_TRACK_TOAST_NOTHING_REDO"), "info");
        return;
      }
      const redone_entry = current.entries[current.cursor];
      const next_state = Object.assign({}, current, { cursor: current.cursor + 1 });
      is_applying_ref.current = true;
      onFieldsChange(fields_at_cursor(next_state));
      is_applying_ref.current = false;
      if (onHighlight) onHighlight(redone_entry.field_ids);
      commit(next_state);
      if (onToast) {
        onToast(
          translate("DCS_TRACK_TOAST_REDONE", { action: track_message_text(redone_entry, translate, language) }),
          "info",
        );
      }
    },
    [scopeId, commit, onFieldsChange, onToast, translate, language, restored, onHighlight],
  );

  const undo = useCallback(() => step(-1), [step]);
  const redo = useCallback(() => step(1), [step]);

  useEffect(() => {
    if (!scopeId) return undefined;
    const handle_keydown = (event) => {
      if (!(event.ctrlKey || event.metaKey) || is_typing_target(event.target)) return;
      const key = String(event.key).toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handle_keydown);
    return () => window.removeEventListener("keydown", handle_keydown);
  }, [scopeId, undo, redo]);

  /** Puts the restored session's edits back into the editor, unpublished. */
  const apply_restored = useCallback(() => {
    const current = state_ref.current;
    is_applying_ref.current = true;
    onFieldsChange(fields_at_cursor(current));
    is_applying_ref.current = false;
    setRestored(null);
    setIsRestoredDeferred(false);
    if (onHighlight) onHighlight((state_ref.current.entries[state_ref.current.cursor - 1] || {}).field_ids);
    if (onToast) onToast(translate("DCS_TRACK_TOAST_APPLIED"), "success");
  }, [onFieldsChange, onToast, translate]);

  /** Throws the restored session away, leaving the published schema alone. */
  const discard_restored = useCallback(() => {
    clear_history(scopeId);
    setState(empty_state(scopeId, fields_ref.current));
    setRestored(null);
    setIsRestoredDeferred(false);
    if (onToast) onToast(translate("DCS_TRACK_TOAST_DISCARDED"), "success");
  }, [scopeId, onToast, translate]);

  /** Forgets the tracked edits without touching what is in the editor. */
  const clear = useCallback(
    (options) => {
      clear_history(scopeId);
      setState(empty_state(scopeId, fields_ref.current));
      setRestored(null);
      setIsRestoredDeferred(false);
      if (onToast && options && options.notify) onToast(translate("DCS_TRACK_TOAST_CLEARED"), "success");
    },
    [scopeId, onToast, translate],
  );

  return {
    is_tracking: !!scopeId,
    is_locked: !!restored,
    is_restored_deferred,
    defer_restored,
    resume_restored,
    entries: state.entries,
    cursor: state.cursor,
    can_undo: state.cursor > 0 && !restored,
    can_redo: state.cursor < state.entries.length && !restored,
    restored,
    track,
    undo,
    redo,
    apply_restored,
    discard_restored,
    clear,
  };
}
