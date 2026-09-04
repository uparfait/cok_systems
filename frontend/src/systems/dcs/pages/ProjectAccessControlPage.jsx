import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { get_forms_by_project } from "../services/formsService.js";
import { get_project_access, save_project_access, check_access_email, suggest_access_users } from "../services/accessControlService.js";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsConfirmDialog from "../components/DcsConfirmDialog.jsx";
import DcsLoadingState from "../components/DcsLoadingState.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";
import DcsAccessFormScope from "../components/DcsAccessFormScope.jsx";
import DcsAccessDepartmentSelect from "../components/DcsAccessDepartmentSelect.jsx";
import DcsGrantPermissionsSelect from "../components/DcsGrantPermissionsSelect.jsx";

const PRIMARY = "#056daa";
const DANGER = "#E74C3C";

const heading_style = { fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 18, color: "#333333" };
const hint_style = { color: "#9E9E9E", fontSize: 13 };

const EMPTY_MANAGE = { add_forms: false, edit_forms: false, delete_forms: false, share_forms: false, edit_project: false };

// Text shaped like a full address is added directly; anything else searches for matching accounts.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Grants saved before the manage object existed only carry can_grant.
const normalize_individual = (individual) => ({
  ...individual,
  manage: individual.manage || { ...EMPTY_MANAGE, share_forms: individual.can_grant === true },
});

