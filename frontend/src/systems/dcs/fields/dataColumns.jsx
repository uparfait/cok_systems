import React from "react";
import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import { get_field_text } from "./fieldText.js";
import DcsDataTableFileCell from "../components/DcsDataTableFileCell.jsx";
import DcsDataTableGeoCell, { GEO_CELL_TABLE_MIN_WIDTH_PX } from "../components/DcsDataTableGeoCell.jsx";

export const NON_DATA_TYPES = ["section", "paragraph", "header", "file", "group", "image_block", "horizontal_line"];
export const MEDIA_ANSWER_TYPES = ["image", "video", "audio", "file_upload", "signature"];
export { GEO_CELL_TABLE_MIN_WIDTH_PX };

/**
 * A field with no label authored in any language has nothing meaningful to
 * head its own column with, so it is left out of the table entirely rather
 * than falling back to a raw field id.
 */
export function has_any_label(field) {
  return field.type === "geolocation" || ["en", "kn", "fr"].some((language_code) => !!get_field_text(field.label, language_code));
}

/** Every answerable, labelled field of a schema, flattened in form order. */
export function collect_data_fields(fields) {
  return flatten_fields(fields || [])
    .filter((field) => !NON_DATA_TYPES.includes(field.type))
    .filter(has_any_label);
}

/** The header text of one field's column in the active language. */
export function column_label(field, language, translate) {
  const authored = get_field_text(field.label, language);
  if (authored) return authored;
  if (field.type === "geolocation") return translate("DCS_GEO_TABLE_HEADER_LABEL");
  return ["en", "kn", "fr"].map((code) => get_field_text(field.label, code)).find(Boolean) || "";
}

/** One submitted answer as table cell content, media and maps included. */
export function render_answer_cell(field, raw_value) {
  if (raw_value === null || raw_value === undefined || raw_value === "") return "";
  if (MEDIA_ANSWER_TYPES.includes(field.type)) return <DcsDataTableFileCell value={raw_value} fieldType={field.type} />;
  if (field.type === "geolocation") return <DcsDataTableGeoCell value={raw_value} />;
  if (Array.isArray(raw_value)) return raw_value.join(", ");
  if (typeof raw_value === "object") return raw_value.name || JSON.stringify(raw_value);
  return String(raw_value);
}

/**
 * The width a field's column needs in a plain (non DcsDataTable) table:
 * media and map answers declare their own, text wraps inside a bounded
 * column so one long answer can never stretch the row.
 */
export function column_width_for(field) {
  if (field.type === "geolocation") {
    return { minWidth: GEO_CELL_TABLE_MIN_WIDTH_PX, maxWidth: GEO_CELL_TABLE_MIN_WIDTH_PX };
  }
  if (MEDIA_ANSWER_TYPES.includes(field.type)) {
    return { minWidth: 180, maxWidth: 240 };
  }
  return { minWidth: 160, maxWidth: 320 };
}
