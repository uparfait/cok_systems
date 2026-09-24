import { useLocation, useNavigate } from "react-router-dom";
import { find_active_nav_key } from "./DcsPageNav.jsx";
import { useDcsContextNav } from "../layout/contextNav.jsx";
import { get_cached_form_name, remember_form_name } from "../hooks/formsCache.js";

const OVERVIEW_KEY = "overview";

// Only three links ride the sub-header now, so it never has to fold any
// of them behind a "More" panel: the form's overview, its data and its
// settings. Everything else a form has - its dashboard, gallery,
// downloads, sharing, TDM, versions, ownership and approval scheduling -
// lives in the form panel beside the projects sidebar (DcsFormSidebar),
// which is where those areas are actually worked in.
const FORM_NAV_ITEMS = [
  { key: OVERVIEW_KEY, labelKey: "DCS_FORM_NAV_OVERVIEW", path: "" },
  { key: "data", labelKey: "DCS_DATA_COLLECTED_CARD_TITLE", path: "data" },
  { key: "settings", labelKey: "DCS_FORM_NAV_SETTINGS", path: "details" },
];

/**
 * Publishes the form's links to the shared sub-header (see contextNav);
 * renders nothing of its own. Pages keep mounting it exactly as before.
 */
export default function DcsFormNav({ projectId, formGroupId, formName, onBeforeNavigate }) {
  const location = useLocation();
  const navigate = useNavigate();

  const base_path = `/dcs-system/project/${projectId}/forms/${formGroupId}`;
  // Only the form's own root is the overview. A page these three links do
  // not cover any more - the dashboard, the gallery - lights none of them
  // up rather than wrongly lighting up Overview; the form panel beside the
  // sidebar is what shows where you actually are.
  const fallback_key = location.pathname === base_path ? OVERVIEW_KEY : "";

  // Not every page of a form has the form's name the moment it mounts:
  // the gallery, downloads and sharing all fetch something else first.
  // Showing the last name seen for this form keeps the header and the
  // workspace panel steady instead of blinking to "..." and back on
  // every move between them.
  const title = formName ? remember_form_name(formGroupId, formName) : get_cached_form_name(formGroupId);
  const active_key = find_active_nav_key(FORM_NAV_ITEMS, base_path, location.pathname, fallback_key);

  useDcsContextNav(
    FORM_NAV_ITEMS,
    base_path,
    active_key,
    (item) => {
      if (onBeforeNavigate) onBeforeNavigate(item);
      navigate(item.path ? `${base_path}/${item.path}` : base_path);
    },
    // form_group_id rides along so the shell can put the form's own
    // workspace panel (DcsFormSidebar) up beside the projects sidebar.
    { kind: "form", title, project_id: projectId, form_group_id: formGroupId },
  );

  return null;
}
