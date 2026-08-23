import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useSilentPolling } from "../hooks/useSilentPolling.js";
import { get_form_versions } from "../services/formsService.js";
import { get_submissions } from "../services/submissionsService.js";
import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import { get_field_text } from "../fields/fieldText.js";
import DcsDataTable from "../components/DcsDataTable.jsx";
import DcsDataTableFileCell from "../components/DcsDataTableFileCell.jsx";
import DcsPeriodFilter from "../components/DcsPeriodFilter.jsx";
import DcsLoadingState from "../components/DcsLoadingState.jsx";

const PAGE_SIZE = 20;
const REFRESH_INTERVAL_MS = 10000;
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
 * least one other) carry no tint at all.
 */
function build_diffed_columns(versions, language, translate) {
  const active_version_doc = versions.find((entry) => entry.is_active) || versions[0];
  if (!active_version_doc) return { columns: [], field_type_by_id: new Map(), has_diff: false };

  const active_fields = collect_data_fields(active_version_doc);
  const active_field_ids = new Set(active_fields.map((field) => field.id));

  // Nothing to diff against with only one version - every column stays untinted.
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
 * build_diffed_columns). Same fill-height/sticky-header/silent-refresh
 * behavior as the per-version page.
 */
export default function FormAllDataPage() {
  const { form_group_id } = useParams();
  const { translate, language } = useDcsLanguage();
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [submission_result, setSubmissionResult] = useState(null);
  const [table_loading, setTableLoading] = useState(true);
  const applied_params_ref = useRef({ page: 1, period: "all", from: "", to: "" });

  const { data: versions, loading: loading_versions } = useSilentPolling(
    () => get_form_versions(form_group_id).then((res) => res.data || []),
    10000,
    [form_group_id],
  );

  const fetch_submissions = (params, silent) => {
    if (params.period === "custom" && !params.from) return;
    applied_params_ref.current = params;
    if (!silent) setTableLoading(true);
    get_submissions(form_group_id, undefined, params.page, PAGE_SIZE, { period: params.period, from: params.from, to: params.to })
      .then((response) => setSubmissionResult(response))
      .catch(() => {
        if (!silent) setSubmissionResult(null);
      })
      .finally(() => {
        if (!silent) setTableLoading(false);
      });
  };

  const handle_page_change = (next_page) => {
    setPage(next_page);
    fetch_submissions({ page: next_page, period, from, to }, false);
  };

  const handle_apply = () => fetch_submissions({ page: 1, period, from, to }, false);

  useEffect(() => {
    setPage(1);
    if (period !== "custom") fetch_submissions({ page: 1, period, from: "", to: "" }, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, form_group_id]);

  useEffect(() => {
    const interval_id = window.setInterval(() => {
      fetch_submissions(applied_params_ref.current, true);
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form_group_id]);

  if (loading_versions || !versions || versions.length === 0) return <DcsLoadingState />;

  const { columns, field_type_by_id, has_diff } = build_diffed_columns(versions, language, translate);
  const rows = build_rows(submission_result && submission_result.data, field_type_by_id);
  const total = (submission_result && submission_result.total) || 0;
  const total_pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const legend_items = has_diff
    ? [
        { color: "#4CAF50", labelKey: "DCS_DATA_LEGEND_ADDED" },
        { color: "#E74C3C", labelKey: "DCS_DATA_LEGEND_REMOVED" },
      ]
    : null;

  return (
    <div className="h-full flex flex-col pb-4">
      <div className="flex-shrink-0 mb-3 px-3 sm:px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <DcsPeriodFilter period={period} onPeriodChange={setPeriod} from={from} onFromChange={setFrom} to={to} onToChange={setTo} onApply={handle_apply} includeAll />
        <span className="text-sm" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
          {translate("DCS_STATS_TOTAL_IN_RANGE", { count: total })}
        </span>
      </div>

      <div className="flex-1 min-h-0">
        <DcsDataTable
          columns={columns}
          rows={rows}
          page={page}
          totalPages={total_pages}
          onPageChange={handle_page_change}
          loading={table_loading}
          scrollResetKey={page}
          columnTints={Object.fromEntries(columns.filter((column) => column.tint).map((column) => [column.key, column.tint]))}
          legendItems={legend_items}
        />
      </div>
    </div>
  );
}
