import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { track_message_text } from "./editDiffMessage.js";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsButtonOutlineDanger from "../components/DcsButtonOutlineDanger.jsx";
import DcsButtonOutlineReverse from "../components/DcsButtonOutlineReverse.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsConfirmDialog from "../components/DcsConfirmDialog.jsx";

const PRIMARY = "#056daa";
const BORDER = "#E0E0E0";
const MUTED = "#9E9E9E";
const HEADER_HEIGHT_PX = 50;
const HEADING_FONT = { fontFamily: "'Montserrat', sans-serif" };

function format_time(iso_text, language) {
  try {
    return new Date(iso_text).toLocaleString(language === "kn" ? "rw" : language);
  } catch (format_error) {
    return iso_text;
  }
}

/**
 * The confirm has to be portaled the same way its overlay is. Left where it
 * is written it would render inside the builder's own blurred glass cards,
 * which are a containing block for anything fixed inside them - the dialog
 * would end up trapped behind the overlay that raised it. Appended after
 * that overlay's portal, it stacks on top of it at the same z-index.
 */
function PortaledConfirm(props) {
  return createPortal(<DcsConfirmDialog {...props} />, document.body);
}

function CenteredOverlay({ titleKey, subtitle, onClose, panelStyle, children }) {
  const { translate } = useDcsLanguage();
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative bg-white border-2 w-full flex flex-col"
        style={Object.assign({ maxWidth: 620, maxHeight: "92vh", borderColor: PRIMARY }, panelStyle || {})}
      >
        <div
          className="flex items-center justify-between gap-2 flex-shrink-0 px-4 sm:px-5"
          style={{ backgroundColor: PRIMARY, height: HEADER_HEIGHT_PX }}
        >
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase leading-tight truncate" style={{ color: "#FFFFFF", letterSpacing: "0.3px", ...HEADING_FONT }}>
              {translate(titleKey)}
            </p>
            {subtitle && (
              <p className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.85)", ...HEADING_FONT }}>
                {subtitle}
              </p>
            )}
          </div>
          {onClose && (
            <div className="flex-shrink-0" style={{ width: 96 }}>
              <DcsButtonOutlineReverse onClick={onClose}>{translate("DCS_BTN_CLOSE")}</DcsButtonOutlineReverse>
            </div>
          )}
        </div>
        <div className="flex flex-col flex-1 min-h-0 px-4 sm:px-5 pt-3 pb-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * One tracked edit, titled by when it was made - the time is what tells
 * one edit apart from the next when several touched the same field, so it
 * leads and what was done reads underneath it.
 */
function HistoryEntryRow({ entry, position, isUndone, translate, language }) {
  return (
    <li className="flex items-start gap-2">
      <span className="flex-shrink-0 text-xs font-bold" style={{ color: isUndone ? MUTED : PRIMARY, minWidth: 22, ...HEADING_FONT }}>
        {position}
      </span>
      <span className="min-w-0">
        <span
          className="block text-xs font-bold"
          style={{ color: isUndone ? MUTED : "#333333", textDecoration: isUndone ? "line-through" : "none", ...HEADING_FONT }}
        >
          {format_time(entry.at, language)}
          {isUndone ? ` - ${translate("DCS_TRACK_REDOABLE")}` : ""}
        </span>
        <span className="block text-[11px]" style={{ color: MUTED, ...HEADING_FONT }}>
          {track_message_text(entry, translate, language)}
        </span>
      </span>
    </li>
  );
}

/**
 * Asked on opening a form this browser is still holding unpublished edits
 * for. The decision cannot be skipped - one answer replaces what is on
 * screen and the other throws work away - so the form stays locked until
 * it is made; "later" only moves the question out of the way, it does not
 * answer it.
 */
