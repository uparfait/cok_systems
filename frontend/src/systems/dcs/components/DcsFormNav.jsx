import { useLocation, useNavigate } from "react-router-dom";
import { find_active_nav_key } from "./DcsPageNav.jsx";
import { useDcsContextNav } from "../layout/contextNav.jsx";

const OVERVIEW_KEY = "overview";

// One list for every page of a form, so the header reads the same whether
// the form's own overview, its collected responses or its BSC dashboard is
// open - the last three are routes of their own, not tabs of the overview.
const FORM_NAV_ITEMS = [
  { key: OVERVIEW_KEY, labelKey: "DCS_FORM_NAV_OVERVIEW", path: "" },
  { key: "data", labelKey: "DCS_DATA_COLLECTED_CARD_TITLE", path: "data" },
  { key: "dashboard", labelKey: "DCS_FORM_NAV_BSC_DASHBOARD", path: "dashboard" },
  { key: "settings", labelKey: "DCS_FORM_NAV_SETTINGS", path: "details" },
  { key: "approval", labelKey: "DCS_FORM_NAV_APPROVAL", path: "approval" },
  { key: "versions", labelKey: "DCS_FORM_NAV_VERSIONS", path: "versions" },
  { key: "test-data", labelKey: "DCS_TEST_DATA_LINK", path: "test-data" },
  { key: "ownership", labelKey: "DCS_FORM_NAV_OWNERSHIP", path: "ownership" },
];

/**
 * Publishes the form's links to the shared sub-header (see contextNav);
 * renders nothing of its own. Pages keep mounting it exactly as before.
 */
export default function DcsFormNav({ projectId, formGroupId, formName, onBeforeNavigate }) {
  const location = useLocation();
  const navigate = useNavigate();

  const base_path = `/dcs-system/project/${projectId}/forms/${formGroupId}`;
  const active_key = find_active_nav_key(FORM_NAV_ITEMS, base_path, location.pathname, OVERVIEW_KEY);

  useDcsContextNav(
    FORM_NAV_ITEMS,
    base_path,
    active_key,
    (item) => {
      if (onBeforeNavigate) onBeforeNavigate(item);
      navigate(item.path ? `${base_path}/${item.path}` : base_path);
    },
    { kind: "form", title: formName || "", project_id: projectId },
  );

  return null;
}
