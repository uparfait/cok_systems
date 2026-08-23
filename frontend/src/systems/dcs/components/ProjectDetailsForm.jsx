import React, { useState, useEffect } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { list_departments, list_department_units } from "../services/departmentsService.js";
import DcsButtonPrimary from "./DcsButtonPrimary.jsx";
import DcsSearchableSelect from "./DcsSearchableSelect.jsx";

/**
 * Section one of project creation and editing: name, description and an
 * optional department/unit assignment, fetched the same way the rest of
 * the platform assigns departments to a record.
 */
export default function ProjectDetailsForm({ initialValues, onSave, saving, submitLabelKey }) {
  const { translate } = useDcsLanguage();
  const [name, setName] = useState(initialValues?.name || "");
  const [description, setDescription] = useState(initialValues?.description || "");
  const [department_id, setDepartmentId] = useState(initialValues?.department_id || "");
  const [department_name, setDepartmentName] = useState(initialValues?.department_name || "");
  const [department_unit_id, setDepartmentUnitId] = useState(initialValues?.department_unit_id || "");
  const [department_unit_name, setDepartmentUnitName] = useState(initialValues?.department_unit_name || "");
  const [departments, setDepartments] = useState([]);
  const [units, setUnits] = useState([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [unitsLoading, setUnitsLoading] = useState(false);

  useEffect(() => {
    setDepartmentsLoading(true);
    list_departments()
      .then((response) => setDepartments(response.data || []))
      .finally(() => setDepartmentsLoading(false));
  }, []);

  // ProjectSettingsPage stays mounted across a project switch (only the
  // :project_id route param changes, not the matched route), so this form's
  // own state would otherwise keep showing whichever project it first mounted
  // with. Re-seeding only when the project's own id changes - not on every
  // background poll refresh of the SAME project - avoids that stale display
  // while still not wiping in-progress edits every few seconds.
  useEffect(() => {
    setName(initialValues?.name || "");
    setDescription(initialValues?.description || "");
    setDepartmentId(initialValues?.department_id || "");
    setDepartmentName(initialValues?.department_name || "");
    setDepartmentUnitId(initialValues?.department_unit_id || "");
    setDepartmentUnitName(initialValues?.department_unit_name || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues?._id]);

  useEffect(() => {
    if (!department_id) {
      setUnits([]);
      return;
    }
    setUnitsLoading(true);
    list_department_units(department_id)
      .then((response) => setUnits(response.data || []))
      .finally(() => setUnitsLoading(false));
  }, [department_id]);

  const handle_department_change = (selected_id) => {
    const selected_department = departments.find((department) => department.id === selected_id);
    setDepartmentId(selected_id);
    setDepartmentName(selected_department ? selected_department.name : "");
    setDepartmentUnitId("");
    setDepartmentUnitName("");
  };

  const handle_unit_change = (selected_id) => {
    const selected_unit = units.find((unit) => unit.id === selected_id);
    setDepartmentUnitId(selected_id);
    setDepartmentUnitName(selected_unit ? selected_unit.name : "");
  };

  const handle_submit = (event) => {
    event.preventDefault();
    onSave({
      name,
      description,
      department_id: department_id || null,
      department_name: department_name || null,
      department_unit_id: department_unit_id || null,
      department_unit_name: department_unit_name || null,
    });
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="cok-auth-label">
            {translate("DCS_FIELD_DEPARTMENT")} ({translate("DCS_FIELD_OPTIONAL")})
          </label>
          <DcsSearchableSelect
            options={departments}
            value={department_id}
            onChange={handle_department_change}
            placeholder={translate("DCS_FIELD_DEPARTMENT_PLACEHOLDER")}
            loading={departmentsLoading}
            allowClear
          />
        </div>
        <div>
          <label className="cok-auth-label">
            {translate("DCS_FIELD_DEPARTMENT_UNIT")} ({translate("DCS_FIELD_OPTIONAL")})
          </label>
          <DcsSearchableSelect
            options={units}
            value={department_unit_id}
            onChange={handle_unit_change}
            placeholder={translate("DCS_FIELD_DEPARTMENT_UNIT_PLACEHOLDER")}
            loading={unitsLoading}
            disabled={!department_id}
            allowClear
          />
        </div>
      </div>

      <DcsButtonPrimary type="submit" disabled={saving}>
        {translate(submitLabelKey || "DCS_BTN_SAVE_CONTINUE")}
      </DcsButtonPrimary>
    </form>
  );
}
