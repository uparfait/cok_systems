import React, { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { useToast } from "../../../../core/contexts/ToastContext.tsx";
import { useSubmissionsTable } from "../../hooks/useSubmissionsTable.js";
import { get_follow_up_submissions, delete_selected_follow_up_submissions } from "../../services/followUpService.js";
import DcsDataTable from "../DcsDataTable.jsx";
import DcsPeriodFilter from "../DcsPeriodFilter.jsx";
import DcsTableSearchSort from "../DcsTableSearchSort.jsx";
import DcsConfirmDialog from "../DcsConfirmDialog.jsx";
import DcsRecordViewOverlay from "../DcsRecordViewOverlay.jsx";
import DcsHideFieldsMenu from "../table/DcsHideFieldsMenu.jsx";
import { SelectBox } from "../table/DcsRowActionsCell.jsx";
import { build_diffed_columns, build_rows } from "../table/allDataColumns.jsx";

const ACTIONS_COLUMN_WIDTH_PX = 108;
const PRIMARY = "#056daa";
const DANGER = "#E74C3C";

const edit_url = (submission_id) => `/dcs-form/follow-up/edit/${submission_id}`;

export default function FollowUpTable({ projectId, formGroupId, versions, canEdit, onChanged }) {
  const { language, translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
  const [search_params] = useSearchParams();

  const pinned_record_id = search_params.get("record") || "";
  const show_all_records = () => navigate(`/dcs-system/project/${projectId}/forms/${formGroupId}/follow-up?tab=table`, { replace: true });

  const fetcher = useCallback((form_group_id, version, page, limit, params) => get_follow_up_submissions(form_group_id, page, limit, params), []);
  const table = useSubmissionsTable(formGroupId, undefined, null, pinned_record_id, fetcher);

  const [hidden_columns, setHiddenColumns] = useState([]);
  const [selected_ids, setSelectedIds] = useState([]);
  const [is_confirming_delete, setIsConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [view_record, setViewRecord] = useState(null);

  const built = useMemo(() => build_diffed_columns(versions || [], language), [versions, language]);
  const active_version = (versions || []).find((entry) => entry.is_active) || (versions || [])[0] || null;

  const page_ids = (table.submissions || []).map((submission) => submission._id);
  const selected_set = new Set(selected_ids);
  const all_on_page_selected = page_ids.length > 0 && page_ids.every((id) => selected_set.has(id));

  const toggle_selected = (submission_id, should_select) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (should_select) next.add(submission_id);
      else next.delete(submission_id);
      return Array.from(next);
    });
  const toggle_page = (should_select) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      page_ids.forEach((id) => (should_select ? next.add(id) : next.delete(id)));
      return Array.from(next);
    });

  const handle_delete_selected = async () => {
    setDeleting(true);
    try {
      const response = await delete_selected_follow_up_submissions(formGroupId, selected_ids);
      const count = (response.data && response.data.deleted_count) || selected_ids.length;
      showSuccess(translate("DCS_TOAST_SUBMISSIONS_DELETED", { count }));
      setSelectedIds([]);
      setIsConfirmingDelete(false);
      table.refresh();
      if (onChanged) onChanged();
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setDeleting(false);
    }
  };

  const hideable_columns = built.columns.concat([{ key: "updated_at", labelKey: "DCS_TRACKING_TABLE_UPDATED_AT" }]);
  const hidden_set = new Set(hidden_columns);
  const visible_columns = hideable_columns.filter((column) => !hidden_set.has(column.key));

  const actions_column = {
    key: "actions",
    minWidthPx: ACTIONS_COLUMN_WIDTH_PX,
    label: "",
    headerNode: (
      <span className="flex items-center gap-1.5">
        <SelectBox checked={all_on_page_selected} onChange={toggle_page} label={translate("DCS_TABLE_SELECT_ALL")} />
        <span style={{ fontSize: 11 }}>{translate("DCS_TABLE_ACTIONS")}</span>
      </span>
    ),
  };
  const columns = [actions_column].concat(visible_columns);

  const rows = build_rows({
    submissions: table.submissions,
    field_type_by_id: built.field_type_by_id,
    translate,
    on_history_click: null,
    selected_set,
    on_select_change: toggle_selected,
    on_view: setViewRecord,
    on_edit: (submission) => window.open(edit_url(submission._id), "_blank", "noopener"),
  });

  const legend_items = built.has_diff
    ? [
        { color: "#4CAF50", labelKey: "DCS_DATA_LEGEND_ADDED" },
        { color: DANGER, labelKey: "DCS_DATA_LEGEND_REMOVED" },
      ]
    : null;

  const fields_of = (record) => (((versions || []).find((entry) => entry.version === record.version) || active_version || {}).schema || {}).fields || [];

  return (
    <>
      <div className="dcs-ws-center flex-shrink-0 mb-3 px-1 sm:px-2 flex flex-wrap items-center gap-2">
        <DcsHideFieldsMenu columns={hideable_columns} hidden={hidden_columns} canEdit saving={false} onChange={setHiddenColumns} />
        <DcsPeriodFilter period={table.period} onPeriodChange={table.setPeriod} from={table.from} onFromChange={table.setFrom} to={table.to} onToChange={table.setTo} onApply={table.handle_apply} includeAll />
        <DcsTableSearchSort search={table.search} onSearchChange={table.setSearch} onSearchSubmit={table.handle_apply} sort={table.sort} onSortChange={table.setSort} />
      </div>

      {pinned_record_id && (
        <div className="dcs-ws-center dcs-dt-selbar flex-shrink-0 mb-2">
          <span className="text-xs font-bold" style={{ color: PRIMARY }}>
            {translate("DCS_TABLE_SHOWING_ONE")}
          </span>
          <span className="flex-1" />
          <button type="button" onClick={show_all_records} className="dcs-dt-tool is-active cursor-pointer" style={{ height: 30 }}>
            {translate("DCS_TABLE_SHOW_ALL_DATA")}
          </button>
        </div>
      )}

      {selected_ids.length > 0 && (
        <div className="dcs-ws-center dcs-dt-selbar flex-shrink-0 mb-2">
          <span className="text-xs font-bold" style={{ color: PRIMARY }}>
            {translate("DCS_TABLE_SELECTED_COUNT", { count: selected_ids.length })}
          </span>
          <button type="button" onClick={() => setSelectedIds([])} className="dcs-dt-tool cursor-pointer" style={{ height: 30 }}>
            {translate("DCS_TABLE_CLEAR_SELECTION")}
          </button>
          <span className="flex-1" />
          {canEdit && (
            <button type="button" onClick={() => setIsConfirmingDelete(true)} className="dcs-dt-tool cursor-pointer" style={{ height: 30, borderColor: DANGER, color: DANGER }}>
              {translate("DCS_TABLE_DELETE_SELECTED")}
            </button>
          )}
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
          onRowClick={(row) => setViewRecord((table.submissions || []).find((submission) => submission._id === row.dcs_record_id) || null)}
        />
      </div>

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
          fields={fields_of(view_record)}
          tracking={null}
          noApproval
          onClose={() => setViewRecord(null)}
          onEdit={() => window.open(edit_url(view_record._id), "_blank", "noopener")}
        />
      )}
    </>
  );
}