export function EditHistoryRestoredDialog({ restored, entries, onApply, onDiscard, onLater }) {
  const { translate, language } = useDcsLanguage();
  const [pending, setPending] = useState(null);

  if (!restored) return null;

  const pending_entries = entries.slice(0, restored.count).reverse();

  return (
    <>
      <CenteredOverlay titleKey="DCS_TRACK_RESTORED_TITLE" panelStyle={{ maxWidth: 560 }}>
        <p className="text-xs font-semibold" style={{ color: "#333333", ...HEADING_FONT }}>
          {translate("DCS_TRACK_RESTORED_SHORT", { count: restored.count })}
        </p>

        <ol className="flex-1 min-h-0 overflow-y-auto mt-2 pr-1 space-y-1.5" style={{ maxHeight: 220 }}>
          {pending_entries.map((entry, index) => (
            <HistoryEntryRow
              key={entry.id}
              entry={entry}
              position={pending_entries.length - index}
              isUndone={false}
              translate={translate}
              language={language}
            />
          ))}
        </ol>

        {/* The two real answers sit together - one column on a phone, side
            by side once there is room - and deferring sits on its own row
            below them, wide enough to be the easy way out it is. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 flex-shrink-0">
          <DcsButtonPrimary type="button" onClick={() => setPending("apply")}>
            {translate("DCS_TRACK_RESTORED_APPLY")}
          </DcsButtonPrimary>
          <DcsButtonOutlineDanger type="button" onClick={() => setPending("discard")}>
            {translate("DCS_TRACK_RESTORED_DISCARD")}
          </DcsButtonOutlineDanger>
        </div>

        <div className="mt-2 flex-shrink-0">
          <DcsButtonOutline type="button" className="w-full" style={{ padding: "1.1rem 2rem", fontSize: 14 }} onClick={onLater}>
            {translate("DCS_TRACK_RESTORED_LATER")}
          </DcsButtonOutline>
        </div>
      </CenteredOverlay>

      {pending && (
        <PortaledConfirm
          titleKey={pending === "apply" ? "DCS_TRACK_APPLY_TITLE" : "DCS_TRACK_DISCARD_TITLE"}
          messageKey={pending === "apply" ? "DCS_TRACK_APPLY_MESSAGE" : "DCS_TRACK_DISCARD_MESSAGE"}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            setPending(null);
            if (pending === "apply") onApply();
            else onDiscard();
          }}
        />
      )}
    </>
  );
}

/**
 * The button left behind by "decide later", anchored to the corner of the
 * window so the pending decision stays reachable from anywhere on the page
 * without standing in the builder's way.
 */
export function EditHistoryPendingButton({ count, when, onClick }) {
  const { translate, language } = useDcsLanguage();
  return createPortal(
    <button
      type="button"
      onClick={onClick}
      className="dcs-track-pending-fab"
      title={translate("DCS_TRACK_PENDING_TOOLTIP", { count, when: format_time(when, language) })}
    >
      {translate("DCS_TRACK_PENDING_BUTTON", { count })}
    </button>,
    document.body,
  );
}

/**
 * The chronological list of everything done to this form since it was last
 * published, opened deliberately rather than sitting in the builder: while
 * editing, tracking is meant to be invisible - it is the keyboard's undo
 * that the author actually uses, and a permanent panel announcing that a
 * history exists only takes room from the form being built.
 *
 * Entries past the cursor are the ones that have been undone: still
 * listed, struck through, because they can be redone.
 */
export default function EditHistoryOverlay({ entries, cursor, canUndo, canRedo, onUndo, onRedo, onClear, onClose }) {
  const { translate, language } = useDcsLanguage();
  const [is_confirming_clear, setIsConfirmingClear] = useState(false);

  const ordered = entries.slice().reverse();

  return (
    <>
      {/* Deliberately large: a long editing session is a long list, and
          reading it through a small window means scrolling far more than
          looking. The list inside scrolls; the panel itself never grows
          past the viewport. */}
      <CenteredOverlay
        titleKey="DCS_TRACK_TITLE"
        subtitle={translate("DCS_TRACK_COUNT", { count: entries.length })}
        onClose={onClose}
        panelStyle={{ maxWidth: "80vw", width: "80vw", height: "80vh", maxHeight: "92vh" }}
      >
        <div className="flex flex-wrap items-center gap-2 pb-3 flex-shrink-0" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title={translate("DCS_TRACK_UNDO_HINT")}
            className="dcs-track-step text-xs font-semibold uppercase px-3 py-1.5"
            style={{ ...HEADING_FONT, opacity: canUndo ? 1 : 0.4, cursor: canUndo ? "pointer" : "not-allowed" }}
          >
            {translate("DCS_TRACK_UNDO")}
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title={translate("DCS_TRACK_REDO_HINT")}
            className="dcs-track-step text-xs font-semibold uppercase px-3 py-1.5"
            style={{ ...HEADING_FONT, opacity: canRedo ? 1 : 0.4, cursor: canRedo ? "pointer" : "not-allowed" }}
          >
            {translate("DCS_TRACK_REDO")}
          </button>
        </div>

        {entries.length === 0 ? (
          <p className="text-xs pt-3" style={{ color: MUTED, ...HEADING_FONT }}>
            {translate("DCS_TRACK_EMPTY")}
          </p>
        ) : (
          <>
            <ol className="flex-1 min-h-0 overflow-y-auto pt-3 pr-1 space-y-1.5">
              {ordered.map((entry, index) => {
                const position = entries.length - index;
                return (
                  <HistoryEntryRow
                    key={entry.id}
                    entry={entry}
                    position={position}
                    isUndone={position > cursor}
                    translate={translate}
                    language={language}
                  />
                );
              })}
            </ol>

            <div className="mt-3 w-full sm:w-52 flex-shrink-0">
              <DcsButtonOutline type="button" onClick={() => setIsConfirmingClear(true)}>
                {translate("DCS_TRACK_CLEAR")}
              </DcsButtonOutline>
            </div>
          </>
        )}
      </CenteredOverlay>

      {is_confirming_clear && (
        <PortaledConfirm
          titleKey="DCS_TRACK_CLEAR_TITLE"
          messageKey="DCS_TRACK_CLEAR_MESSAGE"
          onCancel={() => setIsConfirmingClear(false)}
          onConfirm={() => {
            setIsConfirmingClear(false);
            onClear({ notify: true });
          }}
        />
      )}
    </>
  );
}
