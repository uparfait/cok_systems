import React, { useState, useEffect } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { list_departments, list_department_units } from "../services/departmentsService.js";
import DcsButtonPrimary from "./DcsButtonPrimary.jsx";
import DcsSearchableSelect from "./DcsSearchableSelect.jsx";
import DcsAccessFormScope from "./DcsAccessFormScope.jsx";
import DcsGrantPermissionsSelect from "./DcsGrantPermissionsSelect.jsx";

const EMPTY_MANAGE = { add_forms: false, edit_forms: false, delete_forms: false, share_forms: false };

const PRIMARY = "#056daa";
const PRIMARY_TINT = "#F0F7FB";
const DANGER = "#E74C3C";

const label_style = { color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.5px" };

/**
 * Department access selection: the same searchable department/unit selects
 * used when assigning a project to a department. Pick a department (and
 * optionally one unit) then add it as a grant; each granted department is
 * listed as a card where units and form scope can be adjusted or removed.
 */
export default function DcsAccessDepartmentSelect({ grants, onChange, forms }) {
  const { translate } = useDcsLanguage();
  const [departments, setDepartments] = useState([]);
  const [units, setUnits] = useState([]);
  const [departments_loading, setDepartmentsLoading] = useState(false);
  const [units_loading, setUnitsLoading] = useState(false);
  const [department_id, setDepartmentId] = useState("");
  const [unit_id, setUnitId] = useState("");

  useEffect(() => {
    setDepartmentsLoading(true);
    list_departments()
      .then((response) => setDepartments(response.data || []))
      .finally(() => setDepartmentsLoading(false));
  }, []);

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
    setDepartmentId(selected_id);
    setUnitId("");
  };

  const update_grant = (grant_department_id, changes) => {
    onChange(grants.map((grant) => (grant.department_id === grant_department_id ? { ...grant, ...changes } : grant)));
  };

  const handle_add = () => {
    const department = departments.find((option) => option.id === department_id);
    if (!department) return;
    const unit = units.find((option) => option.id === unit_id);
    const existing = grants.find((grant) => grant.department_id === department_id);

    if (!existing) {
      onChange([
        ...grants,
        {
          department_id: department.id,
          department_name: department.name,
          all_units: !unit,
          units: unit ? [{ unit_id: unit.id, unit_name: unit.name }] : [],
          all_forms: true,
          form_group_ids: [],
          manage: { ...EMPTY_MANAGE },
        },
      ]);
    } else if (!unit) {
      update_grant(department.id, { all_units: true, units: [] });
    } else if (existing.all_units || !existing.units.some((selected) => selected.unit_id === unit.id)) {
      // Adding a unit to an all-units grant narrows it down to that unit only.
      update_grant(department.id, {
        all_units: false,
        units: existing.all_units ? [{ unit_id: unit.id, unit_name: unit.name }] : [...existing.units, { unit_id: unit.id, unit_name: unit.name }],
      });
    }
    setUnitId("");
  };

  const remove_unit = (grant, unit_to_remove) => {
    const units_left = grant.units.filter((selected) => selected.unit_id !== unit_to_remove.unit_id);
    // With no unit left the grant falls back to the whole department.
    update_grant(grant.department_id, { all_units: units_left.length === 0, units: units_left });
  };

  const remove_grant = (grant) => {
    onChange(grants.filter((selected) => selected.department_id !== grant.department_id));
  };

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="cok-auth-label">{translate("DCS_FIELD_DEPARTMENT")}</label>
          <DcsSearchableSelect
            options={departments}
            value={department_id}
            onChange={handle_department_change}
            placeholder={translate("DCS_FIELD_DEPARTMENT_PLACEHOLDER")}
            loading={departments_loading}
            allowClear
          />
        </div>
        <div>
          <label className="cok-auth-label">
            {translate("DCS_FIELD_DEPARTMENT_UNIT")} ({translate("DCS_FIELD_OPTIONAL")})
          </label>
          <DcsSearchableSelect
            options={units}
            value={unit_id}
            onChange={setUnitId}
            placeholder={translate("DCS_FIELD_DEPARTMENT_UNIT_PLACEHOLDER")}
            loading={units_loading}
            disabled={!department_id}
            allowClear
          />
        </div>
      </div>

      {/* cok-btn-primary is width:100% outside Tailwind's layers, so the button is sized by this wrapper */}
      <div className="w-full sm:w-44 mt-3 mb-4">
        <DcsButtonPrimary type="button" onClick={handle_add} disabled={!department_id}>
          {translate("DCS_BTN_ADD")}
        </DcsButtonPrimary>
      </div>

      {grants.length === 0 && (
        <p className="text-sm" style={{ color: "#9E9E9E" }}>
          {translate("DCS_ACCESS_NO_DEPARTMENTS")}
        </p>
      )}

      <div className="space-y-3">
        {grants.map((grant) => (
          <div key={grant.department_id} className="border-2 p-3" style={{ borderColor: "#E0E0E0" }}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-sm font-semibold truncate" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
                {grant.department_name}
                {grant.manage?.share_forms === true && (
                  <span
                    className="ml-2 align-middle text-xs font-semibold uppercase px-2 py-0.5"
                    style={{ color: "#FFFFFF", backgroundColor: PRIMARY, fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.5px" }}
                  >
                    {translate("DCS_ACCESS_GRANT_BADGE")}
                  </span>
                )}
              </p>
              <button
                type="button"
                onClick={() => remove_grant(grant)}
                className="text-xs font-semibold uppercase flex-shrink-0"
                style={{ color: DANGER, fontFamily: "'Montserrat', sans-serif" }}
              >
                {translate("DCS_SETTINGS_REMOVE")}
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase mb-1" style={label_style}>
                  {translate("DCS_ACCESS_UNITS_LABEL")}
                </p>
                {grant.all_units ? (
                  <p className="text-sm" style={{ color: "#333333" }}>
                    {translate("DCS_ACCESS_ALL_UNITS")}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {grant.units.map((unit) => (
                      <span
                        key={unit.unit_id}
                        className="inline-flex items-center gap-2 text-xs font-semibold px-2 py-1"
                        style={{ color: PRIMARY, backgroundColor: PRIMARY_TINT, border: `1px solid ${PRIMARY}` }}
                      >
                        {unit.unit_name}
                        <button
                          type="button"
                          onClick={() => remove_unit(grant, unit)}
                          aria-label={translate("DCS_SETTINGS_REMOVE")}
                          className="leading-none"
                          style={{ color: PRIMARY, fontSize: 14 }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <DcsAccessFormScope
                forms={forms}
                allForms={grant.all_forms}
                formGroupIds={grant.form_group_ids}
                onChange={(changes) => update_grant(grant.department_id, changes)}
              />

              <DcsGrantPermissionsSelect
                isProjectScope={grant.all_forms === true}
                manage={grant.manage}
                onChange={(manage) => update_grant(grant.department_id, { manage })}
                labelKey="DCS_ACCESS_MANAGE_DEPT_LABEL"
                hintKey="DCS_ACCESS_MANAGE_DEPT_HINT"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
