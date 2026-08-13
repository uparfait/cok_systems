import React from "react";
import { get_field_text } from "./fieldText.js";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

/**
 * Stores a value without ever showing an input to the person filling the
 * form. Only visible as a placeholder chip while authoring the form.
 */
export default function HiddenField({ field, language, mode }) {
  const { translate } = useDcsLanguage();
  if (mode !== "builder") return null;

  const label = get_field_text(field.label, language);
  return (
    <div className="w-full px-3 py-2 border border-dashed" style={{ borderColor: "#CDB896" }}>
      <span className="text-xs" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
        {translate("FIELD_TYPE_HIDDEN")}: {label}
      </span>
    </div>
  );
}
