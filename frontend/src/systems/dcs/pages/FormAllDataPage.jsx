import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { dcs_translate } from "../i18n/index.js";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { useSilentPolling } from "../hooks/useSilentPolling.js";
import { useSubmissionsTable } from "../hooks/useSubmissionsTable.js";
import { get_form_versions } from "../services/formsService.js";
import { delete_submission } from "../services/submissionsService.js";
import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import { get_field_text } from "../fields/fieldText.js";
import DcsDataTable from "../components/DcsDataTable.jsx";
import DcsDataTableFileCell from "../components/DcsDataTableFileCell.jsx";
import DcsDataTableGeoCell, { GEO_CELL_TABLE_MIN_WIDTH_PX } from "../components/DcsDataTableGeoCell.jsx";
import DcsPeriodFilter from "../components/DcsPeriodFilter.jsx";
import DcsTableSearchSort from "../components/DcsTableSearchSort.jsx";
import DcsLoadingState from "../components/DcsLoadingState.jsx";
import DcsConfirmDialog from "../components/DcsConfirmDialog.jsx";
import DcsExportDialog from "../components/DcsExportDialog.jsx";

const ACTIONS_COLUMN_WIDTH_PX = 56;

/**
 * Icon-only delete trigger for one row - a text button would be the odd
 * one out among plain data cells, and every row already reads its own
 * record's meaning from the columns beside it, so the icon alone (with an
 * aria-label for anyone not just visually scanning it) is enough.
 */
function DeleteSubmissionButton({ onClick, disabled }) {
  const { translate } = useDcsLanguage();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={translate("DCS_BTN_DELETE")}
      title={translate("DCS_BTN_DELETE")}
      className="cursor-pointer flex items-center justify-center"
      style={{ width: 28, height: 28, opacity: disabled ? 0.4 : 1 }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#E74C3C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      </svg>
    </button>
  );
}

const NON_DATA_TYPES = ["section", "paragraph", "header", "file", "group", "image_block", "horizontal_line"];
const MEDIA_ANSWER_TYPES = ["image", "video", "audio", "file_upload", "signature"];

/**
 * Every version's own data fields, deduped by field id - the first version
 * encountered "owns" a field's definition (label/type), since only its
 * presence across versions matters here, not which copy of it is used.
 */
function collect_data_fields(version_doc) {
  return flatten_fields(version_doc.schema.fields).filter((field) => !NON_DATA_TYPES.includes(field.type));
}

/**
 * Builds the merged column list across every version of a form: the active
 * version's own fields (in its own order), marked green when a field never
 * existed in any other version, followed by fields that existed in some
 * other version but not the active one, marked red - both colors are a
 * visual diff against the active version, not a value judgement about
 * either version. Untouched fields (present in the active version and at
 * least one other) carry no tint at all. With only one version to begin
 * with there's nothing to diff against, so every column stays untinted.
 */
function build_column_entry(field, language, extra) {
  // GeoLocation carries no question label of its own (see NON_LABEL_TYPES)
  // - falling back to a fixed header keeps this column from ever showing
  // up blank.
  const label = get_field_text(field.label, language) || (field.type === "geolocation" ? dcs_translate("DCS_GEO_TABLE_HEADER_LABEL", language) : "");
  return Object.assign(
    { key: field.id, label },
    field.type === "geolocation" ? { minWidthPx: GEO_CELL_TABLE_MIN_WIDTH_PX } : {},
    extra || {},
  );
}

/**
 * A field with no label authored in any language has nothing meaningful to
 * head its own column with - rather than show a blank header, that column
 * is left out of the table entirely, in every language, not only the one
 * currently active.
 */
function has_any_label(field) {
  return field.type === "geolocation" || ["en", "kn", "fr"].some((language_code) => !!get_field_text(field.label, language_code));
}

function build_diffed_columns(versions, language) {
  const active_version_doc = versions.find((entry) => entry.is_active) || versions[0];
  if (!active_version_doc) return { columns: [], field_type_by_id: new Map(), has_diff: false };

  const active_fields = collect_data_fields(active_version_doc);
  const active_field_ids = new Set(active_fields.map((field) => field.id));

  if (versions.length <= 1) {
    return {
      columns: [
        ...active_fields.filter(has_any_label).map((field) => build_column_entry(field, language)),
        { key: "version", labelKey: "DCS_TABLE_VERSION" },
        { key: "submitted_at", labelKey: "DCS_TABLE_SUBMITTED_AT" },
      ],
      field_type_by_id: new Map(active_fields.map((field) => [field.id, field.type])),
      has_diff: false,
    };
  }

  const other_versions = versions.filter((entry) => entry.version !== active_version_doc.version);
  const field_ids_in_other_versions = new Set();
  const removed_field_defs = [];
  const seen_removed_ids = new Set();

  other_versions.forEach((version_doc) => {
    collect_data_fields(version_doc).forEach((field) => {
      field_ids_in_other_versions.add(field.id);
      if (!active_field_ids.has(field.id) && !seen_removed_ids.has(field.id)) {
        seen_removed_ids.add(field.id);
        removed_field_defs.push(field);
      }
    });
  });

  const field_type_by_id = new Map();
  active_fields.forEach((field) => field_type_by_id.set(field.id, field.type));
  removed_field_defs.forEach((field) => field_type_by_id.set(field.id, field.type));

  const active_columns = active_fields
    .filter(has_any_label)
    .map((field) => build_column_entry(field, language, { tint: field_ids_in_other_versions.has(field.id) ? undefined : "green" }));
  const removed_columns = removed_field_defs.filter(has_any_label).map((field) => build_column_entry(field, language, { tint: "red" }));

  const has_diff = active_columns.some((column) => column.tint) || removed_columns.length > 0;

  const columns = [
    ...active_columns,
    ...removed_columns,
    { key: "version", labelKey: "DCS_TABLE_VERSION" },
    { key: "submitted_at", labelKey: "DCS_TABLE_SUBMITTED_AT" },
  ];

  return { columns, field_type_by_id, has_diff };
}

