import React, { useCallback, useMemo, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { is_tracking_enabled, locked_field_ids, field_name } from "./trackingConfig.js";
import { KeyFieldWrap, LockedFieldWrap } from "./RecordFieldWrap.jsx";

/**
 * The public page's side of record tracking. On a tracked form:
 * - the key field gets a search button; searching opens the record finder
 *   with the typed key;
 * - loading a found record fills the form with its answers and locks
 *   every field the author did not mark as updatable (the key included);
 * - submitting then UPDATES that record instead of creating a new one
 *   (see usePublicSubmit), and clearing puts the form back to a blank new
 *   record.
 *
 * applyValues(data) is the page's own way of putting answers into the
 * form; clearValues() empties it.
 */
export function useRecordTracking({ form, values, applyValues, clearValues }) {
  const { language } = useDcsLanguage();
  const tracking = form && form.tracking;
  const enabled = is_tracking_enabled(tracking);
  const fields = (form && form.schema && form.schema.fields) || [];
  const [loaded_record, setLoadedRecord] = useState(null);
  const [lookup, setLookup] = useState(null);

  const locked = useMemo(() => (enabled && loaded_record ? locked_field_ids(tracking, fields) : new Set()), [enabled, loaded_record, tracking, fields]);

  const open_lookup = useCallback(
    (initial_key) => {
      const typed = initial_key !== undefined ? initial_key : values && tracking ? values[tracking.key_field_id] : "";
      setLookup({ initial_key: typed === undefined || typed === null ? "" : String(typed) });
    },
    [values, tracking],
  );

  const close_lookup = useCallback(() => setLookup(null), []);

  const load_record = useCallback(
    (record) => {
      setLoadedRecord(record);
      applyValues(record.data || {});
    },
    [applyValues],
  );

  const clear_record = useCallback(() => {
    setLoadedRecord(null);
    clearValues();
  }, [clearValues]);

  /** After a successful update: the fresh record stays loaded so its new history shows. */
  const record_updated = useCallback((record) => {
    setLoadedRecord(record);
    if (record && record.data) applyValues(record.data);
  }, [applyValues]);

  const wrap_field = useCallback(
    (element, field) => {
      if (!enabled) return element;
      if (field.id === tracking.key_field_id) {
        return loaded_record ? (
          <LockedFieldWrap>{element}</LockedFieldWrap>
        ) : (
          <KeyFieldWrap onSearch={() => open_lookup()} fieldName={field_name(field, language)}>{element}</KeyFieldWrap>
        );
      }
      if (loaded_record && locked.has(field.id)) return <LockedFieldWrap>{element}</LockedFieldWrap>;
      return element;
    },
    [enabled, tracking, loaded_record, locked, open_lookup, language],
  );

  return {
    enabled,
    tracking: enabled ? tracking : null,
    loaded_record,
    lookup,
    open_lookup,
    close_lookup,
    load_record,
    clear_record,
    record_updated,
    wrap_field: enabled ? wrap_field : undefined,
    history_count: loaded_record ? Math.max(0, (loaded_record.history || []).length - 1) : 0,
  };
}
