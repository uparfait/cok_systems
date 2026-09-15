import React, { useEffect, useMemo, useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { useToast } from "../../../../core/contexts/ToastContext.tsx";
import DcsButtonPrimary from "../../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../../components/DcsButtonOutline.jsx";
import { SUBMITTED_AT_FIELD } from "../chartCatalog.js";
import { Step, ChipGrid, Problem, Preview, FieldSelect, TitleFields, TEXT_MUTED } from "./builderUi.jsx";
import InEachValues from "./InEachValues.jsx";
import ColorSettingsButton from "./ColorSettingsButton.jsx";
import {
  CHART_FORMULAS,
  CHART_TAB_TYPES,
  DIAGRAM_TAB_TYPES,
  field_options,
  type_rules,
  type_label,
  type_hint_key,
  chart_spec_problems,
  default_chart_title,
  build_chart_drafts,
} from "./composeWidgets.js";
import { useFanOutValues } from "./useFanOutValues.js";

export const EMPTY_CHART_SPEC = {
  chart_type: "",
  aggregation: "count",
  field_id: "",
  group_id: "",
  split_id: "",
  time_source: SUBMITTED_AT_FIELD,
  granularity: "auto",
  x_id: "",
  y_id: "",
  size_id: "",
  in_each_id: "",
  title: "",
  title_touched: false,
  description: "",
  size: "medium",
  appearance: null,
};
const GRANULARITIES = ["auto", "hour", "day", "week", "month", "year"];
const SIZES = ["small", "medium", "large"];

/**
 * The Charts and Diagrams tabs share this composer: pick a type, a measure
 * (formula plus the field it reads), the data the type needs - choice fields
 * to group and split by, a date source and granularity for time charts,
 * number fields for the axes of point charts - an optional "in each" field
 * (one chart per value), and the words. With initialSpec it reopens an
 * existing draft for editing.
 */
export default function ChartComposer({ form, fields, kind, onAdd, disabled, initialSpec, editing, onCancelEdit }) {
  const { translate } = useDcsLanguage();
  const { showSuccess } = useToast();
  const [spec, setSpec] = useState(initialSpec || EMPTY_CHART_SPEC);

  const types = kind === "diagrams" ? DIAGRAM_TAB_TYPES : CHART_TAB_TYPES;
  const rules = type_rules(spec.chart_type);
  const type_chips = useMemo(() => types.map((chart_type) => ({ id: chart_type, label: type_label(chart_type, translate), hintKey: type_hint_key(chart_type) })), [types, translate]);
  const formula_chips = useMemo(() => CHART_FORMULAS.map((formula) => ({ id: formula.id, label: translate(formula.labelKey), hintKey: formula.hintKey })), [translate]);
  const all_options = useMemo(() => field_options(fields, translate), [fields, translate]);
  const choice_options = useMemo(() => field_options(fields.filter((field) => field.is_choice), translate), [fields, translate]);
  const numeric_options = useMemo(() => field_options(fields.filter((field) => field.is_numeric), translate), [fields, translate]);
  const time_options = useMemo(
    () => [{ id: SUBMITTED_AT_FIELD, name: translate("DCS_DB_SUBMITTED_AT") }].concat(field_options(fields.filter((field) => field.is_date), translate)),
    [fields, translate],
  );
  const taken = [spec.group_id, spec.split_id, spec.x_id, spec.y_id, spec.size_id];
  const in_each_options = useMemo(() => all_options.filter((option) => !taken.includes(option.id)), [all_options, taken.join("|")]);
  const in_each = fields.find((field) => field.id === spec.in_each_id && !taken.includes(field.id)) || null;
  const values = useFanOutValues(form, in_each);

  const patch = (changes) => setSpec((current) => ({ ...current, ...changes }));

  useEffect(() => {
    if (spec.title_touched) return;
    const next = default_chart_title(spec, fields, translate);
    if (next !== spec.title) patch({ title: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.chart_type, spec.aggregation, spec.field_id, spec.group_id, spec.split_id, spec.x_id, spec.y_id, translate]);

  const problems = spec.chart_type ? chart_spec_problems(spec, fields, translate) : [translate("DCS_DB_NEED_TYPE")];
  if (in_each && !values.loading && values.list.length === 0) problems.push(translate("DCS_DB_IN_EACH_NONE"));
  const ready = problems.length === 0 && !values.loading;
  const count = in_each ? values.list.length : 1;
  const is_diagram = kind === "diagrams";

  const handle_add = () => {
    if (!ready) return;
    const widgets = build_chart_drafts(form, spec, values.list);
    const name = (id) => (fields.find((field) => field.id === id) || {}).label || "";
    const detail =
      rules.kind === "point"
        ? `${name(spec.y_id)} / ${name(spec.x_id)}`
        : rules.kind === "time"
          ? name(spec.time_source) || translate("DCS_DB_SUBMITTED_AT")
          : [name(spec.group_id), name(spec.split_id)].filter(Boolean).join(" / ");
    onAdd({
      tab: kind,
      summary: spec.title.trim(),
      detail: `${type_label(spec.chart_type, translate)} - ${detail}${in_each ? ` - ${translate("DCS_DB_DRAFT_IN_EACH", { field: in_each.label })}` : ""}`,
      with_chart: "",
      widgets,
      spec,
    });
    showSuccess(editing ? translate("DCS_DB_DRAFT_UPDATED") : translate(is_diagram ? "DCS_DB_DIAGRAM_ADDED" : "DCS_DB_CHART_ADDED", { count }));
    setSpec(EMPTY_CHART_SPEC);
  };

  const add_label = editing
    ? translate("DCS_DB_DRAFT_UPDATE")
    : count > 1
      ? translate(is_diagram ? "DCS_DB_ADD_DIAGRAMS" : "DCS_DB_ADD_CHARTS", { count })
      : translate(is_diagram ? "DCS_DB_ADD_DIAGRAM" : "DCS_DB_ADD_CHART");
  const preview = !ready
    ? ""
    : in_each
      ? translate("DCS_DB_CHART_PREVIEW_MANY", { count, type: type_label(spec.chart_type, translate), field: in_each.label })
      : translate("DCS_DB_CHART_PREVIEW", { type: type_label(spec.chart_type, translate) });
  const data_step = rules.kind === "point" ? 2 : 3;

  return (
    <div className="dcs-view-swap flex flex-col gap-5">
      {editing && <Preview>{translate("DCS_DB_DRAFT_EDITING")}</Preview>}
      <Step number={1} titleKey="DCS_DB_STEP_TYPE" hintKey={is_diagram ? "DCS_DB_STEP_TYPE_DIAGRAM_HINT" : "DCS_DB_STEP_TYPE_CHART_HINT"}>
        <ChipGrid options={type_chips} value={spec.chart_type} onChange={(chart_type) => patch({ chart_type })} disabled={disabled} columns="grid-cols-2 sm:grid-cols-4" />
      </Step>

      {spec.chart_type && rules.kind !== "point" && (
        <Step number={2} titleKey="DCS_DB_STEP_MEASURE" hintKey="DCS_DB_STEP_MEASURE_HINT">
          <ChipGrid options={formula_chips} value={spec.aggregation} onChange={(aggregation) => patch({ aggregation })} disabled={disabled} columns="grid-cols-2 sm:grid-cols-4" />
          {spec.aggregation !== "count" && (
            <div className="dcs-view-swap mt-3">
              <FieldSelect options={all_options} value={spec.field_id} onChange={(field_id) => patch({ field_id })} placeholder={translate("DCS_DB_NEED_MEASURE_FIELD")} disabled={disabled} />
            </div>
          )}
        </Step>
      )}

      {spec.chart_type && (
        <Step number={data_step} titleKey="DCS_DB_STEP_DATA" hintKey={rules.kind === "point" ? "DCS_DB_STEP_DATA_POINT_HINT" : rules.kind === "time" ? "DCS_DB_STEP_DATA_TIME_HINT" : "DCS_DB_GROUP_HINT"}>
          {(rules.kind === "category" || rules.kind === "tree") && (
            <>
              {choice_options.length === 0 && <Problem>{translate("DCS_DB_NO_CHOICE_FIELDS_HINT")}</Problem>}
              <FieldSelect label={translate("DCS_DB_FIELD_GROUP")} options={choice_options} value={spec.group_id} onChange={(group_id) => patch({ group_id, split_id: spec.split_id === group_id ? "" : spec.split_id })} placeholder={translate("DCS_DB_FIELD_GROUP_PLACEHOLDER")} disabled={disabled} />
              {rules.split !== "none" && (
                <FieldSelect
                  label={translate(rules.split === "required" ? "DCS_DB_FIELD_SPLIT" : "DCS_DB_SPLIT_OPTIONAL")}
                  options={choice_options.filter((option) => option.id !== spec.group_id)}
                  value={spec.split_id}
                  onChange={(split_id) => patch({ split_id })}
                  placeholder={translate("DCS_DB_FIELD_SPLIT_PLACEHOLDER")}
                  disabled={disabled}
                  allowClear={rules.split === "optional"}
                />
              )}
            </>
          )}
          {rules.kind === "time" && (
            <>
              <FieldSelect label={translate("DCS_DB_FIELD_TIME_SOURCE")} options={time_options} value={spec.time_source} onChange={(time_source) => patch({ time_source })} placeholder={translate("DCS_DB_FIELD_TIME_SOURCE")} disabled={disabled} />
              <p className="text-xs mb-1" style={{ color: TEXT_MUTED }}>{translate("DCS_DB_FIELD_GRANULARITY")}</p>
              <ChipGrid
                options={GRANULARITIES.map((granularity) => ({ id: granularity, label: translate(`DCS_DB_GRAN_${granularity.toUpperCase()}`) }))}
                value={spec.granularity}
                onChange={(granularity) => patch({ granularity })}
                disabled={disabled}
                columns="grid-cols-3 sm:grid-cols-6"
              />
              {rules.split === "optional" && (
                <div className="mt-2">
                  <FieldSelect label={translate("DCS_DB_SPLIT_OPTIONAL")} options={choice_options} value={spec.split_id} onChange={(split_id) => patch({ split_id })} placeholder={translate("DCS_DB_FIELD_SPLIT_PLACEHOLDER")} disabled={disabled} allowClear />
                </div>
              )}
            </>
          )}
          {rules.kind === "point" && (
            <>
              {numeric_options.length < 2 && <Problem>{translate("DCS_DB_NO_NUMERIC_FIELDS")}</Problem>}
              <FieldSelect label={translate("DCS_DB_FIELD_X")} options={numeric_options} value={spec.x_id} onChange={(x_id) => patch({ x_id })} placeholder={translate("DCS_DB_FIELD_X")} disabled={disabled} />
              <FieldSelect label={translate("DCS_DB_FIELD_Y")} options={numeric_options} value={spec.y_id} onChange={(y_id) => patch({ y_id })} placeholder={translate("DCS_DB_FIELD_Y")} disabled={disabled} />
              {spec.chart_type === "bubble" && (
                <FieldSelect label={translate("DCS_DB_FIELD_SIZE")} options={numeric_options} value={spec.size_id} onChange={(size_id) => patch({ size_id })} placeholder={translate("DCS_DB_FIELD_SIZE")} disabled={disabled} />
              )}
            </>
          )}
        </Step>
      )}

      {spec.chart_type && (
        <Step number={data_step + 1} titleKey="DCS_DB_STEP_IN_EACH_CHART" hintKey="DCS_DB_IN_EACH_CHART_HINT">
          <FieldSelect options={in_each_options} value={in_each ? in_each.id : ""} onChange={(in_each_id) => patch({ in_each_id })} placeholder={translate("DCS_DB_IN_EACH_CHART_PLACEHOLDER")} disabled={disabled} allowClear />
          <InEachValues field={in_each} values={values} />
        </Step>
      )}

      {spec.chart_type && (
        <Step number={data_step + 2} titleKey="DCS_DB_STEP_DETAILS">
          <TitleFields title={spec.title} description={spec.description} onTitle={(title) => patch({ title, title_touched: true })} onDescription={(description) => patch({ description })} disabled={disabled} />
          {rules.kind !== "time" && (
            <div className="mt-2">
              <p className="text-xs mb-1" style={{ color: TEXT_MUTED }}>{translate("DCS_DB_SIZE")}</p>
              <ChipGrid options={SIZES.map((size) => ({ id: size, label: translate(`DCS_DB_SIZE_${size.toUpperCase()}`) }))} value={spec.size} onChange={(size) => patch({ size })} disabled={disabled} columns="grid-cols-3" />
            </div>
          )}
        </Step>
      )}

      {spec.chart_type && (
        <Step number={data_step + 3} titleKey="DCS_DB_STEP_COLORS" hintKey="DCS_DB_STEP_COLORS_HINT">
          <ColorSettingsButton
            form={form}
            title={spec.title}
            valuesField={fields.find((field) => field.id === (rules.split !== "none" && spec.split_id ? spec.split_id : rules.kind === "category" || rules.kind === "tree" ? spec.group_id : "")) || null}
            appearance={spec.appearance}
            onChange={(appearance) => patch({ appearance })}
            disabled={disabled}
          />
        </Step>
      )}

      <div>
        <Preview>{preview}</Preview>
        <Problem>{spec.chart_type && !ready && !values.loading ? problems[0] : ""}</Problem>
        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          <DcsButtonPrimary className="sm:w-56" disabled={disabled || !ready} onClick={handle_add}>
            {add_label}
          </DcsButtonPrimary>
          {editing ? (
            <DcsButtonOutline className="sm:w-36" disabled={disabled} onClick={onCancelEdit}>
              {translate("DCS_DB_DRAFT_CANCEL_EDIT")}
            </DcsButtonOutline>
          ) : (
            <DcsButtonOutline className="sm:w-32" disabled={disabled} onClick={() => setSpec(EMPTY_CHART_SPEC)}>
              {translate("DCS_DB_RESET")}
            </DcsButtonOutline>
          )}
        </div>
      </div>
    </div>
  );
}
