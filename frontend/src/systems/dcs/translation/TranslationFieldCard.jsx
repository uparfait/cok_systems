import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { LANGUAGES, collect_text_rows, read_change } from "./translationTexts.js";

const FONT = { fontFamily: "'Montserrat', sans-serif" };
const BORDER = "#E0E0E0";
const MUTED = "#9E9E9E";
const PRIMARY = "#056daa";

/**
 * One field of the form as a translator sees it: its type and id, then a
 * row per text it carries with the three languages side by side. A row of a
 * locked kind is shown but not editable. Long texts (paragraphs, help) get
 * a textarea, the rest a single line.
 */
export default function TranslationFieldCard({ entry, lockedKinds, changes, onChange, index }) {
  const { translate } = useDcsLanguage();
  const { field, depth } = entry;
  const rows = collect_text_rows(field, translate);
  if (rows.length === 0) return null;
  const multiline = (row) => row.kind === "content" || row.kind === "help_text";

  return (
    <div className="bg-white border-2 p-4 sm:p-5 space-y-4" style={{ borderColor: BORDER, marginLeft: Math.min(depth, 3) * 16 }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ color: PRIMARY, border: `1px solid ${PRIMARY}`, letterSpacing: "0.4px", ...FONT }}>
          {index}. {field.type}
        </span>
        <span className="text-xs" style={{ color: MUTED, ...FONT }}>
          {field.id}
        </span>
        {field.type === "hidden" && (
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ color: MUTED, border: `1px solid ${BORDER}`, ...FONT }}>
            {translate("DCS_TRANSLATION_FIELD_HIDDEN")}
          </span>
        )}
      </div>

      {rows.map((row) => {
        const locked = lockedKinds.includes(row.kind);
        return (
          <div key={row.path.join(".")}>
            <div className="flex items-center gap-2 mb-1">
              <label className="cok-auth-label" style={{ marginBottom: 0 }}>
                {row.title}
              </label>
              {locked && (
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ color: "#B9770E", border: "1px solid #B9770E", ...FONT }}>
                  {translate("DCS_TRANSLATION_LOCKED_BADGE")}
                </span>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {LANGUAGES.map((code) => {
                const value = read_change(changes, field.id, row.path, code, row.value[code] || "");
                const shared = {
                  className: "cok-auth-input w-full py-2 text-sm",
                  placeholder: code.toUpperCase(),
                  value,
                  disabled: locked,
                  onChange: (event) => onChange(field.id, row.path, code, event.target.value),
                  style: locked ? { opacity: 0.6 } : undefined,
                };
                return (
                  <div key={code}>
                    <p className="text-[10px] font-bold uppercase mb-1" style={{ color: MUTED, ...FONT }}>
                      {code}
                    </p>
                    {multiline(row) ? <textarea rows={3} {...shared} /> : <input {...shared} />}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
