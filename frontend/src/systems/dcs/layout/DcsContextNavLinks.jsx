import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { get_project } from "../services/projectsService.js";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";
import { useContextNav } from "./contextNav.jsx";

const PRIMARY = "#056daa";
const BORDER = "#E0E0E0";
const TEXT_DARK = "#333333";
const TEXT_MUTED = "#9E9E9E";
const FONT = "'Montserrat', sans-serif";
const MAX_VISIBLE = 3;
const MORE_BUTTON_PX = 96;
const GAP_PX = 16;
const CLOSE_DELAY_MS = 180;

// The pages of a project, in the order the project page itself lists them.
const PROJECT_LINKS = [
  { key: "overview", labelKey: "DCS_PROJECT_NAV_OVERVIEW", path: "" },
  { key: "settings", labelKey: "DCS_PROJECT_NAV_SETTINGS", path: "settings" },
  { key: "forms", labelKey: "DCS_PROJECT_NAV_FORMS", path: "forms" },
  { key: "access-control", labelKey: "DCS_SECTION_ACCESS_CONTROL", path: "access-control", needs_access: true },
  { key: "dashboard", labelKey: "DCS_SECTION_BUILD_DASHBOARD", path: "dashboard" },
];

const link_class = (active, extra) => `dcs-sub-header-home-link ${active ? "is-active" : ""} text-sm font-semibold cursor-pointer ${extra || ""}`;
const link_style = { color: PRIMARY, fontFamily: FONT, background: "none", border: "none", padding: 0, textAlign: "left" };

function PanelLabel({ children }) {
  return (
    <p className="text-[10px] font-bold uppercase mb-1" style={{ color: TEXT_MUTED, letterSpacing: "0.5px", fontFamily: FONT }}>
      {children}
    </p>
  );
}

/** Links two per row. */
function LinkGrid({ children }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-1.5">{children}</div>;
}

/**
 * The right half of the panel on a FORM page: the form's project, its name
 * linking to the project overview and the project's pages (Access control
 * only when this viewer may manage it) - fetched when the panel opens.
 */
function ProjectColumn({ project_id, onNavigate }) {
  const { translate } = useDcsLanguage();
  const [project, setProject] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let is_mounted = true;
    get_project(project_id)
      .then((response) => is_mounted && setProject(response.data || null))
      .catch(() => is_mounted && setFailed(true));
    return () => {
      is_mounted = false;
    };
  }, [project_id]);
  const base = `/dcs-system/project/${project_id}`;
  return (
    <div className="min-w-0">
      <PanelLabel>{translate("DCS_HEADER_PANEL_PROJECT")}</PanelLabel>
      {!project && !failed && <SpiralLoader padded={false} size={18} />}
      {failed && (
        <p className="text-xs" style={{ color: TEXT_MUTED }}>
          {translate("DCS_ERROR_GENERIC")}
        </p>
      )}
      {project && (
        <>
          <button type="button" className={link_class(false, "block mb-2 text-base")} style={{ ...link_style, color: TEXT_DARK }} onClick={() => onNavigate(base)}>
            {project.name}
          </button>
          <LinkGrid>
            {PROJECT_LINKS.filter((link) => !link.needs_access || project.viewer_can_manage_access === true).map((link) => (
              <button key={link.key} type="button" className={link_class(false, "truncate")} style={link_style} onClick={() => onNavigate(link.path ? `${base}/${link.path}` : base)}>
                {translate(link.labelKey)}
              </button>
            ))}
          </LinkGrid>
        </>
      )}
    </div>
  );
}

/**
 * The current project's or form's links, centered in the sub-header: up
 * to three that fit, then "More (n)". Hovering or tapping More opens a
 * wide, gray-bordered panel: on the left the open project or form with all
 * its pages two per row; on the right, a project's forms, or a form's
 * project and that project's pages.
 */
