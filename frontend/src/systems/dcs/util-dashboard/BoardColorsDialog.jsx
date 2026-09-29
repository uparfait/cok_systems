import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { IconButton, CLOSE_SVG } from "./BoardIcons.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import { ChipGrid, PRIMARY, TEXT_DARK, TEXT_MUTED, HEADING_FONT } from "./builder/builderUi.jsx";
import ColorInput from "./builder/ColorInput.jsx";
import { resolve_board_colors, auto_border, auto_text } from "./boardColors.jsx";
import { portal_root } from "./portalRoot.js";

const START = "#0f171f";

/**
 * THE COLORS OF THE WHOLE BOARD, set in one place.
 *
 * A background, which the page and every widget on it are painted in, and
 * the BORDER each widget draws around itself - the one thing that still
 * separates the cards once they share a background. The words are colored
 * automatically, dark on a pale board and pale on a dark one, and may be
 * overridden; so may the outline. Either can be put back to automatic
 * without touching the other, and the whole board can be put back to the
 * system's own light look.
 *
 * The preview is the real thing: the same colors, the same outlines, the
 * same worked-out muted tone, on two cards and a chart's grid.
 *
 * The colours go to THIS board alone, or to every dashboard of the form
 * in one go so a form's boards read as one set - an explicit choice, made
 * before they are applied.
 */