function build_rows(submissions, field_type_by_id, on_delete_click, deleting_id) {
  return (submissions || []).map((submission) => {
    const row = { dcs_row_key: submission._id };
    field_type_by_id.forEach((field_type, field_id) => {
      const raw_value = submission.data ? submission.data[field_id] : undefined;
      if (MEDIA_ANSWER_TYPES.includes(field_type)) {
        row[field_id] = raw_value ? <DcsDataTableFileCell value={raw_value} fieldType={field_type} /> : "";
      } else if (field_type === "geolocation") {
        row[field_id] = raw_value ? <DcsDataTableGeoCell value={raw_value} /> : "";
      } else {
        row[field_id] = Array.isArray(raw_value) ? raw_value.join(", ") : raw_value != null ? String(raw_value) : "";
      }
    });
    row.version = submission.version;
    row.submitted_at = submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : "";
    row.actions = (
      <DeleteSubmissionButton onClick={() => on_delete_click(submission._id)} disabled={deleting_id === submission._id} />
    );
    return row;
  });
}

/**
 * Every response ever collected against a form, across every version at
 * once (no version filter at all) - unlike the per-version data page,
 * columns here are the union of every version's fields, colored to show
 * how the active version differs from the ones before it (see
 * build_diffed_columns). Same fill-height/sticky-header/search/sort/
 * silent-refresh behavior as the per-version page.
 */
export default function FormAllDataPage() {
  const { form_group_id } = useParams();
  const { language, translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const table = useSubmissionsTable(form_group_id, undefined);
  const [confirming_delete_id, setConfirmingDeleteId] = useState(null);
  const [deleting_id, setDeletingId] = useState(null);
  const [is_export_open, setIsExportOpen] = useState(false);

  const { data: versions, loading: loading_versions } = useSilentPolling(
    () => get_form_versions(form_group_id).then((res) => res.data || []),
    10000,
    [form_group_id],
  );

  if (loading_versions || !versions || versions.length === 0) return <DcsLoadingState />;

  const { columns: data_columns, field_type_by_id, has_diff } = build_diffed_columns(versions, language);
  const columns = data_columns.concat([{ key: "actions", label: "", minWidthPx: ACTIONS_COLUMN_WIDTH_PX }]);
  const rows = build_rows(table.submissions, field_type_by_id, setConfirmingDeleteId, deleting_id);

  const handle_delete = async () => {
    setDeletingId(confirming_delete_id);
    try {
      await delete_submission(confirming_delete_id);
      showSuccess(translate("DCS_TOAST_SUBMISSION_DELETED"));
      setConfirmingDeleteId(null);
      table.refresh();
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setDeletingId(null);
    }
  };

  const legend_items = has_diff
    ? [
        { color: "#4CAF50", labelKey: "DCS_DATA_LEGEND_ADDED" },
        { color: "#E74C3C", labelKey: "DCS_DATA_LEGEND_REMOVED" },
      ]
    : null;

  return (
    <div className="h-full flex flex-col pb-4">
      <div className="flex-shrink-0 mb-3 pl-14 pr-3 sm:pl-16 sm:pr-4 flex flex-row items-center gap-2 overflow-x-auto">
        <DcsPeriodFilter period={table.period} onPeriodChange={table.setPeriod} from={table.from} onFromChange={table.setFrom} to={table.to} onToChange={table.setTo} onApply={table.handle_apply} includeAll />
        <DcsTableSearchSort search={table.search} onSearchChange={table.setSearch} onSearchSubmit={table.handle_apply} sort={table.sort} onSortChange={table.setSort} />
        <button
          type="button"
          onClick={() => setIsExportOpen(true)}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-none hover:bg-green-700 transition-colors cursor-pointer"
          style={{ fontFamily: "'Montserrat', sans-serif", height: 40 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {translate("DCS_BTN_EXPORT_EXCEL")}
        </button>
      </div>

      <div className="flex-1 min-h-0">
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
        />
      </div>

      {confirming_delete_id && (
        <DcsConfirmDialog
          titleKey="DCS_SUBMISSION_DELETE_TITLE"
          messageKey="DCS_SUBMISSION_DELETE_WARNING"
          confirming={!!deleting_id}
          onConfirm={handle_delete}
          onCancel={() => setConfirmingDeleteId(null)}
        />
      )}

      <DcsExportDialog
        open={is_export_open}
        onOpenChange={setIsExportOpen}
        form_group_id={form_group_id}
      />
    </div>
  );
}
