import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { list_departments, list_department_units } from "../services/departmentsService.js";
import { get_forms_by_project } from "../services/formsService.js";
import { get_project_access, save_project_access, check_access_email } from "../services/accessControlService.js";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsConfirmDialog from "../components/DcsConfirmDialog.jsx";
import DcsLoadingState from "../components/DcsLoadingState.jsx";
import DcsAccessFormScope from "../components/DcsAccessFormScope.jsx";
import DcsAccessLevelSelect from "../components/DcsAccessLevelSelect.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";

const PRIMARY = "#056daa";
const DANGER = "#E74C3C";

const heading_style = { fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 18, color: "#333333" };
const hint_style = { color: "#9E9E9E", fontSize: 13 };

// Section buttons on a solid primary-blue bar; the active one is solid white on blue.
const section_tab_style = (is_active) => ({
  fontFamily: "'Montserrat', sans-serif",
  fontSize: 13,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  padding: "0.55rem 1rem",
  color: is_active ? PRIMARY : "#FFFFFF",
  backgroundColor: is_active ? "#FFFFFF" : "transparent",
  border: is_active ? "1px solid #FFFFFF" : "1px solid rgba(255,255,255,0.5)",
  cursor: "pointer",
});

/**
 * Project access-control tab: restrict who may view this project - whole
 * departments (optionally narrowed to units), or individuals added by their
 * account email - and which of the project's forms each grant exposes.
 */
