import React from "react";
import { useParams, useLocation, useNavigate, Outlet } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useSilentPolling } from "../hooks/useSilentPolling.js";
import { get_form } from "../services/formsService.js";
import DcsLoadingState from "../components/DcsLoadingState.jsx";

/**
 * Form shell: fetches the currently active version (refreshed silently
 * every 10s) and renders the Settings/Versions sub-navigation with an
 * outlet beneath. Clicking Settings always forces a fresh reload of the
 * active version's fields, even when already on that tab - editing must
 * never start from a stale copy after a different version was activated
 * elsewhere.
 */
export default function FormDetailPage() {
  const { project_id, form_group_id } = useParams();
  const { translate } = useDcsLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const { data: form, loading, refresh } = useSilentPolling(() => get_form(form_group_id).then((res) => res.data), 10000, [form_group_id]);

  if (loading || !form) return <DcsLoadingState />;

  const base_path = `/dcs-system/project/${project_id}/forms/${form_group_id}`;
  const is_versions_tab = location.pathname.startsWith(`${base_path}/versions`);
  const title = form.form_name || form_group_id;

  const tab_style = (is_active) => ({
    fontFamily: "'Montserrat', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    padding: "0.6rem 1rem",
    color: is_active ? "#056daa" : "#9E9E9E",
    borderBottom: is_active ? "2px solid #056daa" : "2px solid transparent",
    cursor: "pointer",
  });

  return (
    <div className="w-full min-[760px]:w-[80vw] mx-auto">
      <h1 className="mb-2 truncate" style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 20, color: "#333333" }} title={title}>
        {title}
      </h1>
      <div className="flex border-b mb-4" style={{ borderColor: "#E0E0E0" }}>
        <button
          type="button"
          style={tab_style(!is_versions_tab)}
          onClick={() => {
            refresh();
            navigate(`${base_path}/details`);
          }}
        >
          {translate("DCS_FORM_NAV_SETTINGS")}
        </button>
        <button type="button" style={tab_style(is_versions_tab)} onClick={() => navigate(`${base_path}/versions`)}>
          {translate("DCS_FORM_NAV_VERSIONS")}
        </button>
      </div>
      <Outlet context={{ project_id, form_group_id, form, refreshForm: refresh }} />
    </div>
  );
}
