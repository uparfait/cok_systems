import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { get_field_text } from "../fields/fieldText.js";
import { LANGUAGES, LANGUAGE_NAME_KEYS, field_type_name, read_change, proposal_key } from "./translationTexts.js";

const FONT = { fontFamily: "'Montserrat', sans-serif" };
const BORDER = "#E0E0E0";
const MUTED = "#9E9E9E";
const PRIMARY = "#056daa";
const TEXT = "#333333";
const AMBER = "#B9770E";
const GREEN = "#1f8a4c";

const HEADING_SIZES = { 1: "clamp(17px, 3.8vw, 22px)", 2: "clamp(16px, 3.4vw, 19px)", 3: "clamp(15px, 3.1vw, 17px)", 4: "clamp(14px, 2.9vw, 16px)", 5: "clamp(13px, 2.7vw, 15px)", 6: "clamp(12px, 2.5vw, 13px)" };
const SELECT_TYPES = ["single_select", "multi_select", "select_group", "cascading_select", "ranking"];

function rows_for(text) {
  const length = String(text || "").length;
  const lines = String(text || "").split("\n").length;
  return Math.min(10, Math.max(2, lines, Math.ceil(length / 70)));
}

function tinted_style(design) {
  const style = { padding: "0.75rem", borderRadius: 8 };
  if (design && design.background_color) style.backgroundColor = design.background_color;
  return style;
}

/**
 * How the respondent sees this field, in one language: a heading at its
 * own level and colours, a paragraph, or a label above the input it draws
 * (a list of choices for the select family, an input showing its
 * placeholder otherwise).
 */
function FieldPreview({ field, language, text_of }) {
  const design = field.design || {};
  if (field.type === "header") {
    const level = field.level || 2;
    const Tag = `h${level}`;
    return (
      <div style={tinted_style(design)}>
        {React.createElement(Tag, { style: { ...FONT, fontWeight: 700, color: design.text_color || TEXT, fontSize: HEADING_SIZES[level] || HEADING_SIZES[2], whiteSpace: "pre-wrap", margin: 0 } }, text_of("label", language))}
      </div>
    );
  }
  if (field.type === "paragraph") {
    return (
      <div className="text-sm" style={Object.assign({ whiteSpace: "pre-wrap", color: design.text_color || "#555555" }, tinted_style(design))}>
        {text_of("content", language)}
      </div>
    );
  }
  const options = (field.options || []).concat(...(field.parent_option_groups || []).map((group) => (group && group.options) || []));
  return (
    <div>
      <label className="cok-auth-label">{text_of("label", language)}</label>
      {SELECT_TYPES.includes(field.type) && options.length > 0 ? (
        <div className="space-y-1">
          {options.slice(0, 8).map((option) => (
            <div key={option.id} className="flex items-center gap-2 text-sm" style={{ color: TEXT, ...FONT }}>
              <span style={{ width: 14, height: 14, border: `2px solid ${PRIMARY}`, borderRadius: field.type === "multi_select" ? 3 : "50%", display: "inline-block" }} />
              {text_of(`options/${option.id}`, language) || option.value}
            </div>
          ))}
          {options.length > 8 && (
            <p className="text-xs" style={{ color: MUTED, ...FONT }}>
              +{options.length - 8}
            </p>
          )}
        </div>
      ) : (
        <div className="cok-auth-input w-full py-3 text-sm" style={{ color: MUTED, ...FONT }}>
          {text_of("placeholder", language) || " "}
        </div>
      )}
      {text_of("help_text", language) && (
        <p className="text-xs mt-1" style={{ color: MUTED, ...FONT }}>
          {text_of("help_text", language)}
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status, translate }) {
  if (!status) return null;
  const color = status === "applied" ? GREEN : status === "restored" ? MUTED : AMBER;
  const key = status === "applied" ? "DCS_TRANSLATION_STATUS_APPLIED" : status === "restored" ? "DCS_TRANSLATION_STATUS_RESTORED" : "DCS_TRANSLATION_STATUS_PENDING";
  return (
    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ color, border: `1px solid ${color}`, ...FONT }}>
      {translate(key)}
    </span>
  );
}

