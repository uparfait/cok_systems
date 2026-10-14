import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { collect_data_fields, column_label, render_answer_cell } from "../fields/dataColumns.jsx";
import { format_value, format_when } from "./trackingConfig.js";

const PRIMARY = "#056daa";
const MUTED = "#9E9E9E";
const TEXT = "#333333";
const BORDER = "#E0E0E0";
const FONT = "'Montserrat', sans-serif";
const HIGHLIGHT = "rgba(5, 109, 170, 0.08)";
const TABLE_STYLE = { "--cok-table-max-h": "55vh", border: `1px solid ${BORDER}` };

const HEAD_STYLE = {
  fontFamily: FONT,
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: MUTED,
  padding: "8px 10px",
  textAlign: "left",
  borderBottom: `1px solid ${BORDER}`,
};

const CELL_STYLE = {
  fontFamily: FONT,
  fontSize: 13,
  color: TEXT,
  padding: "6px 10px",
  borderBottom: "1px solid #F0F0F0",
  maxWidth: 240,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  verticalAlign: "middle",
};

function cell_title(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "object" && !Array.isArray(value)) return "";
  return format_value(value);
}

export default function RecordResultsTable({ records, fields, searchedFieldId, loadedRecord, onLoad, onHistory }) {
  const { translate, language } = useDcsLanguage();
  const data_fields = collect_data_fields(fields);

  const head_style_for = (field_id) => (field_id === searchedFieldId ? Object.assign({}, HEAD_STYLE, { backgroundColor: HIGHLIGHT, color: PRIMARY }) : HEAD_STYLE);
  const cell_style_for = (field_id) => (field_id === searchedFieldId ? Object.assign({}, CELL_STYLE, { backgroundColor: HIGHLIGHT, fontWeight: 600 }) : CELL_STYLE);

  return (
    <div className="cok-table-scroll dcs-lookup-table" style={TABLE_STYLE}>
      <table className="min-w-full">
        <thead>
          <tr>
            <th style={HEAD_STYLE} className="dcs-lookup-sticky">{translate("DCS_TABLE_ACTIONS")}</th>
            <th style={HEAD_STYLE}>{translate("DCS_TABLE_SUBMITTED_AT")}</th>
            <th style={HEAD_STYLE}>{translate("DCS_TRACKING_TABLE_UPDATED_AT")}</th>
            {data_fields.map((field) => (
              <th key={field.id} style={head_style_for(field.id)}>{column_label(field, language, translate)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const is_loaded = !!loadedRecord && loadedRecord._id === record._id;
            const change_count = Math.max(0, (record.history || []).length - 1);
            return (
              <tr key={record._id} style={{ backgroundColor: is_loaded ? "rgba(5, 109, 170, 0.05)" : "#FFFFFF" }}>
                <td style={CELL_STYLE} className="dcs-lookup-sticky">
                  <span className="flex items-center gap-1.5">
                    <button type="button" className="dcs-dt-tool is-active cursor-pointer disabled:opacity-50 disabled:cursor-default" onClick={() => onLoad(record)} disabled={is_loaded}>
                      {translate(is_loaded ? "DCS_TRACKING_LOADED" : "DCS_TRACKING_LOAD_ROW")}
                    </button>
                    <button type="button" className="dcs-dt-tool cursor-pointer" onClick={() => onHistory(record)}>
                      {translate("DCS_TRACKING_SHOW_HISTORY")}
                      {change_count > 0 ? ` (${change_count})` : ""}
                    </button>
                  </span>
                </td>
                <td style={CELL_STYLE}>{format_when(record.submitted_at)}</td>
                <td style={CELL_STYLE}>{record.updated_at ? format_when(record.updated_at) : "-"}</td>
                {data_fields.map((field) => {
                  const value = (record.data || {})[field.id];
                  return (
                    <td key={field.id} style={cell_style_for(field.id)} title={cell_title(value)}>
                      {render_answer_cell(field, value)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
