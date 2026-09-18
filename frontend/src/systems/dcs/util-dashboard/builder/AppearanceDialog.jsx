import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { IconButton, CLOSE_SVG } from "../BoardIcons.jsx";
import DcsButtonPrimary from "../../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../../components/DcsButtonOutline.jsx";
import SpiralLoader from "../../../event-managment/components/SpiralLoader.jsx";
import { ChipGrid, PRIMARY, BORDER, TEXT_DARK, TEXT_MUTED, HEADING_FONT } from "./builderUi.jsx";
import ColorInput from "./ColorInput.jsx";
import BoxSettings from "./BoxSettings.jsx";
import { useFanOutValues } from "./useFanOutValues.js";
import { resolve_appearance, build_palette, auto_color, random_color, MODE_DEFAULTS, LEGEND_POSITIONS, UNIT_SIDES } from "../appearance.js";
import { portal_root } from "../portalRoot.js";
import NameSettings from "./NameSettings.jsx";
import CanvasSettings from "./CanvasSettings.jsx";

// A widget's background may be see-through, so that one carries an
// opacity slider; nothing else does.
const MODE_KEYS = [
  { id: "background", labelKey: "DCS_DB_COLOR_BACKGROUND", alpha: true },
  { id: "text", labelKey: "DCS_DB_COLOR_TEXT" },
  { id: "number", labelKey: "DCS_DB_COLOR_NUMBERS" },
  { id: "border", labelKey: "DCS_DB_COLOR_BORDER" },
];

/** Strips defaults so only real customizations are stored. */
function compact(appearance) {
  const out = { theme: appearance.theme };
  if (appearance.legend_position && appearance.legend_position !== "bottom") out.legend_position = appearance.legend_position;
  ["light", "dark"].forEach((name) => {
    const mode = {};
    Object.keys(MODE_DEFAULTS[name]).forEach((key) => {
      if (appearance[name][key] && appearance[name][key] !== MODE_DEFAULTS[name][key]) mode[key] = appearance[name][key];
    });
    if (Object.keys(mode).length > 0) out[name] = mode;
  });
  const value_colors = {};
  Object.keys(appearance.value_colors || {}).forEach((key) => {
    if (appearance.value_colors[key]) value_colors[key] = appearance.value_colors[key];
  });
  if (Object.keys(value_colors).length > 0) out.value_colors = value_colors;
  const value_labels = {};
  Object.keys(appearance.value_labels || {}).forEach((key) => {
    const name = String(appearance.value_labels[key] || "").trim();
    if (name && name !== key) value_labels[key] = name;
  });
  if (Object.keys(value_labels).length > 0) out.value_labels = value_labels;
  // A unit of nothing is no unit at all.
  if (appearance.unit && String(appearance.unit.text || "").trim()) out.unit = { text: appearance.unit.text, at: appearance.unit.at === "start" ? "start" : "end" };
  // Shortening is the default, so only turning it OFF is worth storing.
  if (appearance.compact === false) out.compact = false;
  // Two pixels is what a card draws unless it was told otherwise, so only
  // a different weight - nought among them - is worth storing.
  if (Number.isFinite(Number(appearance.border_width)) && Number(appearance.border_width) !== 2) out.border_width = Number(appearance.border_width);
  return out;
}

/**
 * The color settings of one card, chart or diagram: its light or dark
 * mode, the background / text / number colors of that mode, and one color
 * per legend or category value (auto-assigned, randomizable, or set by
 * pasting a hex / rgb value or picking one). A live preview shows the
 * result before it is applied.
 *
 * Every value can also be RENAMED here. What a form stored stays what it
 * is - the rename only changes what this widget's legend, labels and
 * tooltips call it, so "M" can read as "Male" on the board without
 * touching a single answer.
 *
 * The UNIT is the other half of that: what the numbers are measured in,
 * written at the start of them or at the end - "$12", "1200RWF". It is
 * used exactly as typed, so a space before "RWF" is the author's to give,
 * and it reaches every number the widget prints, not just the big one.
 *
 * A widget that sits in a CANVAS also sets its size and place here (see
 * BoxSettings) - the same two values its drag handles write - so one
 * dialog covers everything about how a widget looks and how much room it
 * takes.
 *
 * A CANVAS itself is offered far less, and deliberately. It is a section:
 * it holds widgets and draws no data of its own, so it has no numbers to
 * put a unit on, nothing to shorten, no values to color and no legend to
 * place. What it has is a surface - its mode, its background, its border,
 * the color of whatever heading it carries - and the way its contents are
 * arranged. Everything else is hidden rather than shown and ignored.
 */
