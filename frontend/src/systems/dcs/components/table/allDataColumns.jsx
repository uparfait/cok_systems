import React from "react";
import { dcs_translate } from "../../i18n/index.js";
import { flatten_fields } from "../../jsonlogic/dependencyGraph.js";
import { get_field_text } from "../../fields/fieldText.js";
import DcsDataTableFileCell from "../DcsDataTableFileCell.jsx";
import DcsDataTableGeoCell, { GEO_CELL_TABLE_MIN_WIDTH_PX } from "../DcsDataTableGeoCell.jsx";
import { approval_status_label_key } from "../DcsApprovalStatusChip.jsx";
import { format_respondent } from "../../offline/respondentStore.js";
import { RecordHistoryButton } from "../../tracking/RecordHistoryDialog.jsx";
import DcsRowActionsCell from "./DcsRowActionsCell.jsx";

const NON_DATA_TYPES = ["section", "paragraph", "header", "file", "group", "image_block", "horizontal_line"];
const MEDIA_ANSWER_TYPES = ["image", "video", "audio", "file_upload", "signature"];

/**
 * The field types whose answers come from a fixed set of choices, and so
 * are the only ones worth offering a value filter under their column
 * header - filtering free text by exact value would never match anything
 * anybody would actually pick.
 */
export const FILTERABLE_TYPES = ["single_select", "multi_select", "likert_scale", "select_group", "cascading_select"];

/** Every version's own data fields, in that version's order. */
function collect_data_fields(version_doc) {
  return flatten_fields(version_doc.schema.fields).filter((field) => !NON_DATA_TYPES.includes(field.type));
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

function build_column_entry(field, language, extra) {
  // GeoLocation carries no question label of its own - falling back to a
  // fixed header keeps this column from ever showing up blank.
  const label = get_field_text(field.label, language) || (field.type === "geolocation" ? dcs_translate("DCS_GEO_TABLE_HEADER_LABEL", language) : "");
  return Object.assign(
    { key: field.id, label },
    field.type === "geolocation" ? { minWidthPx: GEO_CELL_TABLE_MIN_WIDTH_PX } : {},
    extra || {},
  );
}

/**
 * The merged column list across every version of a form: the active
 * version's own fields (in its own order), marked green when a field
 * never existed in any other version, followed by fields that existed in
 * some other version but not the active one, marked red - both colours
 * are a visual diff against the active version, not a judgement about
 * either version. Untouched fields carry no tint at all, and with only
 * one version there is nothing to diff, so every column stays untinted.
 */
export function build_diffed_columns(versions, language) {
  const active_version_doc = versions.find((entry) => entry.is_active) || versions[0];
  if (!active_version_doc) return { columns: [], field_type_by_id: new Map(), has_diff: false };

  const active_fields = collect_data_fields(active_version_doc);
  const active_field_ids = new Set(active_fields.map((field) => field.id));

  const tail = [
    { key: "version", labelKey: "DCS_TABLE_VERSION" },
    { key: "submitted_by", labelKey: "DCS_TABLE_SUBMITTED_BY" },
    { key: "submitted_at", labelKey: "DCS_TABLE_SUBMITTED_AT" },
  ];

  if (versions.length <= 1) {
    return {
      columns: [...active_fields.filter(has_any_label).map((field) => build_column_entry(field, language)), ...tail],
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

  return {
    columns: [...active_columns, ...removed_columns, ...tail],
    field_type_by_id,
    has_diff: active_columns.some((column) => column.tint) || removed_columns.length > 0,
  };
}

/** One submitted answer as this table's cell content. */
function answer_cell(field_type, raw_value) {
  if (MEDIA_ANSWER_TYPES.includes(field_type)) return raw_value ? <DcsDataTableFileCell value={raw_value} fieldType={field_type} /> : "";
  if (field_type === "geolocation") return raw_value ? <DcsDataTableGeoCell value={raw_value} /> : "";
  if (Array.isArray(raw_value)) return raw_value.join(", ");
  return raw_value !== null && raw_value !== undefined ? String(raw_value) : "";
}

/**
 * The approval cell: status on the left, how many approvers have signed
 * pushed to the far end. Plain text rather than a chip, so the table can
 * measure the column's real width.
 */
function approval_cell(submission, translate) {
  const approval_label_key = approval_status_label_key(submission.approval_status);
  if (!approval_label_key) return "-";
  const progress = submission.approval_progress;
  return (
    <span className="flex items-center justify-between gap-3 w-full">
      <span>{translate(approval_label_key)}</span>
      {progress && progress.total > 0 && (
        <span style={{ color: "#9E9E9E", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", fontFamily: "'Montserrat', sans-serif" }}>
          {progress.approved}-out-{progress.total}
        </span>
      )}
    </span>
  );
}

export function build_rows({ submissions, field_type_by_id, translate, on_history_click, selected_set, on_select_change, on_view, on_edit }) {
  return (submissions || []).map((submission) => {
    const row = { dcs_row_key: submission._id };

    row.actions = (
      <DcsRowActionsCell
        selected={selected_set.has(submission._id)}
        onSelectChange={(next) => on_select_change(submission._id, next)}
        onView={() => on_view(submission)}
        onEdit={() => on_edit(submission)}
      />
    );

    // Tracked forms only: when the record last changed, and its history.
    row.updated_at = submission.updated_at ? new Date(submission.updated_at).toLocaleString() : "-";
    const change_count = Math.max(0, (submission.history || []).length - 1);
    row.history = on_history_click && change_count > 0 ? <RecordHistoryButton onClick={() => on_history_click(submission)} count={change_count} /> : "-";

    field_type_by_id.forEach((field_type, field_id) => {
      row[field_id] = answer_cell(field_type, submission.data ? submission.data[field_id] : undefined);
    });

    row.version = submission.version;
    row.submitted_by = format_respondent(submission.respondent) || "-";
    row.submitted_at = submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : "";
    row.approval = approval_cell(submission, translate);
    return row;
  });
}
