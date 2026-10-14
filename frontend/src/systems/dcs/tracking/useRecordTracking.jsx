import React, { useCallback, useMemo, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { is_tracking_enabled, key_ids_of, field_state, has_editable_changes, field_name, SEARCHABLE_INPUT_TYPES } from "./trackingConfig.js";
import { KeyFieldWrap, disable_field } from "./RecordFieldWrap.jsx";

const is_empty = (value) => value === undefined || value === null || String(value).trim() === "";

export function useRecordTracking({ form, values, applyValues, clearValues, active }) {
  const { language } = useDcsLanguage();
  const tracking = form && form.tracking;
  const tracked = is_tracking_enabled(tracking);
  const enabled = tracked && active !== false;
  const key_field_ids = useMemo(() => (tracked ? key_ids_of(tracking) : []), [tracked, tracking]);
  const [stored_record, setStoredRecord] = useState(null);
  const [lookup, setLookup] = useState(null);
  const loaded_record = enabled ? stored_record : null;

  const has_changes = useMemo(
    () => (loaded_record ? has_editable_changes(tracking, loaded_record.data, values) : false),
    [loaded_record, values, tracking],
  );

  const open_lookup = useCallback(
    (field_id, value) => {
      const id = field_id && key_field_ids.includes(field_id) ? field_id : "";
      const typed = value !== undefined ? value : id && values ? values[id] : "";
      setLookup({ field_id: id, initial_key: typed === undefined || typed === null ? "" : String(typed) });
    },
    [values, key_field_ids],
  );

  const close_lookup = useCallback(() => setLookup(null), []);

  const load_record = useCallback(
    (record) => {
      setStoredRecord(record);
      applyValues(record.data || {});
    },
    [applyValues],
  );

  const clear_record = useCallback(() => {
    setStoredRecord(null);
    clearValues();
  }, [clearValues]);

  const record_updated = useCallback(
    (record) => {
      setStoredRecord(record);
      if (record && record.data) applyValues(record.data);
    },
    [applyValues],
  );

  const wrap_field = useCallback(
    (element, field) => {
      const state = field_state(field, tracking, !!loaded_record);
      if (state === "layout" || state === "enabled") return element;
      if (state === "key") {
        if (SEARCHABLE_INPUT_TYPES.includes(field.type) || field.type === "hidden") return element;
        return (
          <KeyFieldWrap onSearch={() => open_lookup(field.id)} disabled={is_empty(values ? values[field.id] : undefined)} fieldName={field_name(field, language)}>
            {element}
          </KeyFieldWrap>
        );
      }
      return disable_field(element);
    },
    [tracking, loaded_record, open_lookup, values, language],
  );

  const searchable = useMemo(
    () => (enabled && !loaded_record ? { ids: key_field_ids, onSearch: (field, value) => open_lookup(field.id, value) } : undefined),
    [enabled, loaded_record, key_field_ids, open_lookup],
  );

  return {
    tracked,
    enabled,
    key_field_ids,
    tracking: tracked ? tracking : null,
    loaded_record,
    has_changes,
    lookup: enabled ? lookup : null,
    open_lookup,
    close_lookup,
    load_record,
    clear_record,
    record_updated,
    wrap_field: enabled ? wrap_field : undefined,
    searchable,
    history_count: loaded_record ? Math.max(0, (loaded_record.history || []).length - 1) : 0,
  };
}
