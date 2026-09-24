import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsFormSidebarIcon from "./DcsFormSidebarIcons.jsx";

const PRIMARY = "#056daa";
const FONT = "'Montserrat', sans-serif";

/**
 * Everything a form can be worked on, as one panel that sits beside the
 * projects sidebar for as long as a form is open.
 *
 * Every one of them is a page of its own with its own address - nothing
 * here opens as an overlay over something else. Downloading, sharing and
 * scheduling approvals each carry enough work to deserve the room, and a
 * dialog laid over the table would only hide the data it is about.
 */
const DATA_LINKS = [
  { key: "table", icon: "table", labelKey: "DCS_WS_TABLE", to: "/data" },
  { key: "dashboard", icon: "dashboard", labelKey: "DCS_FORM_NAV_BSC_DASHBOARD", to: "/dashboard" },
  { key: "gallery", icon: "gallery", labelKey: "DCS_WS_GALLERY", to: "/data/gallery" },
  { key: "downloads", icon: "downloads", labelKey: "DCS_WS_DOWNLOADS", to: "/data/downloads" },
  { key: "share", icon: "share", labelKey: "DCS_WS_SHARE", to: "/data/share" },
  { key: "approvals", icon: "approvals", labelKey: "DCS_WS_SCHEDULE_APPROVALS", to: "/data/approvals" },
];

const FORM_LINKS = [
  // Overview and Settings also ride the sub-header; they are repeated
  // here so the panel alone can reach every area of the form, which is
  // what a narrow screen (where the three header links may scroll) needs.
  { key: "overview", icon: "overview", labelKey: "DCS_FORM_NAV_OVERVIEW", to: "" },
  { key: "settings", icon: "settings", labelKey: "DCS_FORM_NAV_SETTINGS", to: "/details" },
  { key: "test-data", icon: "test-data", labelKey: "DCS_TEST_DATA_LINK", to: "/test-data" },
  { key: "versions", icon: "versions", labelKey: "DCS_FORM_NAV_VERSIONS", to: "/versions" },
  { key: "ownership", icon: "ownership", labelKey: "DCS_FORM_NAV_OWNERSHIP", to: "/ownership" },
];

/**
 * Which row reads as the open one - matched on the address alone, so the
 * panel always agrees with the page actually showing. The data sub-pages
 * are checked before the bare table, since /data is a prefix of all of
 * them.
 */
function active_key(pathname, base_path) {
  if (pathname === base_path) return "overview";
  if (/\/data\/gallery$/.test(pathname)) return "gallery";
  if (/\/data\/downloads$/.test(pathname)) return "downloads";
  if (/\/data\/share$/.test(pathname)) return "share";
  if (/\/data\/approvals$/.test(pathname)) return "approvals";
  if (/\/data$/.test(pathname)) return "table";
  if (/\/dashboard$/.test(pathname)) return "dashboard";
  if (/\/test-data$/.test(pathname)) return "test-data";
  if (/\/versions$/.test(pathname)) return "versions";
  if (/\/ownership$/.test(pathname)) return "ownership";
  if (/\/details$/.test(pathname)) return "settings";
  return "";
}

function SectionLabel({ children }) {
  return (
    <p className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase" style={{ color: "#9E9E9E", letterSpacing: "0.6px", fontFamily: FONT }}>
      {children}
    </p>
  );
}

function WorkspaceLink({ link, isActive, onSelect, translate }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(link)}
      aria-current={isActive ? "page" : undefined}
      title={translate(link.labelKey)}
      className={`dcs-form-ws-link ${isActive ? "is-active" : ""} w-full cursor-pointer flex items-center gap-2.5 text-left px-3 py-2.5`}
      style={{ fontFamily: FONT, fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? PRIMARY : "#444444" }}
    >
      <span className="flex-shrink-0 flex items-center justify-center" style={{ width: 18, height: 18 }}>
        <DcsFormSidebarIcon name={link.icon} size={16} color={isActive ? PRIMARY : "#6B7280"} />
      </span>
      <span className="truncate">{translate(link.labelKey)}</span>
    </button>
  );
}

export default function DcsFormSidebar({ nav, onClose }) {
  const { translate } = useDcsLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const base_path = `/dcs-system/project/${nav.project_id}/forms/${nav.form_group_id}`;
  const current = active_key(location.pathname, base_path);

  const handle_select = (link) => {
    navigate(`${base_path}${link.to}`);
    if (onClose) onClose();
  };

  return (
    <aside className="dcs-form-ws w-full h-full flex flex-col" aria-label={translate("DCS_WS_SECTION_FORM")}>
      <div className="dcs-form-ws-head flex items-start gap-2 px-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase" style={{ color: "#9E9E9E", letterSpacing: "0.6px", fontFamily: FONT }}>
            {translate("DCS_WS_SECTION_FORM")}
          </p>
          <p className="text-sm font-bold break-words" style={{ color: "#333333", fontFamily: FONT }} title={nav.title}>
            {nav.title || "..."}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title={translate("DCS_WS_HIDE")}
            aria-label={translate("DCS_WS_HIDE")}
            className="dcs-sidebar-close rounded-full cursor-pointer flex items-center justify-center flex-shrink-0 min-[1100px]:hidden"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <line x1="5" y1="5" x2="19" y2="19" />
              <line x1="19" y1="5" x2="5" y2="19" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pb-3">
        <SectionLabel>{translate("DCS_WS_SECTION_DATA")}</SectionLabel>
        {DATA_LINKS.map((link) => (
          <WorkspaceLink key={link.key} link={link} isActive={current === link.key} onSelect={handle_select} translate={translate} />
        ))}

        <SectionLabel>{translate("DCS_WS_SECTION_FORM")}</SectionLabel>
        {FORM_LINKS.map((link) => (
          <WorkspaceLink key={link.key} link={link} isActive={current === link.key} onSelect={handle_select} translate={translate} />
        ))}
      </div>
    </aside>
  );
}
