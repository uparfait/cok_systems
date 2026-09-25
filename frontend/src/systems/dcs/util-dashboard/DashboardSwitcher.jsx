import React, { useRef, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import MenuPopover from "./MenuPopover.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsConfirmDialog from "../components/DcsConfirmDialog.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";

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
 *
 * An editor may also SELECT several dashboards at once ("Select" in the
 * head turns every row into a tick box) and then make their names
 * uppercase, or delete them all after one confirmation. Nothing happens
 * to a dashboard that was not ticked.
 */
export default function DashboardSwitcher({ dashboards, activeId, canEdit, onSelect, onRename, onCreate, onUppercase, onDeleteMany }) {
  const { translate } = useDcsLanguage();
  const anchor_ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  // Selecting several: which rows are ticked, and what is being done to them.
  const [selecting, setSelecting] = useState(false);
  const [ticked, setTicked] = useState(() => new Set());
  const [working, setWorking] = useState(false);
  const [confirm_delete, setConfirmDelete] = useState(false);
  // The ids the confirmation is about, taken the moment Delete is pressed:
  // the dialog is drawn outside the list, and the list must not lose them
  // to a click that lands on the dialog.
  const [pending_ids, setPendingIds] = useState([]);
  const active = dashboards.find((entry) => entry.id === activeId) || null;
  const can_bulk = canEdit && (onUppercase || onDeleteMany);

  const close = () => {
    setOpen(false);
    setRenaming(false);
    setSelecting(false);
    setTicked(new Set());
  };
  // An outside click (or Escape) while the confirmation is up, or while
  // something is being done, leaves the list exactly as it is.
  const guarded_close = () => {
    if (confirm_delete || working) return;
    close();
  };
  const leave_selecting = () => {
    setSelecting(false);
    setTicked(new Set());
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

  const toggle_tick = (id) =>
    setTicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const tick_all = () => setTicked(new Set(dashboards.map((entry) => entry.id)));
  const tick_none = () => setTicked(new Set());
  const chosen = Array.from(ticked).filter((id) => dashboards.some((entry) => entry.id === id));

  // The page shows the outcome (a toast) and rethrows a failure; the list
  // stays open either way so the person sees what is left.
  const run_uppercase = async () => {
    if (chosen.length === 0 || !onUppercase) return;
    setWorking(true);
    try {
      await onUppercase(chosen);
    } catch {
      // Said by the page.
    } finally {
      setWorking(false);
    }
  };
  const ask_delete = () => {
    if (chosen.length === 0) return;
    setPendingIds(chosen);
    setConfirmDelete(true);
  };
  const run_delete = async () => {
    const ids = pending_ids.length > 0 ? pending_ids : chosen;
    if (ids.length === 0 || !onDeleteMany) return;
    setWorking(true);
    try {
      await onDeleteMany(ids);
      setTicked(new Set());
      setSelecting(false);
    } catch {
      // Said by the page.
    } finally {
      setWorking(false);
      setConfirmDelete(false);
      setPendingIds([]);
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

      <MenuPopover open={open} anchorRef={anchor_ref} onClose={guarded_close} minWidth={300} maxHeight={440} align="start" role="listbox">
        <div className="dcs-board-switcher-head">
          <span>{translate("DCS_DB_SWITCH_TITLE")}</span>
          <span className="flex items-center gap-2">
            {can_bulk && dashboards.length > 0 && (
              <button type="button" className="dcs-board-switcher-rename dcs-link-action" disabled={working} onClick={() => (selecting ? leave_selecting() : setSelecting(true))}>
                {translate(selecting ? "DCS_DB_SWITCH_SELECT_DONE" : "DCS_DB_SWITCH_SELECT")}
              </button>
            )}
            <span>{dashboards.length}</span>
          </span>
        </div>
        {selecting && (
          <div className="dcs-board-switcher-bulk">
            <span>{translate("DCS_DB_SWITCH_SELECTED", { count: chosen.length })}</span>
            <span className="flex items-center gap-2">
              <button type="button" className="dcs-board-switcher-rename dcs-link-action" disabled={working} onClick={tick_all}>
                {translate("DCS_BTN_SELECT_ALL")}
              </button>
              <button type="button" className="dcs-board-switcher-rename dcs-link-action is-muted" disabled={working} onClick={tick_none}>
                {translate("DCS_BTN_SELECT_NONE")}
              </button>
            </span>
          </div>
        )}
        <ul className="dcs-board-switcher-list">
          {dashboards.map((entry) => {
            const is_active = entry.id === activeId;
            const is_ticked = ticked.has(entry.id);
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selecting ? is_ticked : is_active}
                  disabled={working}
                  className={`dcs-board-switcher-item ${is_active && !selecting ? "is-active" : ""} ${selecting && is_ticked ? "is-ticked" : ""}`}
                  onClick={() => {
                    if (selecting) {
                      toggle_tick(entry.id);
                      return;
                    }
                    onSelect(entry.id);
                    close();
                  }}
                >
                  {selecting ? (
                    <span className={`dcs-board-switcher-tick ${is_ticked ? "is-on" : ""}`} aria-hidden="true">
                      {is_ticked ? CHECK_SVG : null}
                    </span>
                  ) : (
                    <span className="dcs-board-switcher-check">{is_active ? CHECK_SVG : null}</span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="dcs-board-switcher-item-name">{entry.name}</span>
                    <span className="dcs-board-switcher-item-meta">
                      {Number.isFinite(entry.widgets_count) ? translate("DCS_DB_WIDGETS_COUNT", { count: entry.widgets_count }) : ""}
                      {is_active ? `${Number.isFinite(entry.widgets_count) ? " - " : ""}${translate("DCS_DB_SWITCH_ACTIVE")}` : ""}
                    </span>
                  </span>
                </button>
                {canEdit && !selecting && is_active && !renaming && (
                  <button type="button" className="dcs-board-switcher-rename dcs-link-action" onClick={start_rename}>
                    {translate("DCS_DB_RENAME_DASHBOARD")}
                  </button>
                )}
                {canEdit && !selecting && is_active && renaming && (
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
        {canEdit && !selecting && (
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
        {canEdit && selecting && (
          <div className="dcs-board-switcher-foot dcs-board-switcher-foot-bulk">
            {working && (
              <span className="flex items-center justify-center gap-2 text-xs font-semibold" style={{ color: "#056daa", fontFamily: "'Montserrat', sans-serif" }}>
                <SpiralLoader padded={false} size={18} />
                {translate("DCS_DB_WORKING")}
              </span>
            )}
            {onUppercase && (
              <DcsButtonOutline type="button" disabled={working || chosen.length === 0} onClick={run_uppercase}>
                {working ? translate("DCS_DB_WORKING") : translate("DCS_DB_SWITCH_UPPERCASE")}
              </DcsButtonOutline>
            )}
            {onDeleteMany && (
              <button type="button" className="dcs-board-switcher-delete" disabled={working || chosen.length === 0} onClick={ask_delete}>
                {translate("DCS_DB_SWITCH_DELETE")}
              </button>
            )}
          </div>
        )}
      </MenuPopover>
      {confirm_delete && (
        <DcsConfirmDialog
          titleKey="DCS_DB_BULK_DEL_TITLE"
          messageKey="DCS_DB_BULK_DEL_MESSAGE"
          confirming={working}
          onConfirm={run_delete}
          onCancel={() => {
            if (working) return;
            setConfirmDelete(false);
            setPendingIds([]);
          }}
        />
      )}
    </>
  );
}