export default function DcsContextNavLinks() {
  const nav = useContextNav();
  const { translate } = useDcsLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const holder_ref = useRef(null);
  const measure_ref = useRef(null);
  const more_ref = useRef(null);
  const close_timer = useRef(null);
  const [visible_count, setVisibleCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);

  const items = (nav && nav.items) || [];

  useLayoutEffect(() => {
    const holder = holder_ref.current;
    const measure = measure_ref.current;
    if (!holder || !measure) return undefined;
    const compute = () => {
      const width = holder.clientWidth;
      const widths = Array.from(measure.children).map((child) => child.offsetWidth);
      const needs_more = widths.length > MAX_VISIBLE || widths.reduce((sum, w) => sum + w + GAP_PX, 0) > width;
      const budget = needs_more ? width - MORE_BUTTON_PX : width;
      let used = 0;
      let count = 0;
      widths.slice(0, MAX_VISIBLE).forEach((w) => {
        if (used + w + GAP_PX <= budget) {
          used += w + GAP_PX;
          count += 1;
        }
      });
      setVisibleCount(count);
    };
    compute();
    if (typeof window.ResizeObserver !== "function") return undefined;
    const observer = new window.ResizeObserver(compute);
    observer.observe(holder);
    return () => observer.disconnect();
  }, [items]);

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const on_outside = (event) => {
      if (more_ref.current && more_ref.current.contains(event.target)) return;
      if (event.target.closest && event.target.closest(".dcs-context-more-panel")) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", on_outside);
    return () => document.removeEventListener("mousedown", on_outside);
  }, [open]);

  if (!nav || items.length === 0) return null;

  const panel_width = Math.min(window.innerWidth - 16, Math.max(Math.round(window.innerWidth * 0.5), 560));
  const show_panel = () => {
    window.clearTimeout(close_timer.current);
    if (more_ref.current) {
      // The panel hangs from the bottom edge of the header bar itself,
      // horizontally centered on the More button.
      const box = more_ref.current.getBoundingClientRect();
      const bar = more_ref.current.closest(".dcs-sub-header");
      const bar_bottom = bar ? bar.getBoundingClientRect().bottom : box.bottom;
      const centered = box.left + box.width / 2 - panel_width / 2;
      setRect({ top: bar_bottom + 4, left: Math.max(8, Math.min(centered, window.innerWidth - panel_width - 8)) });
    }
    setOpen(true);
  };
  const schedule_close = () => {
    window.clearTimeout(close_timer.current);
    close_timer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };
  const go = (path) => {
    setOpen(false);
    navigate(path);
  };

  const visible = items.slice(0, visible_count);
  const rest_count = items.length - visible.length;
  const rest_active = items.slice(visible_count).some((item) => item.key === nav.active_key);
  const is_project = nav.kind === "project";

  return (
    <div ref={holder_ref} className="relative flex-1 min-w-0 flex items-center justify-center gap-4">
      <div ref={measure_ref} aria-hidden="true" className="absolute flex gap-4 invisible pointer-events-none" style={{ left: 0, top: 0 }}>
        {items.map((item) => (
          <span key={item.key} className="text-sm font-semibold whitespace-nowrap" style={{ fontFamily: FONT }}>
            {translate(item.labelKey)}
          </span>
        ))}
      </div>
      {visible.map((item) => (
        <button key={item.key} type="button" aria-current={item.key === nav.active_key ? "page" : undefined} className={link_class(item.key === nav.active_key, "whitespace-nowrap")} style={link_style} onClick={() => nav.select(item)}>
          {translate(item.labelKey)}
        </button>
      ))}
      {rest_count > 0 && (
        <button
          ref={more_ref}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          className={link_class(rest_active || open, "whitespace-nowrap")}
          style={link_style}
          onMouseEnter={show_panel}
          onMouseLeave={schedule_close}
          onClick={() => (open ? setOpen(false) : show_panel())}
        >
          {translate("DCS_HEADER_MORE", { count: rest_count })}
        </button>
      )}
      {open &&
        rect &&
        createPortal(
          <div
            className="dcs-context-more-panel dcs-builder-popover fixed bg-white overflow-y-auto"
            role="menu"
            style={{ top: rect.top, left: rect.left, width: panel_width, zIndex: 10050, border: `1px solid ${BORDER}`, maxHeight: "70vh", padding: "16px 20px" }}
            onMouseEnter={show_panel}
            onMouseLeave={schedule_close}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="min-w-0">
                <PanelLabel>{translate(is_project ? "DCS_HEADER_PANEL_PROJECT" : "DCS_HEADER_PANEL_FORM")}</PanelLabel>
                <p className="text-base font-bold mb-2 break-words" style={{ color: TEXT_DARK, fontFamily: FONT }}>
                  {nav.title || "..."}
                </p>
                <LinkGrid>
                  {items.map((item) => (
                    <button key={item.key} type="button" role="menuitem" aria-current={item.key === nav.active_key ? "page" : undefined} className={link_class(item.key === nav.active_key, "truncate")} style={link_style} onClick={() => { setOpen(false); nav.select(item); }}>
                      {translate(item.labelKey)}
                    </button>
                  ))}
                </LinkGrid>
              </div>
              {is_project ? (
                <div className="min-w-0">
                  <PanelLabel>{translate("DCS_HEADER_PANEL_FORMS", { count: (nav.forms || []).length })}</PanelLabel>
                  {(nav.forms || []).length === 0 ? (
                    <p className="text-xs" style={{ color: TEXT_MUTED }}>
                      {translate("DCS_HEADER_PANEL_NO_FORMS")}
                    </p>
                  ) : (
                    <LinkGrid>
                      {nav.forms.map((form) => (
                        <button key={form.form_group_id} type="button" role="menuitem" className={link_class(false, "truncate")} style={link_style} onClick={() => go(`/dcs-system/project/${nav.project_id}/forms/${form.form_group_id}`)} title={form.form_name}>
                          {form.form_name || form.form_group_id}
                        </button>
                      ))}
                    </LinkGrid>
                  )}
                </div>
              ) : (
                nav.project_id && <ProjectColumn project_id={nav.project_id} onNavigate={go} />
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
