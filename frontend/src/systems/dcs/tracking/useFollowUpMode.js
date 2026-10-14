import { useCallback, useEffect, useRef, useState } from "react";
import { get_form_draft } from "../offline/draftStore.js";

export const FOLLOW_UP_DRAFT_MODE = "follow_up";
export const NEW_RECORD_DRAFT_MODE = "new_record";

function storage_key(form_group_id) {
  return `dcs_follow_up_${form_group_id}`;
}

function read_stored_mode(form_group_id) {
  try {
    const raw = window.sessionStorage.getItem(storage_key(form_group_id));
    if (raw === "on") return true;
    if (raw === "off") return false;
    return null;
  } catch (storage_error) {
    return null;
  }
}

function write_stored_mode(form_group_id, enabled) {
  try {
    window.sessionStorage.setItem(storage_key(form_group_id), enabled ? "on" : "off");
  } catch (storage_error) {
    return;
  }
}

export function draft_mode_of(tracked, enabled) {
  if (!tracked) return undefined;
  return enabled ? FOLLOW_UP_DRAFT_MODE : NEW_RECORD_DRAFT_MODE;
}

export function useFollowUpMode({ form, form_group_id, tracked, values, applyValues }) {
  const [enabled, setEnabled] = useState(false);
  const [resolved, setResolved] = useState(false);
  const other_values_ref = useRef({});

  useEffect(() => {
    if (!form) return undefined;
    if (!tracked) {
      setResolved(true);
      return undefined;
    }
    const stored = read_stored_mode(form_group_id);
    if (stored !== null) {
      setEnabled(stored);
      setResolved(true);
      return undefined;
    }
    let alive = true;
    get_form_draft(form_group_id, FOLLOW_UP_DRAFT_MODE)
      .then((draft) => {
        if (!alive) return;
        setEnabled(!!draft);
        setResolved(true);
      })
      .catch(() => {
        if (alive) setResolved(true);
      });
    return () => {
      alive = false;
    };
  }, [form, form_group_id, tracked]);

  const set_mode = useCallback(
    (next) => {
      const wanted = !!next;
      if (wanted === enabled) return;
      const incoming = other_values_ref.current;
      other_values_ref.current = values || {};
      write_stored_mode(form_group_id, wanted);
      setEnabled(wanted);
      applyValues(incoming);
    },
    [enabled, values, applyValues, form_group_id],
  );

  const active = tracked && enabled;
  return { enabled: active, resolved, set_mode, draft_mode: draft_mode_of(tracked, active) };
}
