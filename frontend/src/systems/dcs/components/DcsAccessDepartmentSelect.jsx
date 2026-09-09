import React, { useState, useEffect } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { list_departments, list_department_units } from "../services/departmentsService.js";
import DcsButtonPrimary from "./DcsButtonPrimary.jsx";
import DcsButtonOutline from "./DcsButtonOutline.jsx";
import DcsSearchableSelect from "./DcsSearchableSelect.jsx";
import DcsAccessFormScope from "./DcsAccessFormScope.jsx";
import DcsGrantPermissionsSelect from "./DcsGrantPermissionsSelect.jsx";

const EMPTY_MANAGE = { add_forms: false, edit_forms: false, delete_forms: false, share_forms: false, edit_project: false };

const PRIMARY = "#056daa";
const PRIMARY_TINT = "#F0F7FB";
const DANGER = "#E74C3C";

const label_style = { color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.5px" };

/**
 * Unit editor shown inside one granted department's card while it is being
 * edited: pick units of THAT department to add, or fall back to covering
 * every unit. Loads the department's units on its own so editing one grant
 * never depends on what the add panel last selected.
 */
function GrantUnitsEditor({ grant, onUpdate }) {
  const { translate } = useDcsLanguage();
  const [units, setUnits] = useState([]);
  const [units_loading, setUnitsLoading] = useState(false);
  const [unit_id, setUnitId] = useState("");

  useEffect(() => {
    setUnitsLoading(true);
    list_department_units(grant.department_id)
      .then((response) => setUnits(response.data || []))
      .finally(() => setUnitsLoading(false));
  }, [grant.department_id]);

  const handle_add_unit = () => {
    const unit = units.find((option) => option.id === unit_id);
    if (!unit) return;
    if (!grant.all_units && grant.units.some((selected) => selected.unit_id === unit.id)) {
      setUnitId("");
      return;
    }
    // Adding a unit to an all-units grant narrows it down to that unit only.
    onUpdate({
      all_units: false,
      units: grant.all_units ? [{ unit_id: unit.id, unit_name: unit.name }] : [...grant.units, { unit_id: unit.id, unit_name: unit.name }],
    });
    setUnitId("");
  };

  const selectable_units = grant.all_units
    ? units
    : units.filter((option) => !grant.units.some((selected) => selected.unit_id === option.id));

  return (
    <div className="border-2 p-3 mt-2" style={{ borderColor: PRIMARY, backgroundColor: PRIMARY_TINT }}>
      <p className="text-xs font-semibold uppercase mb-2" style={label_style}>
        {translate("DCS_ACCESS_EDIT_UNITS")}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
        <div>
          <label className="cok-auth-label">{translate("DCS_FIELD_DEPARTMENT_UNIT")}</label>
          <DcsSearchableSelect
            options={selectable_units}
            value={unit_id}
            onChange={setUnitId}
            placeholder={translate("DCS_FIELD_DEPARTMENT_UNIT_PLACEHOLDER")}
            loading={units_loading}
            allowClear
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {/* cok-btn-primary is width:100% outside Tailwind's layers, so the buttons are sized by these wrappers */}
          <div className="w-full sm:w-40">
            <DcsButtonPrimary type="button" onClick={handle_add_unit} disabled={!unit_id}>
              {translate("DCS_ACCESS_ADD_UNIT")}
            </DcsButtonPrimary>
          </div>
          {!grant.all_units && (
            <div className="w-full sm:w-40">
              <DcsButtonOutline type="button" onClick={() => onUpdate({ all_units: true, units: [] })}>
                {translate("DCS_ACCESS_COVER_ALL_UNITS")}
              </DcsButtonOutline>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Department access grants. Adding a department is an explicit, separate
 * flow behind its own button - the pickers only appear while adding, so
 * granting a NEW department can never look like changing an existing one.
 * Each granted department is a card that can be edited in place (its units,
 * form scope and permissions) or removed outright.
 */
export default function DcsAccessDepartmentSelect({ grants, onChange, forms }) {
  const { translate } = useDcsLanguage();
  const [departments, setDepartments] = useState([]);
  const [units, setUnits] = useState([]);
  const [departments_loading, setDepartmentsLoading] = useState(false);
  const [units_loading, setUnitsLoading] = useState(false);
  const [department_id, setDepartmentId] = useState("");
  const [unit_id, setUnitId] = useState("");
  const [adding, setAdding] = useState(false);
  const [add_error, setAddError] = useState("");
  const [editing_department_id, setEditingDepartmentId] = useState(null);

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
    setAddError("");
  };

  const update_grant = (grant_department_id, changes) => {
    onChange(grants.map((grant) => (grant.department_id === grant_department_id ? { ...grant, ...changes } : grant)));
  };

  const close_add_panel = () => {
    setAdding(false);
    setDepartmentId("");
    setUnitId("");
    setAddError("");
  };

  const handle_add = () => {
    const department = departments.find((option) => option.id === department_id);
    if (!department) return;
    // A department that is already granted is never silently changed from
    // here - it is edited on its own card below instead.
    if (grants.some((grant) => grant.department_id === department_id)) {
      setAddError(translate("DCS_ACCESS_DEPT_ALREADY_ADDED"));
      setEditingDepartmentId(department_id);
      return;
    }
    const unit = units.find((option) => option.id === unit_id);
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
    close_add_panel();
  };

  const remove_unit = (grant, unit_to_remove) => {
    const units_left = grant.units.filter((selected) => selected.unit_id !== unit_to_remove.unit_id);
    // With no unit left the grant falls back to the whole department.
    update_grant(grant.department_id, { all_units: units_left.length === 0, units: units_left });
  };

  const remove_grant = (grant) => {
    if (editing_department_id === grant.department_id) setEditingDepartmentId(null);
    onChange(grants.filter((selected) => selected.department_id !== grant.department_id));
  };

  return (
    <div>
      {!adding ? (
        // cok-btn-primary is width:100% outside Tailwind's layers, so the button is sized by this wrapper
        <div className="w-full sm:w-56 mb-4">
          <DcsButtonPrimary type="button" onClick={() => setAdding(true)}>
            {translate("DCS_BTN_ADD_DEPARTMENT")}
          </DcsButtonPrimary>
        </div>
      ) : (
        <div className="border-2 p-3 sm:p-4 mb-4" style={{ borderColor: PRIMARY }}>
          <p className="text-xs font-semibold uppercase mb-3" style={label_style}>
            {translate("DCS_BTN_ADD_DEPARTMENT")}
          </p>
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
          {add_error && (
            <p className="text-xs mt-2" style={{ color: DANGER }}>
              {add_error}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            <div className="w-full sm:w-44">
              <DcsButtonPrimary type="button" onClick={handle_add} disabled={!department_id}>
                {translate("DCS_BTN_ADD")}
              </DcsButtonPrimary>
            </div>
            <div className="w-full sm:w-44">
              <DcsButtonOutline type="button" onClick={close_add_panel}>
                {translate("DCS_BTN_CANCEL")}
              </DcsButtonOutline>
            </div>
          </div>
        </div>
      )}

      {grants.length === 0 && (
        <p className="text-sm" style={{ color: "#9E9E9E" }}>
          {translate("DCS_ACCESS_NO_DEPARTMENTS")}
        </p>
      )}

      <div className="space-y-3">
        {grants.map((grant) => {
          const is_editing = editing_department_id === grant.department_id;
          return (
            <div key={grant.department_id} className="border-2 p-3" style={{ borderColor: is_editing ? PRIMARY : "#E0E0E0" }}>
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
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditingDepartmentId(is_editing ? null : grant.department_id)}
                    className="text-xs font-semibold uppercase"
                    style={{ color: PRIMARY, fontFamily: "'Montserrat', sans-serif" }}
                  >
                    {is_editing ? translate("DCS_ACCESS_DONE_EDITING") : translate("DCS_ACCESS_EDIT")}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove_grant(grant)}
                    className="text-xs font-semibold uppercase"
                    style={{ color: DANGER, fontFamily: "'Montserrat', sans-serif" }}
                  >
                    {translate("DCS_SETTINGS_REMOVE")}
                  </button>
                </div>
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
                          {is_editing && (
                            <button
                              type="button"
                              onClick={() => remove_unit(grant, unit)}
                              aria-label={translate("DCS_SETTINGS_REMOVE")}
                              className="leading-none"
                              style={{ color: PRIMARY, fontSize: 14 }}
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                  {is_editing && (
                    <GrantUnitsEditor grant={grant} onUpdate={(changes) => update_grant(grant.department_id, changes)} />
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
          );
        })}
      </div>
    </div>
  );
}
