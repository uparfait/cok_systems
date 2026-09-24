import React, { useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { useSilentPolling } from "../hooks/useSilentPolling.js";
import { useSubmissionsTable } from "../hooks/useSubmissionsTable.js";
import { useTableColumnState } from "../hooks/useTableColumnState.js";
import { get_form_versions } from "../services/formsService.js";
import { delete_selected_submissions } from "../services/submissionsService.js";
import DcsDataTable from "../components/DcsDataTable.jsx";
import DcsPeriodFilter from "../components/DcsPeriodFilter.jsx";
import DcsTableSearchSort from "../components/DcsTableSearchSort.jsx";
import DcsConfirmDialog from "../components/DcsConfirmDialog.jsx";
import { TableSkeleton } from "../components/DcsSkeletons.jsx";
import DcsRecordViewOverlay from "../components/DcsRecordViewOverlay.jsx";
import DcsFormNav from "../components/DcsFormNav.jsx";
import { ExpandFab } from "../components/DcsWorkspaceShell.jsx";
import DcsHideFieldsMenu from "../components/table/DcsHideFieldsMenu.jsx";
import DcsColumnFilterMenu from "../components/table/DcsColumnFilterMenu.jsx";
import { RecordHistorySlidesOverlay } from "../tracking/RecordHistorySlides.jsx";
import { is_tracking_enabled } from "../tracking/trackingConfig.js";
import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import { parent_filter_of } from "../util-dashboard/boardFilters.js";
import { build_diffed_columns, build_rows, FILTERABLE_TYPES } from "../components/table/allDataColumns.jsx";

const ACTIONS_COLUMN_WIDTH_PX = 108;

/**
 * Every response ever collected against a form, across every version at
 * once (no version filter at all) - columns here are the union of every
 * version's fields, coloured to show how the active version differs from
 * the ones before it (see build_diffed_columns).
 *
 * The toolbar carries only what shapes what is on screen: the date range
 * (this year to begin with), search and sort, the shared "Hide fields"
 * set, and the control that lifts the table over the page. Downloading,
 * sharing and scheduling approvals are pages of their own now, reached
 * from the form's panel beside the projects sidebar, rather than dialogs
 * laid over the very data they are about.
 *
 * Each row's own controls live in one pinned column on the left, which
 * stays put while the rest of the table scrolls sideways: tick the row,
 * look at it in full, or open it for editing on the public form. Deleting
 * belongs to the ticked set, above the table, so one confirmation covers
 * everything selected instead of one per row.
 */
export default function FormAllDataPage() {
  const { project_id, form_group_id } = useParams();
  const { language, translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
  const [search_params] = useSearchParams();

  // One record, opened on its own - the gallery following a picture back
  // to the row it came from. Clearing it puts the whole table back.
  const pinned_record_id = search_params.get("record") || "";
  const show_all_records = () => navigate(`/dcs-system/project/${project_id}/forms/${form_group_id}/data`, { replace: true });

  const columns_state = useTableColumnState(
    form_group_id,
    (error) => showError(error.message || translate("DCS_ERROR_GENERIC")),
    (message) => showSuccess(message || translate("DCS_TABLE_HIDDEN_SAVED")),
  );
  const table = useSubmissionsTable(form_group_id, undefined, columns_state.column_filters, pinned_record_id);

  const [is_confirming_delete, setIsConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [view_record, setViewRecord] = useState(null);
  const [history_record, setHistoryRecord] = useState(null);


  const { data: versions, loading: loading_versions } = useSilentPolling(
    () => get_form_versions(form_group_id).then((res) => res.data || []),
    10000,
    [form_group_id],
  );

  // The date range the column dropdowns must agree with, so a value the
  // visible range has none of is never offered as something to filter by.
  const range_key = `${table.period}|${table.from}|${table.to}`;
  const load_field_values = (field_id, parent) =>
    columns_state.load_field_values(field_id, { period: table.period, from: table.from, to: table.to }, parent);

  const built = useMemo(
    () => (versions && versions.length > 0 ? build_diffed_columns(versions, language) : null),
    [versions, language],
  );

  const active_version = versions && versions.length > 0 ? versions.find((entry) => entry.is_active) || versions[0] : null;
  const tracking = active_version && is_tracking_enabled(active_version.tracking) ? active_version.tracking : null;

  // Which column's filter each cascade child follows (a sector under its
  // district), read from the active version's own fields.
  const parent_by_field = useMemo(() => {
    const map = new Map();
    if (!active_version) return map;
    flatten_fields((active_version.schema && active_version.schema.fields) || []).forEach((field) => {
      const parent_id = parent_filter_of(field);
      if (parent_id) map.set(field.id, parent_id);
    });
    return map;
  }, [active_version]);

  const page_ids = (table.submissions || []).map((submission) => submission._id);
  const selected_set = new Set(columns_state.selected_ids);
  const selected_on_page = page_ids.filter((id) => selected_set.has(id));
  const all_on_page_selected = page_ids.length > 0 && selected_on_page.length === page_ids.length;

  const handle_delete_selected = async () => {
    setDeleting(true);
    try {
      const response = await delete_selected_submissions(columns_state.selected_ids);
      const count = (response.data && response.data.deleted_count) || columns_state.selected_ids.length;
      showSuccess(translate("DCS_TOAST_SUBMISSIONS_DELETED", { count }));
      columns_state.clear_selection();
      setIsConfirmingDelete(false);
      table.refresh();
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setDeleting(false);
    }
  };

  // Shaped like the table that is coming rather than a bare spinner, so
  // the page keeps its size while the form's versions are being read.
  if (loading_versions || !built) {
    return (
      <div className="h-full flex flex-col pb-4">
        <DcsFormNav projectId={project_id} formGroupId={form_group_id} />
        <div className="px-1 sm:px-2">
          <TableSkeleton />
        </div>
      </div>
    );
  }

  // Any record may have been edited, so the change columns are always
  // there; a row with nothing changed shows a dash instead of a button.
  const tracking_columns = [{ key: "updated_at", labelKey: "DCS_TRACKING_TABLE_UPDATED_AT" }, { key: "history", labelKey: "DCS_TRACKING_TABLE_HISTORY", minWidthPx: 96 }];

  // Everything the table COULD show, before hiding is applied - what the
  // "Hide fields" list ticks against.
  const hideable_columns = [{ key: "approval", labelKey: "DCS_TABLE_APPROVAL", minWidthPx: 210 }]
    .concat(built.columns)
    .concat(tracking_columns);

  const visible_columns = hideable_columns.filter((column) => !columns_state.hidden_set.has(column.key));

  // A choice column carries its own value filter under its header.
  const columns_with_filters = visible_columns.map((column) => {
    if (!FILTERABLE_TYPES.includes(built.field_type_by_id.get(column.key))) return column;
    const parent_id = parent_by_field.get(column.key);
    const parent_values = parent_id ? columns_state.column_filters[parent_id] || [] : [];
    return Object.assign({}, column, {
      headerNode: (
        <DcsColumnFilterMenu
          fieldId={column.key}
          selected={columns_state.column_filters[column.key]}
          onChange={(values) => columns_state.set_column_filter(column.key, values)}
          loadValues={load_field_values}
          rangeKey={range_key}
          parent={parent_id ? { field_id: parent_id, values: parent_values } : null}
        />
      ),
    });
  });

  const actions_column = {
    key: "actions",
    minWidthPx: ACTIONS_COLUMN_WIDTH_PX,
    label: "",
    headerNode: (
      <span className="flex items-center gap-1.5">
        <button
          type="button"
          role="checkbox"
          aria-checked={all_on_page_selected}
          aria-label={translate("DCS_TABLE_SELECT_ALL")}
          title={translate("DCS_TABLE_SELECT_ALL")}
          onClick={() => columns_state.toggle_page(page_ids, !all_on_page_selected)}
          className="dcs-dt-rowbtn cursor-pointer"
        >
          <span className={`dcs-dt-check-box ${all_on_page_selected ? "is-on" : ""}`} style={{ marginTop: 0, borderColor: "#FFFFFF" }}>
            {all_on_page_selected && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="4 12.5 9.5 18 20 6.5" />
              </svg>
            )}
          </span>
        </button>
        <span style={{ fontSize: 11 }}>{translate("DCS_TABLE_ACTIONS")}</span>
      </span>
    ),
  };

  const columns = [actions_column].concat(columns_with_filters);

  const rows = build_rows({
    submissions: table.submissions,
    field_type_by_id: built.field_type_by_id,
    translate,
    on_history_click: setHistoryRecord,
    selected_set,
    on_select_change: columns_state.toggle_selected,
    on_view: setViewRecord,
    // Editing opens in its own tab: the table, its filters and its scroll
    // position stay exactly where they were for when the edit is done.
    on_edit: (submission) => window.open(`/dcs-form/edit/${submission._id}`, "_blank", "noopener"),
  });

  const legend_items = built.has_diff
    ? [
        { color: "#4CAF50", labelKey: "DCS_DATA_LEGEND_ADDED" },
        { color: "#E74C3C", labelKey: "DCS_DATA_LEGEND_REMOVED" },
      ]
    : null;

  const view_record_fields = view_record
    ? ((versions.find((entry) => entry.version === view_record.version) || active_version).schema || {}).fields || []
    : [];

  const table_block = (
    <>
      {/* Mobile first: the toolbar wraps onto as many rows as it needs
          rather than scrolling sideways, so nothing in it can end up out
          of reach on a phone. */}
      <div className="dcs-ws-center flex-shrink-0 mb-3 px-1 sm:px-2 flex flex-wrap items-center gap-2">
        <DcsHideFieldsMenu
          columns={hideable_columns}
          hidden={columns_state.hidden_columns}
          canEdit={columns_state.can_edit_columns}
          saving={columns_state.saving_columns}
          onChange={columns_state.change_hidden_columns}
        />

        <DcsPeriodFilter period={table.period} onPeriodChange={table.setPeriod} from={table.from} onFromChange={table.setFrom} to={table.to} onToChange={table.setTo} onApply={table.handle_apply} includeAll />
        <DcsTableSearchSort search={table.search} onSearchChange={table.setSearch} onSearchSubmit={table.handle_apply} sort={table.sort} onSortChange={table.setSort} />

        {Object.keys(columns_state.column_filters).length > 0 && (
          <button type="button" onClick={columns_state.clear_column_filters} className="dcs-dt-tool is-active cursor-pointer">
            {translate("DCS_TABLE_COLUMN_FILTER_ALL")}
          </button>
        )}


      </div>

      {/* The table is down to one record because somebody followed a
          picture back to it. Said plainly, with the way back to the
          whole table beside it - a row count that dropped to one with
          nothing explaining why reads as data having gone missing. */}
      {pinned_record_id && (
        <div className="dcs-ws-center dcs-dt-selbar flex-shrink-0 mb-2">
          <span className="text-xs font-bold" style={{ color: "#056daa" }}>
            {translate("DCS_TABLE_SHOWING_ONE")}
          </span>
          <span className="flex-1" />
          <button type="button" onClick={show_all_records} className="dcs-dt-tool is-active cursor-pointer" style={{ height: 30 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="11 17 6 12 11 7" />
              <line x1="6" y1="12" x2="19" y2="12" />
            </svg>
            {translate("DCS_TABLE_SHOW_ALL_DATA")}
          </button>
        </div>
      )}

      {/* The selection bar only exists while something is actually ticked -
          it is where deleting lives now, in place of a delete icon on
          every single row. */}
      {columns_state.selected_ids.length > 0 && (
        <div className="dcs-ws-center dcs-dt-selbar flex-shrink-0 mb-2">
          <span className="text-xs font-bold" style={{ color: "#056daa" }}>
            {translate("DCS_TABLE_SELECTED_COUNT", { count: columns_state.selected_ids.length })}
          </span>
          <button type="button" onClick={columns_state.clear_selection} className="dcs-dt-tool cursor-pointer" style={{ height: 30 }}>
            {translate("DCS_TABLE_CLEAR_SELECTION")}
          </button>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => setIsConfirmingDelete(true)}
            className="dcs-dt-tool cursor-pointer"
            style={{ height: 30, borderColor: "#E74C3C", color: "#E74C3C" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E74C3C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
            {translate("DCS_TABLE_DELETE_SELECTED")}
          </button>
        </div>
      )}

      <div className="dcs-ws-center flex-1 min-h-0 flex flex-col">
        <DcsDataTable
          columns={columns}
          rows={rows}
          page={table.page}
          totalPages={table.total_pages}
          onPageChange={table.handle_page_change}
          loading={table.loading}
          scrollResetKey={table.page}
          columnTints={Object.fromEntries(columns.filter((column) => column.tint).map((column) => [column.key, column.tint]))}
          legendItems={legend_items}
          totalCount={table.total}
          pinnedColumnKey="actions"
          onRowClick={(row) => setViewRecord((table.submissions || []).find((submission) => submission._id === row.dcs_row_key) || null)}
        />
      </div>
    </>
  );

  return (
    // Expanding only adds a class here. Putting the table into a
    // DIFFERENT wrapper would be a new position in the tree to React,
    // which unmounts it and mounts it again - the page refetched, the
    // selection and the scroll position gone.
    <div className={`h-full flex flex-col pb-4 ${columns_state.is_expanded ? "dcs-dt-expanded" : ""}`}>
      <DcsFormNav projectId={project_id} formGroupId={form_group_id} formName={active_version ? active_version.form_name : ""} />

      {table_block}

      <ExpandFab expanded={columns_state.is_expanded} onToggle={() => columns_state.setIsExpanded(!columns_state.is_expanded)} />

      {is_confirming_delete && (
        <DcsConfirmDialog
          titleKey="DCS_TABLE_DELETE_SELECTED_TITLE"
          messageKey="DCS_TABLE_DELETE_SELECTED_WARNING"
          confirming={deleting}
          onConfirm={handle_delete_selected}
          onCancel={() => setIsConfirmingDelete(false)}
        />
      )}


      {view_record && (
        <DcsRecordViewOverlay
          record={view_record}
          fields={view_record_fields}
          tracking={tracking}
          onClose={() => setViewRecord(null)}
          onEdit={() => window.open(`/dcs-form/edit/${view_record._id}`, "_blank", "noopener")}
        />
      )}

      {history_record && (
        <RecordHistorySlidesOverlay
          record={history_record}
          fields={((versions.find((entry) => entry.version === history_record.version) || active_version).schema || {}).fields || []}
          tracking={tracking}
          onClose={() => setHistoryRecord(null)}
        />
      )}
    </div>
  );
}