/**
 * One field of the form as a translator works on it: the type in plain
 * words (never an id), a preview of how the respondent sees it - a heading
 * or paragraph once per language, any other field once in the reader's
 * language - then every text it carries with the three languages STACKED,
 * each in its own full-width box large enough to read. A locked language
 * is shown but cannot be typed; a saved text shows how far it got.
 */
export default function TranslationFieldCard({ entry, lockedLanguages, changes, proposals, onChange, index }) {
  const { translate, language } = useDcsLanguage();
  const { field, rows } = entry;

  const text_of = (key, code) => {
    const row = rows.find((item) => item.key === key);
    const held = proposals.get(proposal_key(field.id, key, code));
    const fallback = held && held.status === "pending" ? held.value : row ? get_field_text(row.value, code) && row.value[code] !== undefined ? row.value[code] : "" : "";
    return read_change(changes, field.id, key, code, fallback);
  };
  const preview_languages = field.type === "header" || field.type === "paragraph" ? LANGUAGES : [language];

  return (
    <div className="bg-white border-2 p-4 sm:p-5 space-y-5" style={{ borderColor: BORDER }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ color: PRIMARY, border: `1px solid ${PRIMARY}`, letterSpacing: "0.4px", ...FONT }}>
          {index}. {field_type_name(field.type, translate)}
        </span>
      </div>

      <div className="space-y-3 p-3" style={{ backgroundColor: "#F7F9FB", border: `1px dashed ${BORDER}` }}>
        <p className="text-[10px] font-bold uppercase" style={{ color: MUTED, ...FONT }}>
          {translate("DCS_TRANSLATION_PREVIEW")}
        </p>
        {preview_languages.map((code) => (
          <div key={code}>
            {preview_languages.length > 1 && (
              <p className="text-[10px] font-bold uppercase mb-1" style={{ color: PRIMARY, ...FONT }}>
                {translate(LANGUAGE_NAME_KEYS[code])}
              </p>
            )}
            <FieldPreview field={field} language={code} text_of={text_of} />
          </div>
        ))}
      </div>

      {rows.map((row) => (
        <div key={row.key} className="space-y-3">
          <p className="text-xs font-bold uppercase" style={{ color: TEXT, letterSpacing: "0.4px", ...FONT }}>
            {row.title}
          </p>
          {LANGUAGES.map((code) => {
            const locked = lockedLanguages.includes(code);
            const held = proposals.get(proposal_key(field.id, row.key, code));
            const value = read_change(changes, field.id, row.key, code, held && held.status === "pending" ? held.value : row.value[code] || "");
            return (
              <div key={code} className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ color: locked ? AMBER : "#FFFFFF", backgroundColor: locked ? "transparent" : PRIMARY, border: `1px solid ${locked ? AMBER : PRIMARY}`, ...FONT }}>
                    {translate(LANGUAGE_NAME_KEYS[code])}
                  </span>
                  {locked && (
                    <span className="text-[11px]" style={{ color: AMBER, ...FONT }}>
                      {translate("DCS_TRANSLATION_NOT_CHANGEABLE")}
                    </span>
                  )}
                  <StatusBadge status={held && held.status} translate={translate} />
                </div>
                <textarea
                  className="cok-auth-input w-full py-3 text-base"
                  rows={rows_for(value)}
                  value={value}
                  readOnly={locked}
                  disabled={locked}
                  placeholder={translate("DCS_TRANSLATION_EMPTY_TEXT")}
                  onChange={(event) => onChange(field.id, row.key, code, event.target.value)}
                  style={{ ...FONT, lineHeight: 1.5, resize: "vertical", opacity: locked ? 0.7 : 1 }}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
