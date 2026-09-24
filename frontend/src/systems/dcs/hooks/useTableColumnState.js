import { useCallback, useEffect, useRef, useState } from "react";
import { get_table_settings, save_table_settings } from "../services/formsService.js";
import { get_field_values } from "../services/submissionsService.js";

/**
 * Everything the data table's own chrome needs that is not a row: which
 * columns are hidden, which values each choice column is filtering by,
 * which rows are ticked, and whether the table is expanded over the page.
 *
 * Hidden columns are shared, not personal: they are read from and written
 * back to the form, so a column somebody ticks off disappears for
 * everybody who opens the table until it is ticked back on. The set is
 * applied locally the moment it is changed and only then saved, so the
 * table never waits on a round trip to redraw; a save that fails puts the
 * server's own answer back.
 */
export function useTableColumnState(form_group_id, on_error, on_success) {
  const [hidden_columns, setHiddenColumns] = useState([]);
  const [can_edit_columns, setCanEditColumns] = useState(false);
  const [saving_columns, setSavingColumns] = useState(false);
  const [column_filters, setColumnFilters] = useState({});
  const [selected_ids, setSelectedIds] = useState([]);
  const [is_expanded, setIsExpanded] = useState(false);
  const error_ref = useRef(on_error);
  error_ref.current = on_error;
  const success_ref = useRef(on_success);
  success_ref.current = on_success;

  useEffect(() => {
    let is_mounted = true;
    setHiddenColumns([]);
    setColumnFilters({});
    setSelectedIds([]);
    get_table_settings(form_group_id)
      .then((response) => {
        if (!is_mounted) return;
        const data = response.data || {};
        setHiddenColumns(data.hidden_columns || []);
        setCanEditColumns(data.can_edit === true);
      })
      .catch(() => is_mounted && setCanEditColumns(false));
    return () => {
      is_mounted = false;
    };
  }, [form_group_id]);

  const change_hidden_columns = useCallback(
    (next) => {
      const previous = hidden_columns;
      setHiddenColumns(next);
      setSavingColumns(true);
      save_table_settings(form_group_id, next)
        .then((response) => {
          // The server's own list is the truth once it answers; its message
          // tells everyone the shared setting is saved for the whole form.
          if (response && response.data && Array.isArray(response.data.hidden_columns)) setHiddenColumns(response.data.hidden_columns);
          if (success_ref.current) success_ref.current(response && response.message);
        })
        .catch((error) => {
          setHiddenColumns(previous);
          if (error_ref.current) error_ref.current(error);
        })
        .finally(() => setSavingColumns(false));
    },
    [form_group_id, hidden_columns],
  );

  /** One column's picked values; an empty list drops the column's filter entirely. */
  const set_column_filter = useCallback((field_id, values) => {
    setColumnFilters((current) => {
      const next = Object.assign({}, current);
      if (!values || values.length === 0) delete next[field_id];
      else next[field_id] = values;
      return next;
    });
  }, []);

  const clear_column_filters = useCallback(() => setColumnFilters({}), []);

  const toggle_selected = useCallback((submission_id, should_select) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (should_select) next.add(submission_id);
      else next.delete(submission_id);
      return Array.from(next);
    });
  }, []);

  /** The page's own "tick everything": adds every visible row, or removes exactly those. */
  const toggle_page = useCallback((page_ids, should_select) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      page_ids.forEach((id) => (should_select ? next.add(id) : next.delete(id)));
      return Array.from(next);
    });
  }, []);

  const clear_selection = useCallback(() => setSelectedIds([]), []);

  const load_field_values = useCallback(
    (field_id, period_options) => get_field_values(form_group_id, field_id, period_options).then((response) => (response.data && response.data.values) || []),
    [form_group_id],
  );

  return {
    hidden_columns,
    hidden_set: new Set(hidden_columns),
    can_edit_columns,
    saving_columns,
    change_hidden_columns,
    column_filters,
    set_column_filter,
    clear_column_filters,
    selected_ids,
    toggle_selected,
    toggle_page,
    clear_selection,
    is_expanded,
    setIsExpanded,
    load_field_values,
  };
}
