import React, { useState, useEffect } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsButtonPrimary from "./DcsButtonPrimary.jsx";

/**
 * Section one of project creation and editing: name and description only.
 * Departments are no longer assigned here - who may see the project is
 * managed entirely on its Access control tab.
 */
export default function ProjectDetailsForm({ initialValues, onSave, saving, submitLabelKey }) {
  const { translate } = useDcsLanguage();
  const [name, setName] = useState(initialValues?.name || "");
  const [description, setDescription] = useState(initialValues?.description || "");

  // ProjectSettingsPage stays mounted across a project switch (only the
  // :project_id route param changes, not the matched route), so this form's
  // own state would otherwise keep showing whichever project it first mounted
  // with. Re-seeding only when the project's own id changes - not on every
  // background poll refresh of the SAME project - avoids that stale display
  // while still not wiping in-progress edits every few seconds.
  useEffect(() => {
    setName(initialValues?.name || "");
    setDescription(initialValues?.description || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues?._id]);

  const handle_submit = (event) => {
    event.preventDefault();
    onSave({ name, description });
  };

  return (
    <form onSubmit={handle_submit} className="space-y-4">
      <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 18, color: "#333333" }}>
        {translate("DCS_SECTION_PROJECT_DETAILS")}
      </h2>

      <div>
        <label className="cok-auth-label">{translate("DCS_FIELD_PROJECT_NAME")}</label>
        <input
          className="cok-auth-input w-full py-3"
          placeholder={translate("DCS_FIELD_PROJECT_NAME_PLACEHOLDER")}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>

      <div>
        <label className="cok-auth-label">{translate("DCS_FIELD_PROJECT_DESCRIPTION")}</label>
        <textarea
          className="cok-auth-input w-full py-3"
          rows={3}
          placeholder={translate("DCS_FIELD_PROJECT_DESCRIPTION_PLACEHOLDER")}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <DcsButtonPrimary type="submit" disabled={saving}>
        {translate(submitLabelKey || "DCS_BTN_SAVE_CONTINUE")}
      </DcsButtonPrimary>
    </form>
  );
}
