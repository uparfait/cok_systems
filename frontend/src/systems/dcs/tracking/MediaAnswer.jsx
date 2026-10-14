import React from "react";
import { MEDIA_ANSWER_TYPES } from "../fields/dataColumns.jsx";
import { get_file_kind } from "../components/fileKind.js";
import { get_field_text } from "../fields/fieldText.js";
import DcsDataTableFileCell from "../components/DcsDataTableFileCell.jsx";

const FONT = "'Montserrat', sans-serif";

export const is_media_field = (field) => !!field && MEDIA_ANSWER_TYPES.includes(field.type);

export function media_items(value) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.filter((item) => item && (typeof item === "string" || item.url || item.data_url));
}

function item_url(item) {
  return typeof item === "string" ? item : item.url || item.data_url || "";
}

function item_name(item, fallback) {
  const from_url = item_url(item).split("/").pop().split("?")[0];
  if (typeof item === "string") return from_url || fallback;
  return item.name || from_url || fallback;
}

export function MediaAnswer({ field, value }) {
  const items = media_items(value);
  if (items.length === 0) return <span>-</span>;
  const field_type = field ? field.type : "file_upload";
  return (
    <span className="flex flex-wrap items-center gap-2 min-w-0">
      {items.map((item, index) => {
        const url = item_url(item);
        const name = item_name(item, field_type);
        const kind = typeof item === "object" && item.is_link ? "image" : get_file_kind(typeof item === "object" ? item.type : "", name);
        if (kind === "image" || kind === "video") return <DcsDataTableFileCell key={`${url}_${index}`} value={item} fieldType={field_type} />;
        return (
          <a key={`${url}_${index}`} href={url} target="_blank" rel="noopener noreferrer" className="text-xs underline truncate max-w-full" style={{ color: "#056daa", fontFamily: FONT }} title={name}>
            {name}
          </a>
        );
      })}
    </span>
  );
}

export function MediaAnswerBlock({ field, language, value }) {
  const label = get_field_text(field.label, language) || get_field_text(field.label, "en") || field.id;
  return (
    <div className="w-full" data-field-id={field.id}>
      <label className="cok-auth-label">{label}</label>
      <MediaAnswer field={field} value={value} />
    </div>
  );
}

export function read_only_field(element, field, value, language) {
  if (is_media_field(field)) return <MediaAnswerBlock field={field} language={language} value={value} />;
  return React.isValidElement(element) ? React.cloneElement(element, { inert: true }) : element;
}