export default function ProjectAccessControlPage() {
  const { project } = useOutletContext();
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [department_grants, setDepartmentGrants] = useState([]);
  const [individuals, setIndividuals] = useState([]);

  const [departments, setDepartments] = useState([]);
  const [forms, setForms] = useState([]);
  const [units_by_department, setUnitsByDepartment] = useState({});
  const [department_search, setDepartmentSearch] = useState("");
  const [unit_search, setUnitSearch] = useState({});

  const [email, setEmail] = useState("");
  const [checking_email, setCheckingEmail] = useState(false);
  const [email_error, setEmailError] = useState("");

  const [saving, setSaving] = useState(false);
  const [is_confirming_empty, setIsConfirmingEmpty] = useState(false);
  const [active_section, setActiveSection] = useState("departments");

  useEffect(() => {
    let is_mounted = true;
    setLoading(true);
    Promise.all([
      get_project_access(project._id),
      list_departments(),
      get_forms_by_project(project._id),
    ])
      .then(([access_response, departments_response, forms_response]) => {
        if (!is_mounted) return;
        const rules = access_response.data || {};
        setEnabled(rules.enabled === true);
        setDepartmentGrants(rules.departments || []);
        setIndividuals(rules.individuals || []);
        setDepartments(departments_response.data || []);
        setForms(forms_response.data || []);
      })
      .catch((error) => {
        if (!is_mounted) return;
        // A 403 means this viewer has plain access without the grant option.
        if (error.status_code === 403) setForbidden(true);
        else showError(error.message || translate("DCS_ERROR_GENERIC"));
      })
      .finally(() => is_mounted && setLoading(false));
    return () => {
      is_mounted = false;
    };
  }, [project._id]);

  // Units of every granted department are fetched lazily (and only once),
  // covering both freshly ticked departments and grants restored from a save.
  useEffect(() => {
    department_grants.forEach((grant) => load_units(grant.department_id));
  }, [department_grants]);

  const load_units = (department_id) => {
    if (units_by_department[department_id]) return;
    setUnitsByDepartment((previous) => ({ ...previous, [department_id]: { loading: true, units: [] } }));
    list_department_units(department_id)
      .then((response) =>
        setUnitsByDepartment((previous) => ({ ...previous, [department_id]: { loading: false, units: response.data || [] } })),
      )
      .catch(() => setUnitsByDepartment((previous) => ({ ...previous, [department_id]: { loading: false, units: [] } })));
  };

  const find_grant = (department_id) => department_grants.find((grant) => grant.department_id === department_id);

  const toggle_department = (department) => {
    if (find_grant(department.id)) {
      setDepartmentGrants(department_grants.filter((grant) => grant.department_id !== department.id));
      return;
    }
    setDepartmentGrants([
      ...department_grants,
      { department_id: department.id, department_name: department.name, all_units: true, units: [], all_forms: true, form_group_ids: [] },
    ]);
  };

  const update_grant = (department_id, changes) => {
    setDepartmentGrants(
      department_grants.map((grant) => (grant.department_id === department_id ? { ...grant, ...changes } : grant)),
    );
  };

  const toggle_unit = (grant, unit) => {
    const is_selected = grant.units.some((selected) => selected.unit_id === unit.id);
    const units = is_selected
      ? grant.units.filter((selected) => selected.unit_id !== unit.id)
      : [...grant.units, { unit_id: unit.id, unit_name: unit.name }];
    update_grant(grant.department_id, { all_units: false, units });
  };

  const handle_add_individual = async (event) => {
    event.preventDefault();
    const cleaned_email = email.trim().toLowerCase();
    if (!cleaned_email) return;
    if (individuals.some((individual) => individual.email.toLowerCase() === cleaned_email)) {
      setEmailError(translate("DCS_ACCESS_EMAIL_DUPLICATE"));
      return;
    }
    setEmailError("");
    setCheckingEmail(true);
    try {
      const response = await check_access_email(cleaned_email);
      const user = response.data;
      setIndividuals([
        ...individuals,
        { user_id: user.user_id, email: user.email, full_name: user.full_name, can_grant: false, all_forms: true, form_group_ids: [] },
      ]);
      setEmail("");
      showSuccess(translate("DCS_ACCESS_EMAIL_ADDED", { name: user.full_name || user.email }));
    } catch (error) {
      setEmailError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setCheckingEmail(false);
    }
  };

  const update_individual = (user_id, changes) => {
    setIndividuals(individuals.map((individual) => (individual.user_id === user_id ? { ...individual, ...changes } : individual)));
  };

  const do_save = async () => {
    setSaving(true);
    try {
      await save_project_access(project._id, { enabled, departments: department_grants, individuals });
      showSuccess(translate("DCS_TOAST_ACCESS_SAVED"));
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setSaving(false);
      setIsConfirmingEmpty(false);
    }
  };

  const handle_save = () => {
    if (enabled && department_grants.length === 0 && individuals.length === 0) {
      setIsConfirmingEmpty(true);
      return;
    }
    do_save();
  };

  if (loading) return <DcsLoadingState />;

  if (forbidden) {
    return (
      <div className="bg-white border-2 p-4 sm:p-6" style={{ borderColor: "#E0E0E0" }}>
        <h2 style={heading_style}>{translate("DCS_SECTION_ACCESS_CONTROL")}</h2>
        <p className="mt-2 text-sm" style={{ color: "#333333" }}>
          {translate("DCS_ACCESS_MANAGE_FORBIDDEN")}
        </p>
      </div>
    );
  }

  const filtered_departments = departments.filter((department) =>
    department.name.toLowerCase().includes(department_search.toLowerCase()),
  );

  return (
    <div className="pb-16 space-y-4">
      <div className="bg-white border-2 p-4 sm:p-6" style={{ borderColor: "#E0E0E0" }}>
        <h2 style={heading_style}>{translate("DCS_SECTION_ACCESS_CONTROL")}</h2>
        <label className="flex items-start gap-2 text-sm mt-3" style={{ color: "#333333" }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            style={{ accentColor: PRIMARY, marginTop: 2 }}
          />
          <span className="font-semibold">{translate("DCS_ACCESS_ENABLE_LABEL")}</span>
        </label>
        <p className="mt-2" style={hint_style}>
          {enabled ? translate("DCS_ACCESS_ENABLED_HINT") : translate("DCS_ACCESS_DISABLED_HINT")}
        </p>
      </div>

      {enabled && (
        <>
          <div className="flex flex-wrap gap-2 p-2" style={{ backgroundColor: PRIMARY }}>
            <button type="button" style={section_tab_style(active_section === "departments")} onClick={() => setActiveSection("departments")}>
              {translate("DCS_ACCESS_DEPARTMENTS_TITLE")}
              {department_grants.length > 0 && ` (${department_grants.length})`}
            </button>
            <button type="button" style={section_tab_style(active_section === "individuals")} onClick={() => setActiveSection("individuals")}>
              {translate("DCS_ACCESS_INDIVIDUALS_TITLE")}
              {individuals.length > 0 && ` (${individuals.length})`}
            </button>
          </div>

          {active_section === "departments" && (
          <div className="bg-white border-2 p-4 sm:p-6" style={{ borderColor: "#E0E0E0" }}>
            <p className="mb-3" style={hint_style}>
              {translate("DCS_ACCESS_DEPARTMENTS_HINT")}
            </p>

            <input
              className="cok-auth-input w-full py-3 mb-3"
              placeholder={translate("DCS_ACCESS_SEARCH_DEPARTMENTS")}
              value={department_search}
              onChange={(event) => setDepartmentSearch(event.target.value)}
            />

            <div className="space-y-1 max-h-96 overflow-y-auto">
              {filtered_departments.length === 0 && (
                <p className="text-sm" style={{ color: "#9E9E9E" }}>
                  {translate("DCS_SEARCH_NO_RESULTS")}
                </p>
              )}
              {filtered_departments.map((department) => {
                const grant = find_grant(department.id);
                const unit_state = units_by_department[department.id];
                const unit_query = unit_search[department.id] || "";
                const filtered_units = (unit_state?.units || []).filter((unit) =>
                  unit.name.toLowerCase().includes(unit_query.toLowerCase()),
                );
                return (
                  <div key={department.id}>
                    <label className="flex items-start gap-2 text-sm py-1" style={{ color: "#333333" }}>
                      <input
                        type="checkbox"
                        checked={!!grant}
                        onChange={() => toggle_department(department)}
                        style={{ accentColor: PRIMARY, marginTop: 2 }}
                      />
                      <span className="font-medium">{department.name}</span>
                    </label>

                    {grant && (
                      <div className="ml-5 mb-3 border-l-2 pl-4 space-y-3" style={{ borderColor: "#E0E0E0" }}>
                        <div>
                          <p className="text-xs font-semibold uppercase mb-1" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.5px" }}>
                            {translate("DCS_ACCESS_UNITS_LABEL")}
                          </p>
                          <label className="flex items-start gap-2 text-sm mb-1" style={{ color: "#333333" }}>
                            <input
                              type="checkbox"
                              checked={grant.all_units}
                              onChange={(event) => update_grant(grant.department_id, { all_units: event.target.checked, units: [] })}
                              style={{ accentColor: PRIMARY, marginTop: 2 }}
                            />
                            <span>{translate("DCS_ACCESS_ALL_UNITS")}</span>
                          </label>

                          {!grant.all_units && (
                            <div className="pl-5 space-y-1">
                              {unit_state?.loading && <SpiralLoader />}
                              {unit_state && !unit_state.loading && unit_state.units.length === 0 && (
                                <p className="text-sm" style={{ color: "#9E9E9E" }}>
                                  {translate("DCS_ACCESS_NO_UNITS")}
                                </p>
                              )}
                              {unit_state && !unit_state.loading && unit_state.units.length > 6 && (
                                <input
                                  className="cok-auth-input w-full py-2 mb-1"
                                  placeholder={translate("DCS_ACCESS_SEARCH_UNITS")}
                                  value={unit_query}
                                  onChange={(event) =>
                                    setUnitSearch((previous) => ({ ...previous, [department.id]: event.target.value }))
                                  }
                                />
                              )}
                              {filtered_units.map((unit) => (
                                <label key={unit.id} className="flex items-start gap-2 text-sm" style={{ color: "#333333" }}>
                                  <input
                                    type="checkbox"
                                    checked={grant.units.some((selected) => selected.unit_id === unit.id)}
                                    onChange={() => toggle_unit(grant, unit)}
                                    style={{ accentColor: PRIMARY, marginTop: 2 }}
                                  />
                                  <span>{unit.name}</span>
                                </label>
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
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          )}

          {active_section === "individuals" && (
          <div className="bg-white border-2 p-4 sm:p-6" style={{ borderColor: "#E0E0E0" }}>
            <p className="mb-3" style={hint_style}>
              {translate("DCS_ACCESS_INDIVIDUALS_HINT")}
            </p>

            <form onSubmit={handle_add_individual} className="mb-4">
              <label className="cok-auth-label">{translate("DCS_ACCESS_EMAIL_LABEL")}</label>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-stretch">
                <input
                  type="email"
                  className="cok-auth-input w-full sm:flex-1 py-3"
                  placeholder={translate("DCS_ACCESS_EMAIL_PLACEHOLDER")}
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setEmailError("");
                  }}
                  disabled={checking_email}
                  required
                />
                {/* cok-btn-primary is width:100% outside Tailwind's layers, so the button is sized by this wrapper */}
                <div className="w-full sm:w-44 sm:flex-shrink-0">
                  <DcsButtonPrimary type="submit" disabled={checking_email || !email.trim()} style={{ height: "100%" }}>
                    {checking_email ? translate("DCS_ACCESS_CHECKING_EMAIL") : translate("DCS_BTN_ADD")}
                  </DcsButtonPrimary>
                </div>
              </div>
              {email_error && (
                <p className="text-xs mt-1" style={{ color: DANGER }}>
                  {email_error}
                </p>
              )}
            </form>

            {individuals.length === 0 && (
              <p className="text-sm" style={{ color: "#9E9E9E" }}>
                {translate("DCS_ACCESS_NO_INDIVIDUALS")}
              </p>
            )}

            <div className="space-y-3">
              {individuals.map((individual) => (
                <div key={individual.user_id} className="border-2 p-3" style={{ borderColor: "#E0E0E0" }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
                        {individual.full_name || individual.email}
                        {individual.can_grant === true && (
                          <span
                            className="ml-2 align-middle text-xs font-semibold uppercase px-2 py-0.5"
                            style={{ color: "#FFFFFF", backgroundColor: PRIMARY, fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.5px" }}
                          >
                            {translate("DCS_ACCESS_GRANT_BADGE")}
                          </span>
                        )}
                      </p>
                      <p className="text-xs truncate" style={{ color: "#9E9E9E" }}>
                        {individual.email}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIndividuals(individuals.filter((selected) => selected.user_id !== individual.user_id))}
                      className="text-xs font-semibold uppercase flex-shrink-0"
                      style={{ color: DANGER, fontFamily: "'Montserrat', sans-serif" }}
                    >
                      {translate("DCS_SETTINGS_REMOVE")}
                    </button>
                  </div>
                  <div className="space-y-3">
                    <DcsAccessLevelSelect
                      canGrant={individual.can_grant === true}
                      onChange={(can_grant) => update_individual(individual.user_id, { can_grant })}
                    />
                    <DcsAccessFormScope
                      forms={forms}
                      allForms={individual.all_forms}
                      formGroupIds={individual.form_group_ids}
                      onChange={(changes) => update_individual(individual.user_id, changes)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}
        </>
      )}

      <div className="flex justify-end">
        <DcsButtonPrimary className="w-full sm:w-auto" onClick={handle_save} disabled={saving}>
          {saving ? translate("DCS_ACCESS_SAVING") : translate("DCS_BTN_SAVE_ACCESS")}
        </DcsButtonPrimary>
      </div>

      {is_confirming_empty && (
        <DcsConfirmDialog
          titleKey="DCS_ACCESS_CONFIRM_EMPTY_TITLE"
          messageKey="DCS_ACCESS_CONFIRM_EMPTY_MESSAGE"
          confirming={saving}
          onConfirm={do_save}
          onCancel={() => setIsConfirmingEmpty(false)}
        />
      )}
    </div>
  );
}
