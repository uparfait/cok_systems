import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { IconButton, CLOSE_SVG } from "../BoardIcons.jsx";
import DcsButtonPrimary from "../../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../../components/DcsButtonOutline.jsx";
import SpiralLoader from "../../../event-managment/components/SpiralLoader.jsx";
import { ChipGrid, PRIMARY, BORDER, TEXT_DARK, TEXT_MUTED, HEADING_FONT } from "../builder/builderUi.jsx";
import ColorInput from "../builder/ColorInput.jsx";
import { useFanOutValues } from "../builder/useFanOutValues.js";
import { appearance_values_field } from "../builder/composeWidgets.js";
import { auto_color, random_color, LEGEND_POSITIONS, resolve_appearance } from "../appearance.js";
import { shared_text, apply_shared } from "./commonText.js";

const KEEP = "__keep__";

function Section({ title, children }) {
  return (
    <section>
      <p className="text-xs font-bold uppercase mb-2" style={{ color: TEXT_DARK, letterSpacing: "0.5px", ...HEADING_FONT }}>
        {title}
      </p>
      {children}
    </section>
  );
}

/** A shared text (whole or prefix) edited once, with the resulting titles previewed. */
function SharedTextEditor({ texts, description, value, onChange, translate }) {
  if (description.kind === "none") {
    return (
      <p className="text-xs" style={{ color: TEXT_MUTED }}>
        {translate("DCS_DB_BULK_NO_COMMON")}
      </p>
    );
  }
  return (
    <div>
      <p className="text-xs mb-1" style={{ color: TEXT_MUTED }}>
        {translate("DCS_DB_BULK_COMMON")}
      </p>
      <input className="cok-auth-input w-full py-2" value={value} maxLength={120} onChange={(event) => onChange(event.target.value)} />
      <p className="text-[10px] font-bold uppercase mt-2 mb-1" style={{ color: TEXT_MUTED, letterSpacing: "0.4px", ...HEADING_FONT }}>
        {translate("DCS_DB_BULK_RESULT")}
      </p>
      <ul className="text-xs flex flex-col gap-0.5" style={{ color: TEXT_DARK, maxHeight: 96, overflowY: "auto" }}>
        {texts.slice(0, 12).map((text, index) => (
          <li key={index} className="truncate">
            {apply_shared(text, description, value) || <span style={{ color: TEXT_MUTED }}>-</span>}
          </li>
        ))}
        {texts.length > 12 && <li style={{ color: TEXT_MUTED }}>+{texts.length - 12}</li>}
      </ul>
    </div>
  );
}

/**
 * Edits several selected widgets at once - only what they share: a common
 * title or title prefix, a common description, the legend colors when they
 * all draw the same legend field, and the legend position and mode for all
 * of them. Everything else stays untouched.
 */
