import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { get_field_text } from "../fields/fieldText.js";
import { LANGUAGES, LANGUAGE_NAME_KEYS, field_type_name, read_change, proposal_key } from "./translationTexts.js";

const FONT = { fontFamily: "'Montserrat', sans-serif" };
const MUTED = "#9E9E9E";
const PRIMARY = "#056daa";
const TEXT = "#333333";
const PREVIEW_BG = "#F7F9FB";

const HEADING_SIZES = { 1: "clamp(17px, 3.8vw, 22px)", 2: "clamp(16px, 3.4vw, 19px)", 3: "clamp(15px, 3.1vw, 17px)", 4: "clamp(14px, 2.9vw, 16px)", 5: "clamp(13px, 2.7vw, 15px)", 6: "clamp(12px, 2.5vw, 13px)" };
const SELECT_TYPES = ["single_select", "multi_select", "select_group", "cascading_select", "ranking"];
const STATUS_KEYS = { applied: "DCS_TRANSLATION_STATUS_APPLIED", restored: "DCS_TRANSLATION_STATUS_RESTORED", pending: "DCS_TRANSLATION_STATUS_PENDING" };

function rows_for(text) {
  const length = String(text || "").length;
  const lines = String(text || "").split("\n").length;
  return Math.min(10, Math.max(2, lines, Math.ceil(length / 70)));
}

function tinted_style(design) {
  const style = { padding: "0.5rem 0" };
  if (design && design.background_color) {
    style.backgroundColor = design.background_color;
    style.padding = "0.75rem";
  }
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
              <span style={{ width: 14, height: 14, border: `2px solid ${PRIMARY}`, borderRadius: field.type === "multi_select" ? 3 : "50%", display: "inline-block", flexShrink: 0 }} />
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

/**
 * One field of the form as a translator works on it: the type in plain
 * words (never an id), a preview of how the respondent sees it - a heading
 * or paragraph once per language, any other field once in the reader's
 * language - then every text it carries with the three languages STACKED,
 * each in its own full-width box. A locked language is shown but cannot be
 * typed. The field names who translated it; when that is someone else the
 * whole field is read-only for this translator.
 */
export default function TranslationFieldCard({ entry, lockedLanguages, changes, proposals, owner, onChange, index }) {
  const { translate, language } = useDcsLanguage();
  const { field, rows } = entry;
  const taken = !!(owner && !owner.mine);

  const text_of = (key, code) => {
    const row = rows.find((item) => item.key === key);
    const held = proposals.get(proposal_key(field.id, key, code));
    const fallback = held && held.status === "pending" ? held.value : row ? get_field_text(row.value, code) && row.value[code] !== undefined ? row.value[code] : "" : "";
    return read_change(changes, field.id, key, code, fallback);
  };
  const preview_languages = field.type === "header" || field.type === "paragraph" ? LANGUAGES : [language];

  return (
    <div className="bg-white cok-auth-card p-4 sm:p-5 space-y-4" style={{ opacity: taken ? 0.85 : 1 }}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[11px] font-bold uppercase" style={{ color: MUTED, letterSpacing: "0.5px", ...FONT }}>
          {index}. {field_type_name(field.type, translate)}
        </p>
        {owner && (
          <p className="text-xs" style={{ color: taken ? MUTED : PRIMARY, ...FONT }}>
            {owner.mine ? translate("DCS_TRANSLATION_BY_YOU") : translate("DCS_TRANSLATION_BY", { name: owner.name })}
          </p>
        )}
      </div>
      {taken && (
        <p className="text-xs" style={{ color: MUTED, ...FONT }}>
          {translate("DCS_TRANSLATION_TAKEN")}
        </p>
      )}

      <div className="space-y-3 p-3" style={{ backgroundColor: PREVIEW_BG }}>
        {preview_languages.map((code) => (
          <div key={code}>
            {preview_languages.length > 1 && (
              <p className="text-[10px] font-bold uppercase mb-1" style={{ color: MUTED, ...FONT }}>
                {translate(LANGUAGE_NAME_KEYS[code])}
              </p>
            )}
            <FieldPreview field={field} language={code} text_of={text_of} />
          </div>
        ))}
      </div>

      {rows.map((row) => (
        <div key={row.key} className="space-y-2">
          <p className="text-xs font-bold" style={{ color: TEXT, ...FONT }}>
            {row.title}
          </p>
          {LANGUAGES.map((code) => {
            const locked = lockedLanguages.includes(code);
            const disabled = locked || taken;
            const held = proposals.get(proposal_key(field.id, row.key, code));
            const value = read_change(changes, field.id, row.key, code, held && held.status === "pending" ? held.value : row.value[code] || "");
            return (
              <div key={code}>
                <p className="text-[11px] mb-1 flex items-center gap-2 flex-wrap" style={{ color: MUTED, ...FONT }}>
                  <span className="font-bold uppercase" style={{ color: locked ? MUTED : PRIMARY }}>{translate(LANGUAGE_NAME_KEYS[code])}</span>
                  {locked && <span>{translate("DCS_TRANSLATION_NOT_CHANGEABLE")}</span>}
                  {held && held.status && <span>{translate(STATUS_KEYS[held.status] || STATUS_KEYS.pending)}</span>}
                </p>
                <textarea
                  className="cok-auth-input w-full py-3 text-base"
                  rows={rows_for(value)}
                  value={value}
                  readOnly={disabled}
                  disabled={disabled}
                  placeholder={translate("DCS_TRANSLATION_EMPTY_TEXT")}
                  onChange={(event) => onChange(field.id, row.key, code, event.target.value)}
                  style={{ ...FONT, lineHeight: 1.5, resize: "vertical", paddingLeft: 14, opacity: disabled ? 0.7 : 1 }}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