export default function AppearanceDialog({ form, title, description, naming, valuesField, appearance, box, dataless, canvas, onApply, onClose }) {
  const { translate } = useDcsLanguage();
  const [draft, setDraft] = useState(() => resolve_appearance(appearance));
  // The name and the description are set HERE now, not by clicking the
  // card, so a board can be read without every heading being a control.
  const [draft_name, setDraftName] = useState(() => ({ title: title || "", description: description || "" }));
  const [name_missing, setNameMissing] = useState(false);
  // While the change is being saved the dialog stays up and says so, and
  // closes only once the board has it - a dialog that vanished the moment
  // Apply was pressed left nothing to show whether anything had happened.
  const [applying, setApplying] = useState(false);
  // What the save came back with - the server's own message, or its error
  // - shown in the footer where the person is looking. A success closes
  // the dialog once it has been read; an error stays until it is dealt
  // with.
  const [outcome, setOutcome] = useState(null);
  const close_timer = useRef(null);
  useEffect(() => () => window.clearTimeout(close_timer.current), []);
  // Only a widget that sits in a canvas has a size of its own to set; on
  // the board itself the grid decides, and there is nothing to show.
  const [draft_box, setDraftBox] = useState(() => (box ? { ...box } : null));
  const values = useFanOutValues(form, valuesField);
  const palette = useMemo(() => build_palette(draft), [draft]);
  const mode = draft[draft.theme];

  const set_mode_color = (key, color) => setDraft((current) => ({ ...current, [current.theme]: { ...current[current.theme], [key]: color } }));
  const set_value_color = (label, color) =>
    setDraft((current) => {
      const next = { ...current.value_colors };
      if (color) next[String(label)] = color;
      else delete next[String(label)];
      return { ...current, value_colors: next };
    });
  const randomize = () =>
    setDraft((current) => {
      const next = { ...current.value_colors };
      values.list.forEach((label) => {
        next[String(label)] = random_color();
      });
      return { ...current, value_colors: next };
    });
  const reset_values = () => setDraft((current) => ({ ...current, value_colors: {} }));
  const set_value_label = (label, name) =>
    setDraft((current) => {
      const next = { ...current.value_labels };
      if (name && name.trim()) next[String(label)] = name.slice(0, 120);
      else delete next[String(label)];
      return { ...current, value_labels: next };
    });
  const reset_labels = () => setDraft((current) => ({ ...current, value_labels: {} }));
  const reset_all = () => setDraft(resolve_appearance(null));

  // A widget must be named; a section need not be, because it holds
  // widgets rather than data and an unnamed one simply draws no heading.
  const apply = async () => {
    if (applying) return;
    const named = String(draft_name.title || "").trim();
    if (naming !== false && !dataless && !named) {
      setNameMissing(true);
      return;
    }
    setApplying(true);
    setOutcome(null);
    let result;
    try {
      result = await onApply({
        appearance: compact(draft),
        box: draft_box,
        canvas: draft_canvas,
        title: named,
        description: String(draft_name.description || "").trim() || null,
      });
    } catch (error) {
      result = { ok: false, message: (error && error.message) || translate("DCS_ERROR_GENERIC") };
    } finally {
      setApplying(false);
    }
    // A caller that answers nothing closes the dialog itself.
    if (!result || typeof result !== "object") return;
    setOutcome({ error: result.ok === false, text: result.message || "" });
    if (result.ok !== false) close_timer.current = window.setTimeout(onClose, 1400);
  };

  const mode_chips = [
    { id: "light", label: translate("DCS_DB_COLOR_LIGHT") },
    { id: "dark", label: translate("DCS_DB_COLOR_DARK") },
  ];
  const preview_values = values.list.slice(0, 4);
  // A section has a surface and a layout; everything else on this dialog
  // is about numbers and values it does not have.
  const [draft_canvas, setDraftCanvas] = useState(() => (canvas ? { ...canvas } : null));
  const colors_shown = dataless ? MODE_KEYS.filter((entry) => entry.id !== "number") : MODE_KEYS;

  return createPortal(
    <div className="fixed inset-0 z-[10020] flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/45" onClick={applying ? undefined : onClose} />
      <div className="dcs-builder-pop relative bg-white border-2 w-full flex flex-col" style={{ maxWidth: 720, maxHeight: "92vh", borderColor: PRIMARY }}>
        <div className="flex items-center justify-between gap-2 flex-shrink-0 px-4 sm:px-5 py-2" style={{ backgroundColor: PRIMARY }}>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase leading-tight truncate" style={{ color: "#FFFFFF", letterSpacing: "0.3px", ...HEADING_FONT }}>
              {translate("DCS_DB_COLOR_SETTINGS")}
            </p>
            <p className="text-[11px] font-semibold truncate" style={{ color: "rgba(255,255,255,0.85)", ...HEADING_FONT }}>
              {title}
            </p>
          </div>
          <IconButton title={translate("DCS_BTN_CLOSE")} onClick={onClose} onDark danger disabled={applying}>
            {CLOSE_SVG}
          </IconButton>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-4 flex flex-col gap-5">
          {naming !== false && (
          <NameSettings
            title={draft_name.title}
            description={draft_name.description}
            optional={dataless}
            error={name_missing}
            onChange={(changes) => {
              setNameMissing(false);
              setDraftName((current) => Object.assign({}, current, changes));
            }}
          />
          )}
          <div
            className="dcs-view-swap border px-4 py-3 flex items-center justify-between gap-4 flex-wrap"
            style={{ backgroundColor: palette.background, borderColor: palette.border, transition: "background-color 220ms ease, color 220ms ease" }}
          >
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase" style={{ color: palette.muted, letterSpacing: "0.5px", ...HEADING_FONT }}>
                {translate("DCS_DB_COLOR_PREVIEW")}
              </p>
              <p className="text-sm font-semibold truncate" style={{ color: palette.text, ...HEADING_FONT }}>
                {title}
              </p>
              {dataless ? (
                <p className="text-xs" style={{ color: palette.muted }}>{translate("DCS_DB_CANVAS_PREVIEW_HINT")}</p>
              ) : (
                <p className="font-bold" style={{ color: palette.number, fontSize: 26, lineHeight: 1.1, ...HEADING_FONT }}>
                  1,234
                </p>
              )}
            </div>
            {dataless ? (
              // Three empty boxes: what a section holds is widgets.
              <div className="flex gap-2">
                {[0, 1, 2].map((slot) => (
                  <span key={slot} style={{ width: 34, height: 26, border: `1px solid ${palette.border}`, backgroundColor: palette.soft, transition: "background-color 220ms ease" }} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {(preview_values.length > 0 ? preview_values : ["A", "B", "C"]).map((label, index) => (
                  <span key={String(label)} className="flex items-center gap-2 text-xs">
                    <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: palette.color_for(label, index), transition: "background-color 220ms ease" }} />
                    <span className="truncate" style={{ color: palette.text, maxWidth: 140 }}>{String(label)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          <section>
            <p className="text-xs font-bold uppercase mb-2" style={{ color: TEXT_DARK, letterSpacing: "0.5px", ...HEADING_FONT }}>
              {translate("DCS_DB_COLOR_THEME")}
            </p>
            <ChipGrid options={mode_chips} value={draft.theme} onChange={(theme) => setDraft((current) => ({ ...current, theme }))} columns="grid-cols-2 sm:w-64" />
          </section>

          <section>
            <p className="text-xs font-bold uppercase mb-1" style={{ color: TEXT_DARK, letterSpacing: "0.5px", ...HEADING_FONT }}>
              {translate("DCS_DB_COLOR_MODE_COLORS", { mode: translate(draft.theme === "dark" ? "DCS_DB_COLOR_DARK" : "DCS_DB_COLOR_LIGHT") })}
            </p>
            <p className="text-xs mb-2" style={{ color: TEXT_MUTED }}>
              {translate("DCS_DB_COLOR_MODE_HINT")}
            </p>
            <div className="flex flex-col gap-2">
              {colors_shown.map((entry) => (
                <ColorInput
                  key={`${draft.theme}-${entry.id}`}
                  label={translate(entry.labelKey)}
                  value={mode[entry.id]}
                  alpha={entry.alpha}
                  onChange={(color) => set_mode_color(entry.id, color)}
                  onClear={mode[entry.id] !== MODE_DEFAULTS[draft.theme][entry.id] ? () => set_mode_color(entry.id, MODE_DEFAULTS[draft.theme][entry.id]) : null}
                />
              ))}
            </div>
            {/* How HEAVY the outline is, nought among the answers: a card
                with no border sits flush with whatever is around it, which
                is what a widget inside a section usually wants. */}
            <label className="flex items-center gap-2 mt-2">
              <span className="text-xs flex-1" style={{ color: TEXT_DARK, ...HEADING_FONT }}>{translate("DCS_DB_COLOR_BORDER_WIDTH")}</span>
              <input
                type="number"
                min="0"
                max="8"
                step="1"
                className="dcs-rename-input"
                style={{ width: 84 }}
                value={Number.isFinite(Number(draft.border_width)) ? draft.border_width : 2}
                onChange={(event) => {
                  const next = Math.max(0, Math.min(8, Math.round(Number(event.target.value) || 0)));
                  setDraft((current) => Object.assign({}, current, { border_width: next }));
                }}
              />
              <span className="text-xs" style={{ color: TEXT_MUTED, width: 72 }}>
                {translate(Number(draft.border_width) === 0 ? "DCS_DB_COLOR_BORDER_NONE" : "DCS_DB_COLOR_BORDER_PX")}
              </span>
            </label>
          </section>

          {draft_box && (
            <section>
              <p className="text-xs font-bold uppercase mb-2" style={{ color: TEXT_DARK, letterSpacing: "0.5px", ...HEADING_FONT }}>
                {translate("DCS_DB_BOX_TITLE")}
              </p>
              <BoxSettings box={draft_box} onChange={setDraftBox} />
            </section>
          )}

          {!dataless && (
          <section>
            <p className="text-xs font-bold uppercase mb-1" style={{ color: TEXT_DARK, letterSpacing: "0.5px", ...HEADING_FONT }}>
              {translate("DCS_DB_UNIT")}
            </p>
            <p className="text-xs mb-2" style={{ color: TEXT_MUTED }}>
              {translate("DCS_DB_UNIT_HINT")}
            </p>
            <label className="flex items-center gap-2 mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.compact !== false}
                style={{ accentColor: PRIMARY }}
                onChange={(event) => setDraft((current) => ({ ...current, compact: event.target.checked }))}
              />
              <span className="text-xs" style={{ color: TEXT_DARK, ...HEADING_FONT }}>
                {translate("DCS_DB_COMPACT")}
              </span>
            </label>
            <p className="text-xs mb-2" style={{ color: TEXT_MUTED }}>
              {translate("DCS_DB_COMPACT_HINT")}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="dcs-rename-input"
                value={draft.unit.text}
                placeholder={translate("DCS_DB_UNIT_PLACEHOLDER")}
                maxLength={12}
                aria-label={translate("DCS_DB_UNIT")}
                onChange={(event) => setDraft((current) => ({ ...current, unit: { ...current.unit, text: event.target.value } }))}
              />
              <ChipGrid
                options={UNIT_SIDES.map((side) => ({ id: side, label: translate(side === "start" ? "DCS_DB_UNIT_START" : "DCS_DB_UNIT_END") }))}
                value={draft.unit.at}
                onChange={(at) => setDraft((current) => ({ ...current, unit: { ...current.unit, at } }))}
                columns="grid-cols-2 sm:w-64"
              />
            </div>
          </section>
          )}

          {!dataless && (
          <section>
            <p className="text-xs font-bold uppercase mb-2" style={{ color: TEXT_DARK, letterSpacing: "0.5px", ...HEADING_FONT }}>
              {translate("DCS_DB_LEGEND_POSITION")}
            </p>
            <ChipGrid
              options={LEGEND_POSITIONS.map((position) => ({ id: position, label: translate(`DCS_DB_LEGEND_${position.toUpperCase()}`) }))}
              value={draft.legend_position}
              onChange={(legend_position) => setDraft((current) => ({ ...current, legend_position }))}
              columns="grid-cols-2 sm:grid-cols-4"
            />
          </section>
          )}

          {draft_canvas && <CanvasSettings canvas={draft_canvas} onChange={setDraftCanvas} />}

          {!dataless && (
          <section>
            <p className="text-xs font-bold uppercase mb-1" style={{ color: TEXT_DARK, letterSpacing: "0.5px", ...HEADING_FONT }}>
              {valuesField ? translate("DCS_DB_COLOR_VALUES", { field: valuesField.label }) : translate("DCS_DB_COLOR_VALUES_NONE_TITLE")}
            </p>
            {!valuesField ? (
              <p className="text-xs" style={{ color: TEXT_MUTED }}>
                {translate("DCS_DB_COLOR_NO_VALUES")}
              </p>
            ) : values.loading ? (
              <div className="flex items-center gap-2 py-2">
                <SpiralLoader padded={false} size={16} />
                <span className="text-xs" style={{ color: TEXT_MUTED }}>{translate("DCS_DB_IN_EACH_LOADING")}</span>
              </div>
            ) : values.list.length === 0 ? (
              <p className="text-xs" style={{ color: TEXT_MUTED }}>
                {translate("DCS_DB_IN_EACH_NONE")}
              </p>
            ) : (
              <>
                <p className="text-xs mb-2" style={{ color: TEXT_MUTED }}>
                  {translate("DCS_DB_COLOR_VALUES_HINT")}
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  <button type="button" onClick={randomize} className="text-xs font-bold uppercase px-3 py-1.5 cursor-pointer" style={{ color: PRIMARY, border: `1px solid ${PRIMARY}`, background: "none", letterSpacing: "0.4px", ...HEADING_FONT }}>
                    {translate("DCS_DB_COLOR_RANDOM")}
                  </button>
                  <button type="button" onClick={reset_values} className="text-xs font-bold uppercase px-3 py-1.5 cursor-pointer" style={{ color: TEXT_MUTED, border: `1px solid ${BORDER}`, background: "none", letterSpacing: "0.4px", ...HEADING_FONT }}>
                    {translate("DCS_DB_COLOR_AUTO")}
                  </button>
                  <button type="button" onClick={reset_labels} className="text-xs font-bold uppercase px-3 py-1.5 cursor-pointer" style={{ color: TEXT_MUTED, border: `1px solid ${BORDER}`, background: "none", letterSpacing: "0.4px", ...HEADING_FONT }}>
                    {translate("DCS_DB_COLOR_RENAME_RESET")}
                  </button>
                </div>
                <div className="flex flex-col gap-2" style={{ maxHeight: 260, overflowY: "auto" }}>
                  {values.list.map((label, index) => (
                    <div key={String(label)} className="flex flex-wrap items-end gap-2">
                      <div className="min-w-0 flex-1">
                        <ColorInput
                          label={String(label)}
                          value={draft.value_colors[String(label)] || ""}
                          fallback={auto_color(index)}
                          autoTag={translate("DCS_DB_COLOR_AUTO_TAG")}
                          onChange={(color) => set_value_color(label, color)}
                          onClear={() => set_value_color(label, "")}
                        />
                      </div>
                      <input
                        className="dcs-rename-input"
                        value={draft.value_labels[String(label)] || ""}
                        placeholder={translate("DCS_DB_COLOR_RENAME_PLACEHOLDER")}
                        title={translate("DCS_DB_COLOR_RENAME")}
                        onChange={(event) => set_value_label(label, event.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
          )}
        </div>

        <div className="flex-shrink-0 px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2" style={{ borderTop: `1px solid ${BORDER}` }}>
          {outcome && outcome.error ? (
            <p className="text-xs font-semibold sm:flex-1" role="alert" style={{ color: "#E74C3C", ...HEADING_FONT }}>
              {outcome.text}
            </p>
          ) : (
            <button type="button" onClick={reset_all} className="text-xs text-left cursor-pointer sm:flex-1" style={{ color: TEXT_MUTED, background: "none", border: "none", padding: 0, textDecoration: "underline", ...HEADING_FONT }}>
              {translate("DCS_DB_COLOR_RESET_ALL")}
            </button>
          )}
          {applying ? (
            <div className="flex items-center gap-2 sm:w-80 justify-end">
              <SpiralLoader padded={false} size={20} />
              <span className="text-xs font-semibold" style={{ color: PRIMARY, ...HEADING_FONT }}>{translate("DCS_DB_ICON_APPLYING")}</span>
            </div>
          ) : outcome && !outcome.error ? (
            <p className="text-xs font-semibold sm:w-80 text-right" role="status" style={{ color: "#1E8E3E", ...HEADING_FONT }}>
              {outcome.text}
            </p>
          ) : (
            <>
              <DcsButtonOutline className="sm:w-32" onClick={onClose}>
                {translate("DCS_DB_BUILDER_CANCEL")}
              </DcsButtonOutline>
              <DcsButtonPrimary className="sm:w-44" onClick={apply}>
                {translate("DCS_DB_COLOR_APPLY")}
              </DcsButtonPrimary>
            </>
          )}
        </div>
      </div>
    </div>,
    portal_root(),
  );
}
