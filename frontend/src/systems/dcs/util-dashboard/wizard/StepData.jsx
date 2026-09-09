import React from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import DcsSearchableSelect from "../../components/DcsSearchableSelect.jsx";
import {
  chart_definition,
  classify_fields,
  field_label_text,
  AGGREGATION_OPTIONS,
  GRANULARITY_OPTIONS,
  SUBMITTED_AT_FIELD,
} from "../chartCatalog.js";

/**
 * Step two of the wizard: the data behind the chart. Only fields whose type
 * actually fits the picked chart are ever offered - categorical fields for
 * grouping and splitting, numeric fields for measures and scatter axes,
 * date fields (or the submission date) for time series.
 */
export default function StepData({ widget, forms, onChange }) {
  const { translate } = useDcsLanguage();
  const definition = chart_definition(widget.chart_type);
  const form = forms.find((entry) => entry.form_group_id === widget.form_group_id) || null;
  const fields = form ? classify_fields(form.schema) : { categorical: [], numeric: [], dates: [] };

  const to_options = (list) => list.map((field) => ({ id: field.id, name: field_label_text(field) }));
  const categorical_options = to_options(fields.categorical);
  const numeric_options = to_options(fields.numeric);
  const time_options = [{ id: SUBMITTED_AT_FIELD, name: translate("DCS_DB_SUBMITTED_AT") }].concat(to_options(fields.dates));
  const split_options = categorical_options.filter((option) => !widget.group_by || option.id !== widget.group_by.field_id);
  const aggregation_options = AGGREGATION_OPTIONS.map((option) => ({ id: option.id, name: translate(option.labelKey) }));
  const usable_aggregations = numeric_options.length > 0 ? aggregation_options : aggregation_options.slice(0, 1);
  const granularity_options = GRANULARITY_OPTIONS.map((option) => ({ id: option.id, name: translate(option.labelKey) }));

  const set_group = (field_id) => {
    const next = field_id ? { field_id, ...(definition.kind === "time" ? { granularity: (widget.group_by && widget.group_by.granularity) || "auto" } : {}) } : null;
    const changes = { group_by: next };
    if (widget.split_by && next && widget.split_by.field_id === next.field_id) changes.split_by = null;
    onChange(changes);
  };

  if (!definition) return null;

  return (
    <div className="space-y-4">
      {forms.length > 1 && (
        <div>
          <label className="cok-auth-label">{translate("DCS_DB_FIELD_FORM")}</label>
          <DcsSearchableSelect
            options={forms.map((entry) => ({ id: entry.form_group_id, name: entry.form_name }))}
            value={widget.form_group_id}
            onChange={(form_group_id) =>
              onChange({ form_group_id, group_by: null, split_by: null, x_field_id: null, y_field_id: null, size_field_id: null, filters: [], metric: { aggregation: "count", field_id: null } })
            }
            placeholder={translate("DCS_DB_FIELD_FORM_PLACEHOLDER")}
          />
        </div>
      )}

      {form && definition.kind !== "point" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="cok-auth-label">{translate("DCS_DB_FIELD_METRIC")}</label>
            <DcsSearchableSelect
              options={usable_aggregations}
              value={widget.metric.aggregation}
              onChange={(aggregation) => onChange({ metric: { aggregation, field_id: aggregation === "count" ? null : widget.metric.field_id } })}
              placeholder={translate("DCS_DB_FIELD_METRIC")}
            />
          </div>
          {widget.metric.aggregation !== "count" && (
            <div>
              <label className="cok-auth-label">{translate("DCS_DB_FIELD_METRIC_FIELD")}</label>
              <DcsSearchableSelect
                options={numeric_options}
                value={widget.metric.field_id || ""}
                onChange={(field_id) => onChange({ metric: { ...widget.metric, field_id } })}
                placeholder={translate("DCS_DB_FIELD_METRIC_FIELD")}
              />
            </div>
          )}
        </div>
      )}

      {form && (definition.kind === "category" || definition.kind === "tree") && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="cok-auth-label">{translate("DCS_DB_FIELD_GROUP")}</label>
            <DcsSearchableSelect
              options={categorical_options}
              value={(widget.group_by && widget.group_by.field_id) || ""}
              onChange={set_group}
              placeholder={translate("DCS_DB_FIELD_GROUP_PLACEHOLDER")}
            />
          </div>
          {definition.split !== "none" && (
            <div>
              <label className="cok-auth-label">
                {translate("DCS_DB_FIELD_SPLIT")}
                {definition.split === "optional" ? ` (${translate("DCS_FIELD_OPTIONAL")})` : ""}
              </label>
              <DcsSearchableSelect
                options={split_options}
                value={(widget.split_by && widget.split_by.field_id) || ""}
                onChange={(field_id) => onChange({ split_by: field_id ? { field_id } : null })}
                placeholder={translate("DCS_DB_FIELD_SPLIT_PLACEHOLDER")}
                allowClear={definition.split === "optional"}
              />
            </div>
          )}
        </div>
      )}

      {form && definition.kind === "time" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="cok-auth-label">{translate("DCS_DB_FIELD_TIME_SOURCE")}</label>
            <DcsSearchableSelect options={time_options} value={(widget.group_by && widget.group_by.field_id) || ""} onChange={set_group} placeholder={translate("DCS_DB_FIELD_TIME_SOURCE")} />
          </div>
          <div>
            <label className="cok-auth-label">{translate("DCS_DB_FIELD_GRANULARITY")}</label>
            <DcsSearchableSelect
              options={granularity_options}
              value={(widget.group_by && widget.group_by.granularity) || "auto"}
              onChange={(granularity) => onChange({ group_by: { ...(widget.group_by || { field_id: SUBMITTED_AT_FIELD }), granularity } })}
              placeholder={translate("DCS_DB_FIELD_GRANULARITY")}
            />
          </div>
          {definition.split === "optional" && (
            <div>
              <label className="cok-auth-label">
                {translate("DCS_DB_FIELD_SPLIT")} ({translate("DCS_FIELD_OPTIONAL")})
              </label>
              <DcsSearchableSelect
                options={categorical_options}
                value={(widget.split_by && widget.split_by.field_id) || ""}
                onChange={(field_id) => onChange({ split_by: field_id ? { field_id } : null })}
                placeholder={translate("DCS_DB_FIELD_SPLIT_PLACEHOLDER")}
                allowClear
              />
            </div>
          )}
        </div>
      )}

      {form && definition.kind === "point" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="cok-auth-label">{translate("DCS_DB_FIELD_X")}</label>
            <DcsSearchableSelect options={numeric_options} value={widget.x_field_id || ""} onChange={(field_id) => onChange({ x_field_id: field_id })} placeholder={translate("DCS_DB_FIELD_X")} />
          </div>
          <div>
            <label className="cok-auth-label">{translate("DCS_DB_FIELD_Y")}</label>
            <DcsSearchableSelect options={numeric_options} value={widget.y_field_id || ""} onChange={(field_id) => onChange({ y_field_id: field_id })} placeholder={translate("DCS_DB_FIELD_Y")} />
          </div>
          {widget.chart_type === "bubble" && (
            <div>
              <label className="cok-auth-label">{translate("DCS_DB_FIELD_SIZE")}</label>
              <DcsSearchableSelect options={numeric_options} value={widget.size_field_id || ""} onChange={(field_id) => onChange({ size_field_id: field_id })} placeholder={translate("DCS_DB_FIELD_SIZE")} />
            </div>
          )}
        </div>
      )}

      {form && (definition.kind === "category" || definition.kind === "tree") && categorical_options.length === 0 && (
        <p className="text-xs" style={{ color: "#E74C3C" }}>{translate("DCS_DB_NO_CATEGORICAL_FIELDS")}</p>
      )}
      {form && definition.kind === "point" && numeric_options.length < 1 && (
        <p className="text-xs" style={{ color: "#E74C3C" }}>{translate("DCS_DB_NO_NUMERIC_FIELDS")}</p>
      )}
    </div>
  );
}
