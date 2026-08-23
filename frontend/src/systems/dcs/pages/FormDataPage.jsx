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

function build_rows(submissions, data_fields) {
  return (submissions || []).map((submission) => {
    const row = { dcs_row_key: submission._id };
    data_fields.forEach((field) => {
      const raw_value = submission.data ? submission.data[field.id] : undefined;
      if (MEDIA_ANSWER_TYPES.includes(field.type)) {
        row[field.id] = raw_value ? <DcsDataTableFileCell value={raw_value} fieldType={field.type} /> : "";
      } else {
        row[field.id] = Array.isArray(raw_value) ? raw_value.join(", ") : raw_value != null ? String(raw_value) : "";
      }
    });
    row.submitted_at = submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : "";
    return row;
  });
}

/**
 * Paginated view of every response collected against one specific,
 * immutable form version, filterable by date range. Fills the page's
 * available height and never grows it further - the header/filter bar and
 * the previous/next footer stay put, only the table body scrolls - and
 * refreshes itself silently every 10 seconds using whichever page/range
 * was last actually applied (tracked in a ref, not live filter inputs, so
 * a still-being-typed custom range is never silently fetched early).
 */
export default function FormDataPage() {
  const { form_group_id, version } = useParams();
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

  const version_doc = (versions || []).find((entry) => entry.version === Number(version));

  const fetch_submissions = (params, silent) => {
    if (params.period === "custom" && !params.from) return;
    applied_params_ref.current = params;
    if (!silent) setTableLoading(true);
    get_submissions(form_group_id, version, params.page, PAGE_SIZE, { period: params.period, from: params.from, to: params.to })
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
  }, [period, version, form_group_id]);

  useEffect(() => {
    const interval_id = window.setInterval(() => {
      fetch_submissions(applied_params_ref.current, true);
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form_group_id, version]);

  if (loading_versions || !version_doc) return <DcsLoadingState />;

  const data_fields = flatten_fields(version_doc.schema.fields).filter((field) => !NON_DATA_TYPES.includes(field.type));

  const columns = data_fields
    .map((field) => ({ key: field.id, label: get_field_text(field.label, language) }))
    .concat([{ key: "submitted_at", labelKey: "DCS_TABLE_SUBMITTED_AT" }]);

  const rows = build_rows(submission_result && submission_result.data, data_fields);
  const total = (submission_result && submission_result.total) || 0;
  const total_pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
        />
      </div>
    </div>
  );
}
