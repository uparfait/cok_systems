import React, { useMemo, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { save_dashboard } from "./dashboardService.js";
import { field_label_text } from "./chartCatalog.js";
import { eligible_kpi_fields, formulas_for_field, formula_definition, kpi_field_type_key, build_kpi_widgets } from "./kpiCatalog.js";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";

const PRIMARY = "#056daa";
const TEXT_DARK = "#333333";
const TEXT_MUTED = "#9E9E9E";
const HEADING_FONT = { fontFamily: "'Montserrat', sans-serif" };
const MAX_WIDGETS = 150;

function OptionRow({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left border px-3 py-2"
      style={{
        borderColor: selected ? PRIMARY : "#E0E0E0",
        backgroundColor: selected ? "#EAF3F8" : "#FFFFFF",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

/**
 * Adding a KPI card by hand: pick one field (files, dates and nested
 * cascading levels are never offered - nested levels only appear as the
 * automatic breakdown dimensions), pick a formula the field's type allows,
 * name it and optionally describe it. Saving appends the KPI card PLUS its
 * automatic breakdowns by every choice field, all carrying the KPI's title
 * and description - the caller then opens them in the review list before
 * anything loads data.
 */
export default function AddKpiDialog({ form, widgets, onAdded, onCancel }) {
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();

  const [field_id, setFieldId] = useState("");
  const [formula_id, setFormulaId] = useState("");
  const [title, setTitle] = useState("");
  const [title_touched, setTitleTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const fields = useMemo(() => eligible_kpi_fields(form.schema), [form.schema]);
  const field = fields.find((entry) => entry.id === field_id) || null;
  const formulas = field ? formulas_for_field(field) : [];
  const formula = formula_definition(formula_id);

  const default_title = (next_field, next_formula) =>
    next_field && next_formula
      ? translate("DCS_DB_KPI_DEFAULT_TITLE", {
          formula: translate(next_formula.labelKey),
          field: field_label_text(next_field),
        })
      : "";

  const pick_field = (next) => {
    setFieldId(next.id);
    // A formula the new field's type does not allow is dropped.
    const still_allowed = formulas_for_field(next).some((entry) => entry.id === formula_id);
    const next_formula = still_allowed ? formula : null;
    if (!still_allowed) setFormulaId("");
    if (!title_touched) setTitle(default_title(next, next_formula));
  };

  const pick_formula = (next) => {
    setFormulaId(next.id);
    if (!title_touched) setTitle(default_title(field, next));
  };

  const handle_add = async () => {
    const final_title = title.trim();
    if (!field || !formula || !final_title) return;
    setSaving(true);
    try {
      const generated = build_kpi_widgets(form, field, formula.id, final_title, description.trim(), translate);
      const room = Math.max(0, MAX_WIDGETS - widgets.length);
      const added = generated.slice(0, room);
      if (added.length === 0) {
        showError(translate("DCS_DB_KPI_BOARD_FULL"));
        setSaving(false);
        return;
      }
      const merged = widgets.concat(added).map((widget, index) => ({ ...widget, position: index }));
      const saved = await save_dashboard(form.form_group_id, merged);
      const final_widgets = (saved.data && saved.data.widgets) || merged;
      showSuccess(translate("DCS_DB_KPI_ADDED_TOAST", { count: added.length }));
      onAdded(final_widgets, added.map((widget) => widget.id));
    } catch (error) {
      showError((error.response && error.response.data && error.response.data.message) || translate("DCS_ERROR_GENERIC"));
      setSaving(false);
    }
  };

  const section_label = (text) => (
    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: TEXT_MUTED, ...HEADING_FONT }}>
      {text}
    </p>
  );

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={saving ? undefined : onCancel} />
      <div className="relative bg-white border-2 w-full p-5 sm:p-6 flex flex-col" style={{ maxWidth: 560, maxHeight: "88vh", borderColor: PRIMARY }}>
        <p className="text-base font-semibold mb-1" style={{ color: TEXT_DARK, ...HEADING_FONT }}>
          {translate("DCS_DB_ADD_KPI_TITLE")}
        </p>
        <p className="text-xs mb-4" style={{ color: TEXT_MUTED }}>
          {translate("DCS_DB_ADD_KPI_HINT")}
        </p>

        <div className="overflow-y-auto pr-1 flex-1">
          {section_label(translate("DCS_DB_FILTER_FIELD"))}
          <div className="flex flex-col gap-1 mb-4 overflow-y-auto" style={{ maxHeight: "11rem" }}>
            {fields.length === 0 && (
              <p className="text-xs py-1" style={{ color: TEXT_MUTED }}>
                {translate("DCS_DB_KPI_NO_FIELDS")}
              </p>
            )}
            {fields.map((entry) => (
              <OptionRow key={entry.id} selected={entry.id === field_id} onClick={() => pick_field(entry)}>
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm truncate" style={{ color: TEXT_DARK }}>
                    {field_label_text(entry)}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 flex-shrink-0" style={{ color: PRIMARY, backgroundColor: "#EAF3F8", ...HEADING_FONT }}>
                    {translate(kpi_field_type_key(entry))}
                  </span>
                </span>
              </OptionRow>
            ))}
          </div>

          {field && (
            <>
              {section_label(translate("DCS_DB_KPI_FORMULA"))}
              <div className="flex flex-col gap-1 mb-4 overflow-y-auto" style={{ maxHeight: "14rem" }}>
                {formulas.map((entry) => (
                  <OptionRow key={entry.id} selected={entry.id === formula_id} onClick={() => pick_formula(entry)}>
                    <span className="block text-sm font-semibold" style={{ color: TEXT_DARK, ...HEADING_FONT }}>
                      {translate(entry.labelKey)}
                    </span>
                    <span className="block text-xs" style={{ color: TEXT_MUTED }}>
                      {translate(entry.hintKey)}
                    </span>
                  </OptionRow>
                ))}
              </div>
            </>
          )}

          {field && formula && (
            <>
              {section_label(translate("DCS_DB_WIDGET_TITLE"))}
              <input
                className="cok-auth-input w-full py-2 mb-3"
                value={title}
                maxLength={120}
                disabled={saving}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setTitleTouched(true);
                }}
              />
              {section_label(translate("DCS_DB_REVIEW_DESCRIPTION"))}
              <textarea
                className="cok-auth-input w-full py-2 mb-1"
                rows={2}
                maxLength={300}
                placeholder={translate("DCS_DB_REVIEW_DESC_PLACEHOLDER")}
                value={description}
                disabled={saving}
                onChange={(event) => setDescription(event.target.value)}
              />
            </>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          {saving ? (
            <SpiralLoader />
          ) : (
            <>
              <DcsButtonOutline className="flex-1" onClick={onCancel}>
                {translate("DCS_DB_REVIEW_CANCEL_ROW")}
              </DcsButtonOutline>
              <DcsButtonPrimary className="flex-1" disabled={!field || !formula || !title.trim()} onClick={handle_add}>
                {translate("DCS_DB_ADD_KPI")}
              </DcsButtonPrimary>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
