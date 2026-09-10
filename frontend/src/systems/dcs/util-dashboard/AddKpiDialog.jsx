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
const DANGER = "#E74C3C";
const TEXT_DARK = "#333333";
const TEXT_MUTED = "#9E9E9E";
const HEADING_FONT = { fontFamily: "'Montserrat', sans-serif" };
const MAX_WIDGETS = 150;

let row_sequence = 0;
const empty_row = () => {
  row_sequence += 1;
  return { key: `kpi_row_${row_sequence}`, field_id: "", formula_id: "", title: "", title_touched: false, description: "" };
};

/**
 * Adding KPI cards by hand - several at once from ONE dialog. Every KPI is
 * one row: a field SELECT and a formula SELECT side by side (file, date and
 * location fields are never offered, and nested cascading levels only ever
 * appear as the automatic breakdowns), plus its title and optional
 * description. "Add another KPI" appends more rows; one save appends every
 * KPI card WITH its automatic breakdowns by every choice field, and the
 * caller opens them all in the review list before anything loads data.
 */
export default function AddKpiDialog({ form, widgets, onAdded, onCancel }) {
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();

  const [rows, setRows] = useState(() => [empty_row()]);
  const [saving, setSaving] = useState(false);

  const fields = useMemo(() => eligible_kpi_fields(form.schema), [form.schema]);
  const field_of = (row) => fields.find((entry) => entry.id === row.field_id) || null;

  const default_title = (field, formula) =>
    field && formula
      ? translate("DCS_DB_KPI_DEFAULT_TITLE", { formula: translate(formula.labelKey), field: field_label_text(field) })
      : "";

  const update_row = (key, patch) => setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const pick_field = (row, field_id) => {
    const field = fields.find((entry) => entry.id === field_id) || null;
    // A formula the new field's type does not allow is dropped.
    const allowed = field ? formulas_for_field(field).some((entry) => entry.id === row.formula_id) : false;
    const formula_id = allowed ? row.formula_id : "";
    const patch = { field_id, formula_id };
    if (!row.title_touched) patch.title = default_title(field, formula_definition(formula_id));
    update_row(row.key, patch);
  };

  const pick_formula = (row, formula_id) => {
    const patch = { formula_id };
    if (!row.title_touched) patch.title = default_title(field_of(row), formula_definition(formula_id));
    update_row(row.key, patch);
  };

  const row_complete = (row) => field_of(row) && formula_definition(row.formula_id) && row.title.trim().length > 0;
  const all_complete = rows.length > 0 && rows.every(row_complete);

  const handle_add = async () => {
    if (!all_complete) return;
    setSaving(true);
    try {
      let generated = [];
      rows.forEach((row) => {
        generated = generated.concat(
          build_kpi_widgets(form, field_of(row), row.formula_id, row.title.trim(), row.description.trim(), translate),
        );
      });
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

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={saving ? undefined : onCancel} />
      <div className="relative bg-white border-2 w-full p-5 sm:p-6 flex flex-col" style={{ maxWidth: 640, maxHeight: "88vh", borderColor: PRIMARY }}>
        <p className="text-base font-semibold mb-1" style={{ color: TEXT_DARK, ...HEADING_FONT }}>
          {translate("DCS_DB_ADD_KPI_TITLE")}
        </p>
        <p className="text-xs mb-4" style={{ color: TEXT_MUTED }}>
          {translate("DCS_DB_ADD_KPI_HINT")}
        </p>

        <div className="overflow-y-auto pr-1 flex-1 flex flex-col gap-3">
          {fields.length === 0 && (
            <p className="text-xs py-1" style={{ color: TEXT_MUTED }}>
              {translate("DCS_DB_KPI_NO_FIELDS")}
            </p>
          )}
          {fields.length > 0 &&
            rows.map((row) => {
              const field = field_of(row);
              const formulas = field ? formulas_for_field(field) : [];
              const formula = formula_definition(row.formula_id);
              return (
                <div key={row.key} className="border p-3" style={{ borderColor: "#E0E0E0" }}>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      className="cok-auth-input flex-1 py-2"
                      value={row.field_id}
                      disabled={saving}
                      onChange={(event) => pick_field(row, event.target.value)}
                    >
                      <option value="">{translate("DCS_DB_KPI_PICK_FIELD")}</option>
                      {fields.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {field_label_text(entry)} ({translate(kpi_field_type_key(entry))})
                        </option>
                      ))}
                    </select>
                    <select
                      className="cok-auth-input flex-1 py-2"
                      value={row.formula_id}
                      disabled={saving || !field}
                      onChange={(event) => pick_formula(row, event.target.value)}
                    >
                      <option value="">{translate("DCS_DB_KPI_PICK_FORMULA")}</option>
                      {formulas.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {translate(entry.labelKey)}
                        </option>
                      ))}
                    </select>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        className="text-xs font-semibold self-start sm:self-center"
                        style={{ color: DANGER, ...HEADING_FONT, background: "none", border: "none", padding: "0.25rem 0", cursor: "pointer" }}
                        disabled={saving}
                        onClick={() => setRows((current) => current.filter((entry) => entry.key !== row.key))}
                      >
                        {translate("DCS_DB_KPI_REMOVE_ROW")}
                      </button>
                    )}
                  </div>

                  {formula && (
                    <p className="text-xs mt-1" style={{ color: TEXT_MUTED }}>
                      {translate(formula.hintKey)}
                    </p>
                  )}

                  {field && formula && (
                    <>
                      <input
                        className="cok-auth-input w-full py-2 mt-2"
                        placeholder={translate("DCS_DB_WIDGET_TITLE")}
                        value={row.title}
                        maxLength={120}
                        disabled={saving}
                        onChange={(event) => update_row(row.key, { title: event.target.value, title_touched: true })}
                      />
                      <textarea
                        className="cok-auth-input w-full py-2 mt-2"
                        rows={2}
                        maxLength={300}
                        placeholder={translate("DCS_DB_REVIEW_DESC_PLACEHOLDER")}
                        value={row.description}
                        disabled={saving}
                        onChange={(event) => update_row(row.key, { description: event.target.value })}
                      />
                    </>
                  )}
                </div>
              );
            })}

          {fields.length > 0 && (
            <button
              type="button"
              className="text-xs font-semibold self-start"
              style={{ color: PRIMARY, ...HEADING_FONT, background: "none", border: `1px solid ${PRIMARY}`, padding: "0.4rem 0.75rem", cursor: "pointer" }}
              disabled={saving}
              onClick={() => setRows((current) => current.concat([empty_row()]))}
            >
              {translate("DCS_DB_KPI_ADD_ROW")}
            </button>
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
              <DcsButtonPrimary className="flex-1" disabled={!all_complete} onClick={handle_add}>
                {translate("DCS_DB_KPI_ADD_COUNT", { count: rows.length })}
              </DcsButtonPrimary>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
