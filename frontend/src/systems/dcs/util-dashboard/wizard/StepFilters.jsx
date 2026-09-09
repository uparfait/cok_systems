import React from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import DcsSearchableSelect from "../../components/DcsSearchableSelect.jsx";
import DcsButtonOutline from "../../components/DcsButtonOutline.jsx";
import {
  chart_definition,
  classify_fields,
  field_label_text,
  FILTER_OPERATOR_OPTIONS,
  SORT_OPTIONS_LIST,
  PERIOD_PRESET_OPTIONS,
} from "../chartCatalog.js";

const DANGER = "#E74C3C";

/**
 * Step three of the wizard: narrow the records (field filters), pick the
 * widget's own time window, and - for category charts - how the slices are
 * sorted and how many to keep before the tail folds into "Other".
 */
export default function StepFilters({ widget, forms, onChange }) {
  const { translate } = useDcsLanguage();
  const definition = chart_definition(widget.chart_type);
  const form = forms.find((entry) => entry.form_group_id === widget.form_group_id) || null;
  const fields = form ? classify_fields(form.schema) : { all: [] };
  const filterable = fields.all
    ? fields.all.filter((field) => !["paragraph", "header", "file", "image_block", "horizontal_line", "section", "group"].includes(field.type))
    : [];
  const field_options = filterable.map((field) => ({ id: field.id, name: field_label_text(field) }));
  const operator_options = FILTER_OPERATOR_OPTIONS.map((option) => ({ id: option.id, name: translate(option.labelKey) }));
  const sort_options = SORT_OPTIONS_LIST.map((option) => ({ id: option.id, name: translate(option.labelKey) }));
  const period_options = PERIOD_PRESET_OPTIONS.map((option) => ({ id: option.id, name: translate(option.labelKey) }));

  const update_filter = (index, changes) => {
    const filters = widget.filters.map((filter, position) => (position === index ? { ...filter, ...changes } : filter));
    onChange({ filters });
  };

  const period = widget.period || { preset: "all", from: null, to: null };
  const is_category = definition && (definition.kind === "category" || definition.kind === "tree");

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase mb-2" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.5px" }}>
          {translate("DCS_DB_FILTERS_TITLE")}
        </p>
        {widget.filters.length === 0 && (
          <p className="text-xs mb-2" style={{ color: "#9E9E9E" }}>{translate("DCS_DB_FILTERS_HINT")}</p>
        )}
        <div className="space-y-2">
          {widget.filters.map((filter, index) => (
            <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center border-2 p-2" style={{ borderColor: "#E0E0E0" }}>
              <DcsSearchableSelect options={field_options} value={filter.field_id} onChange={(field_id) => update_filter(index, { field_id })} placeholder={translate("DCS_DB_FILTER_FIELD")} />
              <DcsSearchableSelect options={operator_options} value={filter.operator} onChange={(operator) => update_filter(index, { operator })} placeholder={translate("DCS_DB_FILTER_OPERATOR")} />
              <input
                className="cok-auth-input w-full py-2"
                placeholder={translate("DCS_DB_FILTER_VALUE")}
                value={filter.value}
                onChange={(event) => update_filter(index, { value: event.target.value })}
              />
              <button
                type="button"
                onClick={() => onChange({ filters: widget.filters.filter((entry, position) => position !== index) })}
                className="text-xs font-semibold uppercase justify-self-start sm:justify-self-auto"
                style={{ color: DANGER, fontFamily: "'Montserrat', sans-serif", cursor: "pointer", background: "none", border: "none" }}
              >
                {translate("DCS_SETTINGS_REMOVE")}
              </button>
            </div>
          ))}
        </div>
        <div className="w-full sm:w-44 mt-2">
          <DcsButtonOutline
            type="button"
            disabled={widget.filters.length >= 10 || field_options.length === 0}
            onClick={() => onChange({ filters: widget.filters.concat([{ field_id: "", operator: "eq", value: "" }]) })}
          >
            {translate("DCS_DB_ADD_FILTER")}
          </DcsButtonOutline>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase mb-2" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.5px" }}>
          {translate("DCS_DB_PERIOD_TITLE")}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <DcsSearchableSelect
            options={period_options}
            value={period.preset}
            onChange={(preset) => onChange({ period: { preset, from: null, to: null } })}
            placeholder={translate("DCS_DB_PERIOD_TITLE")}
          />
          {period.preset === "custom" && (
            <>
              <input
                type="date"
                className="cok-auth-input w-full py-2"
                value={period.from || ""}
                onChange={(event) => onChange({ period: { ...period, from: event.target.value } })}
              />
              <input
                type="date"
                className="cok-auth-input w-full py-2"
                value={period.to || ""}
                onChange={(event) => onChange({ period: { ...period, to: event.target.value } })}
              />
            </>
          )}
        </div>
      </div>

      {is_category && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="cok-auth-label">{translate("DCS_DB_SORT")}</label>
            <DcsSearchableSelect options={sort_options} value={widget.sort || "value_desc"} onChange={(sort) => onChange({ sort })} placeholder={translate("DCS_DB_SORT")} />
          </div>
          <div>
            <label className="cok-auth-label">{translate("DCS_DB_LIMIT")}</label>
            <input
              type="number"
              min={1}
              max={definition.max_slices || 50}
              className="cok-auth-input w-full py-2"
              value={widget.limit}
              onChange={(event) => {
                const parsed = parseInt(event.target.value, 10);
                const cap = definition.max_slices || 50;
                onChange({ limit: Number.isFinite(parsed) ? Math.min(Math.max(1, parsed), cap) : 1 });
              }}
            />
            {definition.max_slices && (
              <p className="text-xs mt-1" style={{ color: "#9E9E9E" }}>
                {translate("DCS_DB_SLICE_CAP_HINT", { count: definition.max_slices })}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
