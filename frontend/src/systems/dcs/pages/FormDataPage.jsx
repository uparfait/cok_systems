import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useSilentPolling } from "../hooks/useSilentPolling.js";
import { useSubmissionsTable } from "../hooks/useSubmissionsTable.js";
import { get_form_versions } from "../services/formsService.js";
import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import { get_field_text } from "../fields/fieldText.js";
import DcsDataTable from "../components/DcsDataTable.jsx";
import DcsDataTableFileCell from "../components/DcsDataTableFileCell.jsx";
import DcsDataTableGeoCell, { GEO_CELL_TABLE_MIN_WIDTH_PX } from "../components/DcsDataTableGeoCell.jsx";
import DcsPeriodFilter from "../components/DcsPeriodFilter.jsx";
import DcsTableSearchSort from "../components/DcsTableSearchSort.jsx";
import DcsLoadingState from "../components/DcsLoadingState.jsx";
import { approval_status_label_key } from "../components/DcsApprovalStatusChip.jsx";
import DcsApprovalScheduleDialog from "../components/DcsApprovalScheduleDialog.jsx";
import DcsApprovalDetailsDialog from "../components/DcsApprovalDetailsDialog.jsx";

const NON_DATA_TYPES = ["section", "paragraph", "header", "file", "group", "image_block", "horizontal_line"];
const MEDIA_ANSWER_TYPES = ["image", "video", "audio", "file_upload", "signature"];

/**
 * A field with no label authored in any language has nothing meaningful to
 * head its own column with - rather than show a blank header, that column
 * is left out of the table entirely, in every language, not only the one
 * currently active.
 */
function has_any_label(field) {
  return field.type === "geolocation" || ["en", "kn", "fr"].some((language_code) => !!get_field_text(field.label, language_code));
}

function build_rows(submissions, data_fields, translate) {
  return (submissions || []).map((submission) => {
    const row = { dcs_row_key: submission._id };
    data_fields.forEach((field) => {
      const raw_value = submission.data ? submission.data[field.id] : undefined;
      if (MEDIA_ANSWER_TYPES.includes(field.type)) {
        row[field.id] = raw_value ? <DcsDataTableFileCell value={raw_value} fieldType={field.type} /> : "";
      } else if (field.type === "geolocation") {
        row[field.id] = raw_value ? <DcsDataTableGeoCell value={raw_value} /> : "";
      } else {
        row[field.id] = Array.isArray(raw_value) ? raw_value.join(", ") : raw_value != null ? String(raw_value) : "";
      }
    });
    row.submitted_at = submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : "";
    // Plain text (not a chip) so the table can measure the column's real width - it never bleeds into the next column.
    // Status on the left, approver progress ("1-out-2") pushed to the far end of the cell.
    // The column declares its own width (minWidthPx), so this non-text content never bleeds into the next column.
    const approval_label_key = approval_status_label_key(submission.approval_status);
    const progress = submission.approval_progress;
    row.approval = approval_label_key ? (
      <span className="flex items-center justify-between gap-3 w-full">
        <span>{translate(approval_label_key)}</span>
        {progress && progress.total > 0 && (
          <span style={{ color: "#9E9E9E", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", fontFamily: "'Montserrat', sans-serif" }}>
            {progress.approved}-out-{progress.total}
          </span>
        )}
      </span>
    ) : (
      "-"
    );
    return row;
  });
}

/**
 * Paginated view of every response collected against one specific,
 * immutable form version, filterable by date range, free-text search and
 * sort direction (see useSubmissionsTable). Fills the page's available
 * height and never grows it further - the header/filter bar and the
 * pagination footer stay put, only the table body scrolls.
 */
export default function FormDataPage() {
  const { form_group_id, version } = useParams();
  const { language, translate } = useDcsLanguage();
  const table = useSubmissionsTable(form_group_id, version);
  const [is_schedule_open, setIsScheduleOpen] = useState(false);
  const [details_submission_id, setDetailsSubmissionId] = useState(null);

  const { data: versions, loading: loading_versions } = useSilentPolling(
    () => get_form_versions(form_group_id).then((res) => res.data || []),
    10000,
    [form_group_id],
  );

  const version_doc = (versions || []).find((entry) => entry.version === Number(version));

  if (loading_versions || !version_doc) return <DcsLoadingState />;

  const data_fields = flatten_fields(version_doc.schema.fields).filter((field) => !NON_DATA_TYPES.includes(field.type));

  const columns = [{ key: "approval", labelKey: "DCS_TABLE_APPROVAL", minWidthPx: 210 }].concat(data_fields
    .filter(has_any_label)
    .map((field) =>
      Object.assign(
        // GeoLocation carries no question label of its own (see
        // NON_LABEL_TYPES) - falling back to a fixed header keeps this
        // column from ever showing up blank.
        { key: field.id, label: get_field_text(field.label, language) || (field.type === "geolocation" ? translate("DCS_GEO_TABLE_HEADER_LABEL") : "") },
        field.type === "geolocation" ? { minWidthPx: GEO_CELL_TABLE_MIN_WIDTH_PX } : {},
      ),
    )
    .concat([{ key: "submitted_at", labelKey: "DCS_TABLE_SUBMITTED_AT" }]));

  const rows = build_rows(table.submissions, data_fields, translate);

  return (
    <div className="h-full flex flex-col pb-4">
      <div className="flex-shrink-0 mb-3 pl-14 pr-3 sm:pl-16 sm:pr-4 flex flex-row items-center gap-2 overflow-x-auto">
        <DcsPeriodFilter period={table.period} onPeriodChange={table.setPeriod} from={table.from} onFromChange={table.setFrom} to={table.to} onToChange={table.setTo} onApply={table.handle_apply} includeAll />
        <DcsTableSearchSort search={table.search} onSearchChange={table.setSearch} onSearchSubmit={table.handle_apply} sort={table.sort} onSortChange={table.setSort} />
        <button
          type="button"
          onClick={() => setIsScheduleOpen(true)}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white rounded-none transition-colors cursor-pointer"
          style={{ fontFamily: "'Montserrat', sans-serif", height: 40, backgroundColor: "#056daa" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 12l2 2 4-4" />
            <circle cx="12" cy="12" r="10" />
          </svg>
          {translate("DCS_BTN_SCHEDULE_APPROVAL")}
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
          totalCount={table.total}
          onRowClick={(row) => setDetailsSubmissionId(row.dcs_row_key)}
        />
      </div>

      {is_schedule_open && (
        <DcsApprovalScheduleDialog form_group_id={form_group_id} onClose={() => setIsScheduleOpen(false)} onChanged={table.refresh} />
      )}

      {details_submission_id && (
        <DcsApprovalDetailsDialog submission_id={details_submission_id} onClose={() => setDetailsSubmissionId(null)} />
      )}
    </div>
  );
}
