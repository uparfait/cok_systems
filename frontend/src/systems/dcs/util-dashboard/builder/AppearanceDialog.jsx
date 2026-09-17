import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { IconButton, CLOSE_SVG } from "../BoardIcons.jsx";
import DcsButtonPrimary from "../../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../../components/DcsButtonOutline.jsx";
import SpiralLoader from "../../../event-managment/components/SpiralLoader.jsx";
import { ChipGrid, PRIMARY, BORDER, TEXT_DARK, TEXT_MUTED, HEADING_FONT } from "./builderUi.jsx";
import ColorInput from "./ColorInput.jsx";
import { useFanOutValues } from "./useFanOutValues.js";
import { resolve_appearance, build_palette, auto_color, random_color, MODE_DEFAULTS, LEGEND_POSITIONS } from "../appearance.js";
import { portal_root } from "../portalRoot.js";

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
 */
export default function AppearanceDialog({ form, title, valuesField, appearance, onApply, onClose }) {
  const { translate } = useDcsLanguage();
  const [draft, setDraft] = useState(() => resolve_appearance(appearance));
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

  const mode_chips = [
    { id: "light", label: translate("DCS_DB_COLOR_LIGHT") },
    { id: "dark", label: translate("DCS_DB_COLOR_DARK") },
  ];
  const preview_values = values.list.slice(0, 4);

  return createPortal(
    <div className="fixed inset-0 z-[10020] flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
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
          <IconButton title={translate("DCS_BTN_CLOSE")} onClick={onClose} onDark danger>
            {CLOSE_SVG}
          </IconButton>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-4 flex flex-col gap-5">
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
              <p className="font-bold" style={{ color: palette.number, fontSize: 26, lineHeight: 1.1, ...HEADING_FONT }}>
                1,234
              </p>
            </div>
            <div className="flex flex-col gap-1">
              {(preview_values.length > 0 ? preview_values : ["A", "B", "C"]).map((label, index) => (
                <span key={String(label)} className="flex items-center gap-2 text-xs">
                  <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: palette.color_for(label, index), transition: "background-color 220ms ease" }} />
                  <span className="truncate" style={{ color: palette.text, maxWidth: 140 }}>{String(label)}</span>
                </span>
              ))}
            </div>
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
              {MODE_KEYS.map((entry) => (
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
          </section>

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
        </div>

        <div className="flex-shrink-0 px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2" style={{ borderTop: `1px solid ${BORDER}` }}>
          <button type="button" onClick={reset_all} className="text-xs text-left cursor-pointer sm:flex-1" style={{ color: TEXT_MUTED, background: "none", border: "none", padding: 0, textDecoration: "underline", ...HEADING_FONT }}>
            {translate("DCS_DB_COLOR_RESET_ALL")}
          </button>
          <DcsButtonOutline className="sm:w-32" onClick={onClose}>
            {translate("DCS_DB_BUILDER_CANCEL")}
          </DcsButtonOutline>
          <DcsButtonPrimary className="sm:w-44" onClick={() => onApply(compact(draft))}>
            {translate("DCS_DB_COLOR_APPLY")}
          </DcsButtonPrimary>
        </div>
      </div>
    </div>,
    portal_root(),
  );
}
