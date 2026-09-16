import React, { useRef, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import MenuPopover from "./MenuPopover.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";

const MAX_NAME = 80;

const CHEVRON_SVG = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const CHECK_SVG = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12l5 5L20 7" />
  </svg>
);

/**
 * The board title as a self-made select: the active dashboard's name with
 * a chevron that turns when open. Clicking it opens a fixed dropdown (a
 * portalled MenuPopover, so nothing clips it) listing every dashboard of
 * the form with its widget count - scrollable when there are many - where
 * the viewer switches boards, an editor renames the active one in place,
 * and an "Add dashboard" button sits pinned at the bottom.
 */
export default function DashboardSwitcher({ dashboards, activeId, canEdit, onSelect, onRename, onCreate }) {
  const { translate } = useDcsLanguage();
  const anchor_ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const active = dashboards.find((entry) => entry.id === activeId) || null;

  const close = () => {
    setOpen(false);
    setRenaming(false);
  };

  const start_rename = () => {
    setDraft(active ? active.name : "");
    setRenaming(true);
  };

  const submit_rename = async (event) => {
    event.preventDefault();
    const name = draft.trim();
    if (!name || !active || name === active.name) {
      setRenaming(false);
      return;
    }
    setSaving(true);
    try {
      await onRename(name);
      setRenaming(false);
    } catch {
      // The page already showed the server's reason; keep the field open.
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        ref={anchor_ref}
        type="button"
        className={`dcs-board-switcher ${open ? "is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={translate("DCS_DB_SWITCH_TITLE")}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className="dcs-board-switcher-name">{active ? active.name : translate("DCS_DB_NO_DASHBOARDS_TITLE")}</span>
        <span className="dcs-board-switcher-chevron">{CHEVRON_SVG}</span>
      </button>

      <MenuPopover open={open} anchorRef={anchor_ref} onClose={close} minWidth={300} maxHeight={440} align="start" role="listbox">
        <div className="dcs-board-switcher-head">
          <span>{translate("DCS_DB_SWITCH_TITLE")}</span>
          <span>{dashboards.length}</span>
        </div>
        <ul className="dcs-board-switcher-list">
          {dashboards.map((entry) => {
            const is_active = entry.id === activeId;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={is_active}
                  className={`dcs-board-switcher-item ${is_active ? "is-active" : ""}`}
                  onClick={() => {
                    onSelect(entry.id);
                    close();
                  }}
                >
                  <span className="dcs-board-switcher-check">{is_active ? CHECK_SVG : null}</span>
                  <span className="min-w-0 flex-1">
                    <span className="dcs-board-switcher-item-name">{entry.name}</span>
                    <span className="dcs-board-switcher-item-meta">
                      {translate("DCS_DB_WIDGETS_COUNT", { count: entry.widgets_count || 0 })}
                      {is_active ? ` - ${translate("DCS_DB_SWITCH_ACTIVE")}` : ""}
                    </span>
                  </span>
                </button>
                {canEdit && is_active && !renaming && (
                  <button type="button" className="dcs-board-switcher-rename dcs-link-action" onClick={start_rename}>
                    {translate("DCS_DB_RENAME_DASHBOARD")}
                  </button>
                )}
                {canEdit && is_active && renaming && (
                  <form className="dcs-board-switcher-form" onSubmit={submit_rename}>
                    <input
                      value={draft}
                      maxLength={MAX_NAME}
                      autoFocus
                      disabled={saving}
                      placeholder={translate("DCS_DB_NAME_PLACEHOLDER")}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.stopPropagation();
                          setRenaming(false);
                        }
                      }}
                    />
                    <div className="dcs-board-switcher-form-actions">
                      <button type="submit" className="dcs-board-switcher-rename dcs-link-action" disabled={saving || !draft.trim()}>
                        {saving ? translate("DCS_DB_WORKING") : translate("DCS_BTN_SAVE")}
                      </button>
                      <button type="button" className="dcs-board-switcher-rename dcs-link-action is-muted" disabled={saving} onClick={() => setRenaming(false)}>
                        {translate("DCS_BTN_CANCEL")}
                      </button>
                    </div>
                  </form>
                )}
              </li>
            );
          })}
          {dashboards.length === 0 && <li className="dcs-board-switcher-empty">{translate("DCS_DB_NO_DASHBOARDS_SHORT")}</li>}
        </ul>
        {canEdit && (
          <div className="dcs-board-switcher-foot">
            <DcsButtonPrimary
              type="button"
              onClick={() => {
                close();
                onCreate();
              }}
            >
              {translate("DCS_DB_ADD_DASHBOARD")}
            </DcsButtonPrimary>
          </div>
        )}
      </MenuPopover>
    </>
  );
}