export default function BulkEditDialog({ form, fields, widgets, onApply, onClose }) {
  const { translate } = useDcsLanguage();
  const titles = widgets.map((widget) => widget.title || "");
  const descriptions = widgets.map((widget) => widget.description || "");
  const title_shared = useMemo(() => shared_text(titles), [titles.join("")]);
  const description_shared = useMemo(() => shared_text(descriptions), [descriptions.join("")]);
  const [title_value, setTitleValue] = useState(title_shared.shared);
  const [description_value, setDescriptionValue] = useState(description_shared.shared);
  const [legend_position, setLegendPosition] = useState(KEEP);
  const [theme, setTheme] = useState(KEEP);
  const [value_colors, setValueColors] = useState({});

  // Legend colors are shared only when every widget draws the same field.
  const legend_fields = widgets.map((widget) => appearance_values_field(widget, fields));
  const legend_field = legend_fields.every((field) => field && legend_fields[0] && field.id === legend_fields[0].id) ? legend_fields[0] : null;
  const values = useFanOutValues(form, legend_field);
  const first_appearance = resolve_appearance(widgets[0] && widgets[0].appearance);

  const set_value_color = (label, color) =>
    setValueColors((current) => {
      const next = { ...current };
      if (color) next[String(label)] = color;
      else next[String(label)] = "";
      return next;
    });

  const handle_apply = () => {
    const patches = {};
    widgets.forEach((widget) => {
      const patch = {};
      if (title_shared.kind !== "none" && title_value !== title_shared.shared) {
        const next = apply_shared(widget.title, title_shared, title_value).trim();
        if (next) patch.title = next.slice(0, 120);
      }
      if (description_shared.kind !== "none" && description_value !== description_shared.shared) {
        patch.description = apply_shared(widget.description, description_shared, description_value).trim().slice(0, 300) || null;
      }
      const appearance = { ...(widget.appearance || {}) };
      let touched = false;
      if (legend_position !== KEEP) {
        appearance.legend_position = legend_position;
        touched = true;
      }
      if (theme !== KEEP) {
        appearance.theme = theme;
        touched = true;
      }
      if (Object.keys(value_colors).length > 0) {
        const colors = { ...(appearance.value_colors || {}) };
        Object.keys(value_colors).forEach((label) => {
          if (value_colors[label]) colors[label] = value_colors[label];
          else delete colors[label];
        });
        appearance.value_colors = colors;
        touched = true;
      }
      if (touched) patch.appearance = { theme: appearance.theme || "light", ...appearance };
      if (Object.keys(patch).length > 0) patches[widget.id] = patch;
    });
    onApply(patches);
  };

  const keep_option = { id: KEEP, label: translate("DCS_DB_BULK_KEEP") };

  return createPortal(
    <div className="fixed inset-0 z-[10020] flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="dcs-builder-pop relative bg-white border-2 w-full flex flex-col" style={{ maxWidth: 720, maxHeight: "92vh", borderColor: PRIMARY }}>
        <div className="flex items-center justify-between gap-2 flex-shrink-0 px-4 sm:px-5 py-2" style={{ backgroundColor: PRIMARY }}>
          <p className="text-xs font-bold uppercase leading-tight truncate" style={{ color: "#FFFFFF", letterSpacing: "0.3px", ...HEADING_FONT }}>
            {translate("DCS_DB_BULK_TITLE", { count: widgets.length })}
          </p>
          <IconButton title={translate("DCS_BTN_CLOSE")} onClick={onClose} onDark danger>
            {CLOSE_SVG}
          </IconButton>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-4 flex flex-col gap-5">
          <Section title={translate("DCS_DB_BULK_TITLES")}>
            <SharedTextEditor texts={titles} description={title_shared} value={title_value} onChange={setTitleValue} translate={translate} />
          </Section>
          <Section title={translate("DCS_DB_BULK_DESCRIPTIONS")}>
            <SharedTextEditor texts={descriptions} description={description_shared} value={description_value} onChange={setDescriptionValue} translate={translate} />
          </Section>
          <Section title={translate("DCS_DB_LEGEND_POSITION")}>
            <ChipGrid options={[keep_option].concat(LEGEND_POSITIONS.map((position) => ({ id: position, label: translate(`DCS_DB_LEGEND_${position.toUpperCase()}`) })))} value={legend_position} onChange={setLegendPosition} columns="grid-cols-2 sm:grid-cols-5" />
          </Section>
          <Section title={translate("DCS_DB_COLOR_THEME")}>
            <ChipGrid options={[keep_option, { id: "light", label: translate("DCS_DB_COLOR_LIGHT") }, { id: "dark", label: translate("DCS_DB_COLOR_DARK") }]} value={theme} onChange={setTheme} columns="grid-cols-3 sm:w-96" />
          </Section>
          <Section title={legend_field ? translate("DCS_DB_COLOR_VALUES", { field: legend_field.label }) : translate("DCS_DB_BULK_LEGEND")}>
            {!legend_field ? (
              <p className="text-xs" style={{ color: TEXT_MUTED }}>{translate("DCS_DB_BULK_LEGEND_MIXED")}</p>
            ) : values.loading ? (
              <div className="flex items-center gap-2 py-2">
                <SpiralLoader padded={false} size={16} />
                <span className="text-xs" style={{ color: TEXT_MUTED }}>{translate("DCS_DB_IN_EACH_LOADING")}</span>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mb-3">
                  <button type="button" className="text-xs font-bold uppercase px-3 py-1.5 cursor-pointer" style={{ color: PRIMARY, border: `1px solid ${PRIMARY}`, background: "none", letterSpacing: "0.4px", ...HEADING_FONT }} onClick={() => setValueColors(Object.fromEntries(values.list.map((label) => [String(label), random_color()])))}>
                    {translate("DCS_DB_COLOR_RANDOM")}
                  </button>
                  <button type="button" className="text-xs font-bold uppercase px-3 py-1.5 cursor-pointer" style={{ color: TEXT_MUTED, border: `1px solid ${BORDER}`, background: "none", letterSpacing: "0.4px", ...HEADING_FONT }} onClick={() => setValueColors(Object.fromEntries(values.list.map((label) => [String(label), ""])))}>
                    {translate("DCS_DB_COLOR_AUTO")}
                  </button>
                </div>
                <div className="flex flex-col gap-2" style={{ maxHeight: 220, overflowY: "auto" }}>
                  {values.list.map((label, index) => (
                    <ColorInput
                      key={String(label)}
                      label={String(label)}
                      value={value_colors[String(label)] !== undefined ? value_colors[String(label)] : first_appearance.value_colors[String(label)] || ""}
                      fallback={auto_color(index)}
                      autoTag={translate("DCS_DB_COLOR_AUTO_TAG")}
                      onChange={(color) => set_value_color(label, color)}
                      onClear={() => set_value_color(label, "")}
                    />
                  ))}
                </div>
              </>
            )}
          </Section>
        </div>

        <div className="flex-shrink-0 px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:justify-end gap-2" style={{ borderTop: `1px solid ${BORDER}` }}>
          <DcsButtonOutline className="sm:w-32" onClick={onClose}>
            {translate("DCS_DB_BUILDER_CANCEL")}
          </DcsButtonOutline>
          <DcsButtonPrimary className="sm:w-56" onClick={handle_apply}>
            {translate("DCS_DB_BULK_APPLY", { count: widgets.length })}
          </DcsButtonPrimary>
        </div>
      </div>
    </div>,
    document.body,
  );
}