// Department grants saved before they could carry management actions.
const normalize_department = (grant) => ({ ...grant, manage: grant.manage || { ...EMPTY_MANAGE } });

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

  const [forms, setForms] = useState([]);

  const [email, setEmail] = useState("");
  const [checking_email, setCheckingEmail] = useState(false);
  const [email_error, setEmailError] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searching_suggestions, setSearchingSuggestions] = useState(false);
  const [no_matches, setNoMatches] = useState(false);

  const [saving, setSaving] = useState(false);
  const [individual_to_remove, setIndividualToRemove] = useState(null);
  const [active_section, setActiveSection] = useState("departments");

  useEffect(() => {
    let is_mounted = true;
    setLoading(true);
    Promise.all([
      get_project_access(project._id),
      get_forms_by_project(project._id),
    ])
      .then(([access_response, forms_response]) => {
        if (!is_mounted) return;
        const rules = access_response.data || {};
        setEnabled(rules.enabled === true);
        setDepartmentGrants((rules.departments || []).map(normalize_department));
        setIndividuals((rules.individuals || []).map(normalize_individual));
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

  // Suggests existing accounts matching the typed name or email, debounced so we don't query on every keystroke.
  useEffect(() => {
    const typed = email.trim();
    if (typed.length < 2) {
      setSuggestions([]);
      setSearchingSuggestions(false);
      setNoMatches(false);
      return;
    }
    let is_current = true;
    const timer = setTimeout(() => {
      setSearchingSuggestions(true);
      suggest_access_users(typed)
        .then((response) => {
          if (!is_current) return;
          const already_added = new Set(individuals.map((individual) => individual.email.toLowerCase()));
          const matches = (response.data || []).filter((user) => !already_added.has(user.email.toLowerCase()));
          setSuggestions(matches);
          setNoMatches(matches.length === 0);
        })
        .catch(() => is_current && setSuggestions([]))
        .finally(() => is_current && setSearchingSuggestions(false));
    }, 300);
    return () => {
      is_current = false;
      clearTimeout(timer);
    };
  }, [email, individuals]);

  // Immediate search used when Enter is pressed with a partial name or email.
  const run_suggestion_search = async (typed) => {
    setSearchingSuggestions(true);
    setNoMatches(false);
    try {
      const response = await suggest_access_users(typed);
      const already_added = new Set(individuals.map((individual) => individual.email.toLowerCase()));
      const matches = (response.data || []).filter((user) => !already_added.has(user.email.toLowerCase()));
      setSuggestions(matches);
      setNoMatches(matches.length === 0);
    } catch (error) {
      setSuggestions([]);
      setEmailError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setSearchingSuggestions(false);
    }
  };

  const add_individual_grant = (user) => {
    setIndividuals((current) => [
      ...current,
      { user_id: user.user_id, email: user.email, full_name: user.full_name, manage: { ...EMPTY_MANAGE }, all_forms: true, form_group_ids: [] },
    ]);
    setEmail("");
    setSuggestions([]);
    setEmailError("");
    showSuccess(translate("DCS_ACCESS_EMAIL_ADDED", { name: user.full_name || user.email }));
  };

  const handle_pick_suggestion = (user) => {
    if (individuals.some((individual) => individual.email.toLowerCase() === user.email.toLowerCase())) {
      setEmailError(translate("DCS_ACCESS_EMAIL_DUPLICATE"));
      return;
    }
    add_individual_grant(user);
  };

  const handle_add_individual = async (event) => {
    event.preventDefault();
    const cleaned_email = email.trim().toLowerCase();
    if (!cleaned_email) return;
    // Partial text is a search, not an add - only a full email is checked against the system directly.
    if (!EMAIL_SHAPE.test(cleaned_email)) {
      run_suggestion_search(cleaned_email);
      return;
    }
    if (individuals.some((individual) => individual.email.toLowerCase() === cleaned_email)) {
      setEmailError(translate("DCS_ACCESS_EMAIL_DUPLICATE"));
      return;
    }
    setEmailError("");
    setCheckingEmail(true);
    try {
      const response = await check_access_email(cleaned_email);
      add_individual_grant(response.data);
    } catch (error) {
      setEmailError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setCheckingEmail(false);
    }
  };

  const update_individual = (user_id, changes) => {
    setIndividuals(individuals.map((individual) => (individual.user_id === user_id ? { ...individual, ...changes } : individual)));
  };

  const handle_save = async () => {
    setSaving(true);
    try {
      await save_project_access(project._id, { enabled, departments: department_grants, individuals });
      showSuccess(translate("DCS_TOAST_ACCESS_SAVED"));
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setSaving(false);
    }
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

            <DcsAccessDepartmentSelect grants={department_grants} onChange={setDepartmentGrants} forms={forms} />
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
                <div className="relative w-full sm:flex-1">
                  <input
                    type="text"
                    className="cok-auth-input w-full py-3"
                    placeholder={translate("DCS_ACCESS_EMAIL_PLACEHOLDER")}
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setEmailError("");
                      setNoMatches(false);
                    }}
                    onBlur={() => {
                      setSuggestions([]);
                      setNoMatches(false);
                    }}
                    disabled={checking_email}
                    required
                  />
                  {(searching_suggestions || suggestions.length > 0 || no_matches) && (
                    <div
                      className="absolute left-0 right-0 z-10 bg-white border-2 shadow-lg"
                      style={{ borderColor: "#E0E0E0", top: "100%" }}
                    >
                      {searching_suggestions ? (
                        <SpiralLoader />
                      ) : suggestions.length > 0 ? (
                        <>
                          <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.5px" }}>
                            {translate("DCS_ACCESS_SUGGESTIONS_LABEL")}
                          </p>
                          {suggestions.map((user) => (
                            <button
                              key={user.user_id}
                              type="button"
                              className="w-full text-left px-3 py-2 hover:bg-gray-50"
                              // onMouseDown so the pick lands before the input's blur clears the list
                              onMouseDown={(event) => {
                                event.preventDefault();
                                handle_pick_suggestion(user);
                              }}
                            >
                              <span className="block text-sm font-semibold truncate" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
                                {user.full_name || user.email}
                              </span>
                              <span className="block text-xs truncate" style={{ color: "#9E9E9E" }}>
                                {user.email}
                              </span>
                            </button>
                          ))}
                        </>
                      ) : (
                        <p className="px-3 py-3 text-sm" style={{ color: "#9E9E9E" }}>
                          {translate("DCS_SEARCH_NO_RESULTS")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
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
                        {individual.manage?.share_forms === true && (
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
                      onClick={() => setIndividualToRemove(individual)}
                      className="text-xs font-semibold uppercase flex-shrink-0"
                      style={{ color: DANGER, fontFamily: "'Montserrat', sans-serif" }}
                    >
                      {translate("DCS_SETTINGS_REMOVE")}
                    </button>
                  </div>
                  <div className="space-y-3">
                    <DcsAccessFormScope
                      forms={forms}
                      allForms={individual.all_forms}
                      formGroupIds={individual.form_group_ids}
                      onChange={(changes) => update_individual(individual.user_id, changes)}
                    />
                    <DcsGrantPermissionsSelect
                      isProjectScope={individual.all_forms === true}
                      manage={individual.manage}
                      onChange={(manage) => update_individual(individual.user_id, { manage })}
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

      {individual_to_remove && (
        <DcsConfirmDialog
          titleKey="DCS_ACCESS_CONFIRM_REMOVE_TITLE"
          messageKey="DCS_ACCESS_CONFIRM_REMOVE_MESSAGE"
          onConfirm={() => {
            setIndividuals(individuals.filter((selected) => selected.user_id !== individual_to_remove.user_id));
            setIndividualToRemove(null);
          }}
          onCancel={() => setIndividualToRemove(null)}
        />
      )}
    </div>
  );
}
