import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useSilentPolling } from "../hooks/useSilentPolling.js";
import { get_form_versions } from "../services/formsService.js";
import { get_submissions } from "../services/submissionsService.js";
import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import { get_field_text } from "../fields/fieldText.js";
import DcsDataTable from "../components/DcsDataTable.jsx";
import DcsLoadingState from "../components/DcsLoadingState.jsx";

const PAGE_SIZE = 20;
const NON_DATA_TYPES = ["section", "paragraph", "header", "file", "group"];

/**
 * Paginated view of every response collected against one specific,
 * immutable form version.
 */
export default function FormDataPage() {
  const { form_group_id, version } = useParams();
  const { translate, language } = useDcsLanguage();
  const [page, setPage] = useState(1);

  const { data: versions, loading: loading_versions } = useSilentPolling(
    () => get_form_versions(form_group_id).then((res) => res.data || []),
    10000,
    [form_group_id],
  );

  const version_doc = (versions || []).find((entry) => entry.version === Number(version));

  const { data: submission_result, loading: loading_submissions } = useSilentPolling(
    () => get_submissions(form_group_id, version, page, PAGE_SIZE),
    10000,
    [form_group_id, version, page],
  );

  useEffect(() => {
    setPage(1);
  }, [version]);

  if (loading_versions || !version_doc) return <DcsLoadingState />;

  const data_fields = flatten_fields(version_doc.schema.fields).filter((field) => !NON_DATA_TYPES.includes(field.type));

  const columns = data_fields
    .map((field) => ({ key: field.id, label: get_field_text(field.label, language) }))
    .concat([{ key: "submitted_at", labelKey: "DCS_TABLE_SUBMITTED_AT" }]);

  const rows = ((submission_result && submission_result.data) || []).map((submission) => {
    const row = { dcs_row_key: submission._id };
    data_fields.forEach((field) => {
      const raw_value = submission.data ? submission.data[field.id] : undefined;
      row[field.id] = Array.isArray(raw_value) ? raw_value.join(", ") : raw_value != null ? String(raw_value) : "";
    });
    row.submitted_at = submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : "";
    return row;
  });

  const total = (submission_result && submission_result.total) || 0;
  const total_pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="pb-16">
      <h2 className="mb-4" style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 18, color: "#333333" }}>
        {translate("DCS_FORM_DATA_TITLE")}
      </h2>
      <DcsDataTable columns={columns} rows={rows} page={page} totalPages={total_pages} onPageChange={setPage} loading={loading_submissions} />
    </div>
  );
}
