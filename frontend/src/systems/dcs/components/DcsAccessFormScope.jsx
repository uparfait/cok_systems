import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

const PRIMARY = "#056daa";

/**
 * Form scope of one access grant: either every form in the project, or an
 * explicit checkbox list of forms - shared by department and individual
 * grants so both scope forms the exact same way.
 */
export default function DcsAccessFormScope({ forms, allForms, formGroupIds, onChange }) {
  const { translate } = useDcsLanguage();

  const toggle_form = (form_group_id) => {
    const selected = formGroupIds.includes(form_group_id)
      ? formGroupIds.filter((id) => id !== form_group_id)
      : [...formGroupIds, form_group_id];
    onChange({ all_forms: false, form_group_ids: selected });
  };

  return (
    <div>
      <p className="text-xs font-semibold uppercase mb-1" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.5px" }}>
        {translate("DCS_ACCESS_FORMS_LABEL")}
      </p>

      <label className="flex items-start gap-2 text-sm mb-1" style={{ color: "#333333" }}>
        <input
          type="checkbox"
          checked={allForms}
          onChange={(event) => onChange({ all_forms: event.target.checked, form_group_ids: [] })}
          style={{ accentColor: PRIMARY, marginTop: 2 }}
        />
        <span>{translate("DCS_ACCESS_ALL_FORMS")}</span>
      </label>

      {!allForms && (
        <div className="pl-5 space-y-1">
          {forms.length === 0 && (
            <p className="text-sm" style={{ color: "#9E9E9E" }}>
              {translate("DCS_ACCESS_NO_FORMS")}
            </p>
          )}
          {forms.map((form) => (
            <label key={form.form_group_id} className="flex items-start gap-2 text-sm" style={{ color: "#333333" }}>
              <input
                type="checkbox"
                checked={formGroupIds.includes(form.form_group_id)}
                onChange={() => toggle_form(form.form_group_id)}
                style={{ accentColor: PRIMARY, marginTop: 2 }}
              />
              <span>{form.form_name || form.form_group_id}</span>
            </label>
          ))}
          {forms.length > 0 && formGroupIds.length === 0 && (
            <p className="text-xs" style={{ color: "#E74C3C" }}>
              {translate("DCS_ACCESS_NO_FORMS_SELECTED")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