export default function BoardColorsDialog({ appearance, boardName, onApply, onClose }) {
  const { translate } = useDcsLanguage();
  const [draft, setDraft] = useState(() => (appearance && typeof appearance === "object" ? { ...appearance } : null));
  const [every, setEvery] = useState(false);
  const [applying, setApplying] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const close_timer = useRef(null);
  useEffect(() => () => window.clearTimeout(close_timer.current), []);

  const colors = resolve_board_colors(draft);
  const painted = !!colors;
  const set_color = (key, value) =>
    setDraft((current) => {
      const next = Object.assign({}, current || {});
      if (value) next[key] = value;
      else delete next[key];
      return next.background ? next : null;
    });

  const apply = async () => {
    if (applying) return;
    setApplying(true);
    setOutcome(null);
    let result;
    try {
      result = await onApply({ appearance: painted ? draft : null, apply_to_all: every });
    } catch (error) {
      result = { ok: false, message: (error && error.message) || translate("DCS_ERROR_GENERIC") };
    } finally {
      setApplying(false);
    }
    if (!result || typeof result !== "object") return;
    setOutcome({ error: result.ok === false, text: result.message || "" });
    if (result.ok !== false) close_timer.current = window.setTimeout(onClose, 1200);
  };

  const card_style = {
    backgroundColor: colors ? colors.surface : "#FFFFFF",
    borderColor: colors ? colors.border : "#E0E0E0",
    color: colors ? colors.text : "#333333",
    borderWidth: 2,
    borderStyle: "solid",
  };

  return createPortal(
    <div className="fixed inset-0 z-[10020] flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/45" onClick={applying ? undefined : onClose} />
      <div className="dcs-builder-pop relative bg-white border-2 w-full flex flex-col" style={{ maxWidth: 560, maxHeight: "92vh", borderColor: PRIMARY }}>
        <div className="flex items-center justify-between gap-2 flex-shrink-0 px-4 sm:px-5 py-2" style={{ backgroundColor: PRIMARY }}>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase leading-tight truncate" style={{ color: "#FFFFFF", letterSpacing: "0.3px", ...HEADING_FONT }}>
              {translate("DCS_DB_BOARD_COLORS")}
            </p>
            <p className="text-[11px] font-semibold truncate" style={{ color: "rgba(255,255,255,0.85)", ...HEADING_FONT }}>
              {boardName}
            </p>
          </div>
          <IconButton title={translate("DCS_BTN_CLOSE")} onClick={onClose} onDark danger disabled={applying}>
            {CLOSE_SVG}
          </IconButton>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3 flex flex-col gap-3">
          <p className="text-xs" style={{ color: TEXT_MUTED }}>
            {translate("DCS_DB_BOARD_COLORS_HINT")}
          </p>

          <div className="flex flex-col gap-2">
            <ColorInput
              label={translate("DCS_DB_COLOR_BACKGROUND")}
              value={draft && draft.background ? draft.background : ""}
              fallback="#f4f7f9"
              autoTag={translate("DCS_DB_COLOR_AUTO_TAG")}
              disabled={!painted}
              onChange={(color) => set_color("background", color)}
            />
            <ColorInput
              label={translate("DCS_DB_BOARD_COLOR_BORDER")}
              value={draft && draft.border ? draft.border : ""}
              fallback={painted ? auto_border(colors.background) : "#e0e0e0"}
              autoTag={translate("DCS_DB_COLOR_AUTO_TAG")}
              disabled={!painted}
              onChange={(color) => set_color("border", color)}
              onClear={() => set_color("border", null)}
            />
            <ColorInput
              label={translate("DCS_DB_COLOR_TEXT")}
              value={draft && draft.text ? draft.text : ""}
              fallback={painted ? auto_text(colors.background) : "#333333"}
              autoTag={translate("DCS_DB_COLOR_AUTO_TAG")}
              disabled={!painted}
              onChange={(color) => set_color("text", color)}
              onClear={() => set_color("text", null)}
            />
          </div>

          {!painted && (
            <button
              type="button"
              className="text-xs font-semibold self-start cursor-pointer"
              style={{ color: PRIMARY, background: "none", border: "none", padding: 0, ...HEADING_FONT }}
              onClick={() => setDraft({ background: START })}
            >
              {translate("DCS_DB_BOARD_COLORS_PAINT")}
            </button>
          )}

          <div>
            <p className="text-xs font-bold uppercase mb-1" style={{ color: TEXT_DARK, letterSpacing: "0.5px", ...HEADING_FONT }}>
              {translate("DCS_DB_BOARD_COLORS_PREVIEW")}
            </p>
            <div className="p-3 flex flex-wrap gap-2" style={{ backgroundColor: colors ? colors.background : "#F4F7F9" }}>
              {[0, 1].map((index) => (
                <div key={index} className="flex-1 min-w-0 p-2" style={card_style}>
                  <p className="text-[11px] font-semibold truncate m-0" style={{ ...HEADING_FONT }}>
                    {translate(index === 0 ? "DCS_DB_BOARD_COLORS_CARD" : "DCS_DB_BOARD_COLORS_CARD_TWO")}
                  </p>
                  <p className="text-lg font-bold m-0" style={{ ...HEADING_FONT }}>
                    {index === 0 ? "1.2k" : "348"}
                  </p>
                  <p className="text-[10px] m-0" style={{ color: colors ? colors.muted : "#9E9E9E" }}>
                    {translate("DCS_DB_BOARD_COLORS_MUTED")}
                  </p>
                  <span className="block mt-1" style={{ height: 3, backgroundColor: colors ? colors.grid : "#E0E0E0" }} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase mb-1" style={{ color: TEXT_DARK, letterSpacing: "0.5px", ...HEADING_FONT }}>
              {translate("DCS_DB_BOARD_COLORS_SCOPE")}
            </p>
            <ChipGrid
              options={[
                { id: "one", label: translate("DCS_DB_BOARD_COLORS_ONE") },
                { id: "every", label: translate("DCS_DB_BOARD_COLORS_EVERY") },
              ]}
              value={every ? "every" : "one"}
              onChange={(scope) => setEvery(scope === "every")}
              disabled={applying}
              columns="grid-cols-1 sm:grid-cols-2"
            />
          </div>
        </div>

        {/* The line that puts the board back to the usual colours reads in
            full: on a narrow dialog it takes a row of its own above the
            buttons rather than being squeezed behind them. */}
        <div className="flex-shrink-0 px-4 sm:px-5 py-2 border-t-2 flex flex-wrap items-center justify-end gap-2" style={{ borderColor: PRIMARY }}>
          <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
            {outcome ? (
              <p className="text-[11px] font-semibold truncate m-0" style={{ color: outcome.error ? "#E74C3C" : "#1E8449", ...HEADING_FONT }}>
                {outcome.text}
              </p>
            ) : (
              painted && (
                <button
                  type="button"
                  className="text-[11px] font-semibold cursor-pointer"
                  style={{ color: TEXT_MUTED, background: "none", border: "none", padding: 0, ...HEADING_FONT }}
                  disabled={applying}
                  onClick={() => setDraft(null)}
                >
                  {translate("DCS_DB_BOARD_COLORS_RESET")}
                </button>
              )
            )}
          </div>
          <DcsButtonOutline onClick={onClose} disabled={applying}>
            {translate("DCS_BTN_CANCEL")}
          </DcsButtonOutline>
          <DcsButtonPrimary onClick={apply} disabled={applying}>
            {translate(applying ? "DCS_DB_SAVING" : "DCS_BTN_APPLY")}
          </DcsButtonPrimary>
        </div>
      </div>
    </div>,
    portal_root(),
  );
}
