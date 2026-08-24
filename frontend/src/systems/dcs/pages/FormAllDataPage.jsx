import React from "react";
import { useParams } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useSilentPolling } from "../hooks/useSilentPolling.js";
import { useSubmissionsTable } from "../hooks/useSubmissionsTable.js";
import { get_form_versions } from "../services/formsService.js";
import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import { get_field_text } from "../fields/fieldText.js";
import DcsDataTable from "../components/DcsDataTable.jsx";
import DcsDataTableFileCell from "../components/DcsDataTableFileCell.jsx";
import DcsDataTableGeoCell from "../components/DcsDataTableGeoCell.jsx";
import DcsPeriodFilter from "../components/DcsPeriodFilter.jsx";
import DcsTableSearchSort from "../components/DcsTableSearchSort.jsx";
import DcsLoadingState from "../components/DcsLoadingState.jsx";

const NON_DATA_TYPES = ["section", "paragraph", "header", "file", "group"];
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
function build_diffed_columns(versions, language) {
  const active_version_doc = versions.find((entry) => entry.is_active) || versions[0];
  if (!active_version_doc) return { columns: [], field_type_by_id: new Map(), has_diff: false };

  const active_fields = collect_data_fields(active_version_doc);
  const active_field_ids = new Set(active_fields.map((field) => field.id));

  if (versions.length <= 1) {
    return {
      columns: [
        ...active_fields.map((field) => ({ key: field.id, label: get_field_text(field.label, language) })),
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

  const active_columns = active_fields.map((field) => ({
    key: field.id,
    label: get_field_text(field.label, language),
    tint: field_ids_in_other_versions.has(field.id) ? undefined : "green",
  }));
  const removed_columns = removed_field_defs.map((field) => ({
    key: field.id,
    label: get_field_text(field.label, language),
    tint: "red",
  }));

  const has_diff = active_columns.some((column) => column.tint) || removed_columns.length > 0;

  const columns = [
    ...active_columns,
    ...removed_columns,
    { key: "version", labelKey: "DCS_TABLE_VERSION" },
    { key: "submitted_at", labelKey: "DCS_TABLE_SUBMITTED_AT" },
  ];

  return { columns, field_type_by_id, has_diff };
}

function build_rows(submissions, field_type_by_id) {
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
  const { language } = useDcsLanguage();
  const table = useSubmissionsTable(form_group_id, undefined);

  const { data: versions, loading: loading_versions } = useSilentPolling(
    () => get_form_versions(form_group_id).then((res) => res.data || []),
    10000,
    [form_group_id],
  );

  if (loading_versions || !versions || versions.length === 0) return <DcsLoadingState />;

  const { columns, field_type_by_id, has_diff } = build_diffed_columns(versions, language);
  const rows = build_rows(table.submissions, field_type_by_id);

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
    </div>
  );
}
