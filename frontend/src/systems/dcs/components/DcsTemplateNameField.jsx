import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

/**
 * A template's name and description, entered above the DC form builder
 * exactly like DcsFormNameField - never shown to a respondent, only used
 * to tell templates apart when listing/picking them.
 */
export default function DcsTemplateNameField({ name, onNameChange, description, onDescriptionChange }) {
  const { translate } = useDcsLanguage();
  const is_empty = !name || !name.trim();

  return (
    <div className="mb-5 p-4 space-y-3" style={{ backgroundColor: "rgba(5,109,170,0.05)", border: "1px dashed #056daa" }}>
      <p
        className="text-xs font-semibold uppercase mb-2"
        style={{ color: "#056daa", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.5px" }}
      >
        {translate("DCS_FIELD_TEMPLATE_NAME_BADGE")}
      </p>
      <div>
        <label className="cok-auth-label">{translate("DCS_FIELD_TEMPLATE_NAME")}</label>
        <input
          className="cok-auth-input w-full py-3"
          placeholder={translate("DCS_FIELD_TEMPLATE_NAME_PLACEHOLDER")}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          required
        />
        {is_empty && (
          <p className="text-xs mt-1" style={{ color: "#E74C3C" }}>
            {translate("DCS_FIELD_TEMPLATE_NAME_REQUIRED")}
          </p>
        )}
      </div>
      <div>
        <label className="cok-auth-label">
          {translate("DCS_FIELD_TEMPLATE_DESCRIPTION")} ({translate("DCS_FIELD_OPTIONAL")})
        </label>
        <textarea
          className="cok-auth-input w-full py-3"
          rows={3}
          placeholder={translate("DCS_FIELD_TEMPLATE_DESCRIPTION_PLACEHOLDER")}
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
        />
      </div>
    </div>
  );
}
