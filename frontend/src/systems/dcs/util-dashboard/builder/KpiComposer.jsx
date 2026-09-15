import React, { useEffect, useMemo, useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { useToast } from "../../../../core/contexts/ToastContext.tsx";
import DcsButtonPrimary from "../../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../../components/DcsButtonOutline.jsx";
import { Step, ChipGrid, Switch, Problem, Preview, FieldSelect, TitleFields, TEXT_MUTED } from "./builderUi.jsx";
import InEachValues from "./InEachValues.jsx";
import ColorSettingsButton from "./ColorSettingsButton.jsx";
import OccurrenceOptions from "./OccurrenceOptions.jsx";
import {
  BUILDER_FORMULAS,
  ALL_SUBMISSIONS_ID,
  all_submissions_field,
  field_options,
  kpi_shape,
  measure_label,
  build_kpi_drafts,
  type_label,
  type_hint_key,
  is_occurrences,
  occurrence_problem,
} from "./composeWidgets.js";
import { useFanOutValues } from "./useFanOutValues.js";

export const EMPTY_KPI_SPEC = {
  formula_id: "",
  field_id: "",
  in_each_id: "",
  in_each_mode: "combined",
  // "Count occurrences" only: how each counted value is named, and the
  // threshold its count is held to.
  display_ids: [],
  display_separator: " - ",
  same_rules: [],
  rule_operator: "",
  rule_value: "",
  rule_scope: "matching",
  title: "",
  title_touched: false,
  description: "",
  chart_enabled: false,
  chart_type: "",
  appearance: null,
};

/**
 * The KPI tab: formula, field, an optional "in each" field, then the card's
 * words and an optional chart.
 *
 * An "in each" field can go two ways, and the composer says which before
 * anything is added: ONE card (the default) listing every value as its
 * legend under the total, or one card per value, each filtered to its own.
 * A choice measure adds a legend of its own values instead when the card
 * is not already carrying the "in each" ones. The chart spreads the same
 * measure across the "in each" field (split by the choice measure when
 * there is one). With initialSpec it reopens an existing draft for editing.
 */
export default function KpiComposer({ form, fields, onAdd, disabled, initialSpec, editing, onCancelEdit }) {
  const { translate } = useDcsLanguage();
  const { showSuccess } = useToast();
  const [spec, setSpec] = useState(initialSpec || EMPTY_KPI_SPEC);

  const options = useMemo(() => field_options(fields, translate), [fields, translate]);
  // Count may read "All submissions" - every record in the selected time -
  // offered first; the real fields follow.
  const is_count = spec.formula_id === "count";
  const counting_occurrences = is_occurrences(spec.formula_id);
  const field_choices = useMemo(
    () => (is_count ? [{ id: ALL_SUBMISSIONS_ID, name: translate("DCS_DB_GEN_TOTAL"), badge: translate("DCS_DB_FT_TOTAL") }].concat(options) : options),
    [is_count, options, translate],
  );
  const shape_fields = useMemo(() => (is_count ? [all_submissions_field(translate)].concat(fields) : fields), [is_count, fields, translate]);
  const in_each_options = useMemo(() => options.filter((option) => option.id !== spec.field_id), [options, spec.field_id]);
  const shape = useMemo(() => kpi_shape(spec, shape_fields), [spec, shape_fields]);
  const formula_chips = useMemo(() => BUILDER_FORMULAS.map((formula) => ({ id: formula.id, label: translate(formula.labelKey), hintKey: formula.hintKey })), [translate]);
  const chart_chips = useMemo(
    () => shape.chart_types.map((chart_type) => ({ id: chart_type, label: type_label(chart_type, translate), hintKey: type_hint_key(chart_type) })),
    [shape.chart_types, translate],
  );
  // Only a fanned-out choice needs its values listed; a combined card asks
  // the server for them at view time, as its legend.
  const values = useFanOutValues(form, shape.combined ? null : shape.in_each);
  const mode_chips = useMemo(
    () => [
      { id: "combined", label: translate("DCS_DB_KPI_ONE_CARD"), hintKey: "DCS_DB_KPI_ONE_CARD_HINT" },
      { id: "separate", label: translate("DCS_DB_KPI_MANY_CARDS"), hintKey: "DCS_DB_KPI_MANY_CARDS_HINT" },
    ],
    [translate],
  );

  const patch = (changes) => setSpec((current) => ({ ...current, ...changes }));

  useEffect(() => {
    if (spec.title_touched) return;
    const next = measure_label(spec.formula_id, shape.measure, translate);
    if (next !== spec.title) patch({ title: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.formula_id, spec.field_id, translate]);

  useEffect(() => {
    if (shape.chart_types.length > 0 && !shape.chart_types.includes(spec.chart_type)) patch({ chart_type: shape.chart_types[0] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape.chart_types.join("|")]);

  // "All submissions" only makes sense for Count - another formula drops it.
  useEffect(() => {
    if (!is_count && spec.field_id === ALL_SUBMISSIONS_ID) patch({ field_id: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is_count]);

  const ready = !!(shape.measure && spec.formula_id && spec.title.trim());
  const card_count = shape.in_each && !shape.combined ? values.list.length : 1;
  const busy = disabled || (!shape.combined && values.loading);

  const problem = !spec.formula_id
    ? translate("DCS_DB_KPI_PICK_FORMULA")
    : !shape.measure
      ? translate("DCS_DB_KPI_PICK_FIELD")
      : occurrence_problem(spec, translate)
        ? occurrence_problem(spec, translate)
        : shape.in_each && !shape.combined && !values.loading && values.list.length === 0
          ? translate("DCS_DB_IN_EACH_NONE")
          : !spec.title.trim()
            ? translate("DCS_DB_NEED_TITLE")
            : "";

  const preview = !ready
    ? ""
    : shape.combined
      ? translate("DCS_DB_KPI_PREVIEW_COMBINED", { field: shape.in_each.label })
      : shape.in_each
        ? values.loading
          ? translate("DCS_DB_IN_EACH_LOADING")
          : translate("DCS_DB_KPI_PREVIEW_MANY", { count: values.list.length, field: shape.in_each.label })
        : translate("DCS_DB_KPI_PREVIEW_SINGLE");

  const handle_add = () => {
    if (!ready || problem) return;
    const drafts = build_kpi_drafts(form, { ...spec, fields: shape_fields }, values.list, translate);
    const cards = drafts.filter((widget) => widget.chart_type === "kpi").length;
    onAdd({
      tab: "kpi",
      summary: spec.title.trim(),
      detail: shape.in_each ? translate(shape.combined ? "DCS_DB_DRAFT_COMBINED" : "DCS_DB_DRAFT_IN_EACH", { field: shape.in_each.label }) : measure_label(spec.formula_id, shape.measure, translate),
      with_chart: spec.chart_enabled && shape.chart_field ? type_label(spec.chart_type, translate) : "",
      widgets: drafts,
      spec,
    });
    showSuccess(editing ? translate("DCS_DB_DRAFT_UPDATED") : translate("DCS_DB_KPI_ADDED", { count: cards }));
    setSpec(EMPTY_KPI_SPEC);
  };

  const add_label = editing
    ? translate("DCS_DB_DRAFT_UPDATE")
    : card_count > 1
      ? translate("DCS_DB_KPI_ADD_CARDS", { count: card_count })
      : translate("DCS_DB_KPI_ADD_CARD");

  return (
    <div className="dcs-view-swap flex flex-col gap-5">
      {editing && <Preview>{translate("DCS_DB_DRAFT_EDITING")}</Preview>}
      <Step number={1} titleKey="DCS_DB_STEP_FORMULA" hintKey="DCS_DB_STEP_FORMULA_HINT">
        <ChipGrid options={formula_chips} value={spec.formula_id} onChange={(formula_id) => patch({ formula_id })} disabled={disabled} />
      </Step>

      <Step number={2} titleKey="DCS_DB_STEP_FIELD" hintKey="DCS_DB_STEP_FIELD_HINT">
        <FieldSelect options={field_choices} value={spec.field_id} onChange={(field_id) => patch({ field_id, in_each_id: spec.in_each_id === field_id ? "" : spec.in_each_id })} placeholder={translate("DCS_DB_KPI_PICK_FIELD")} disabled={disabled} />
        {shape.legend && <Preview>{translate("DCS_DB_LEGEND_HINT", { field: shape.legend.label })}</Preview>}
        {shape.measure && shape.measure.is_total && <Preview>{translate("DCS_DB_ALL_SUBMISSIONS_HINT")}</Preview>}
        {counting_occurrences && shape.measure && <OccurrenceOptions fields={fields} keyId={shape.measure.id} spec={spec} onPatch={patch} disabled={disabled} />}
      </Step>

      <Step number={3} titleKey="DCS_DB_STEP_IN_EACH" hintKey="DCS_DB_IN_EACH_HINT">
        <FieldSelect options={in_each_options} value={spec.in_each_id} onChange={(in_each_id) => patch({ in_each_id })} placeholder={translate("DCS_DB_IN_EACH_PLACEHOLDER")} disabled={disabled || !shape.measure} allowClear />
        {shape.in_each && shape.can_combine && (
          <div className="dcs-view-swap mt-3">
            <p className="text-xs mb-1" style={{ color: TEXT_MUTED }}>
              {translate("DCS_DB_KPI_IN_EACH_MODE")}
            </p>
            <ChipGrid options={mode_chips} value={shape.combined ? "combined" : "separate"} onChange={(in_each_mode) => patch({ in_each_mode })} disabled={disabled} columns="grid-cols-1 sm:grid-cols-2" />
          </div>
        )}
        {shape.in_each && !shape.can_combine && (
          <Preview>{translate("DCS_DB_KPI_CANNOT_COMBINE")}</Preview>
        )}
        {!shape.combined && <InEachValues field={shape.in_each} values={values} />}
      </Step>

      <Step number={4} titleKey="DCS_DB_STEP_DETAILS">
        <TitleFields
          title={spec.title}
          description={spec.description}
          onTitle={(title) => patch({ title, title_touched: true })}
          onDescription={(description) => patch({ description })}
          disabled={disabled}
        />
      </Step>

      <Step number={5} titleKey="DCS_DB_STEP_CHART" hintKey="DCS_DB_STEP_CHART_HINT">
        {shape.chart_field ? (
          <>
            <Switch checked={spec.chart_enabled} onChange={(chart_enabled) => patch({ chart_enabled })} label={translate("DCS_DB_KPI_CHART_TOGGLE")} disabled={disabled} />
            {spec.chart_enabled && (
              <div className="dcs-view-swap mt-3">
                <p className="text-xs mb-2" style={{ color: TEXT_MUTED }}>
                  {translate("DCS_DB_KPI_CHART_HINT", { measure: measure_label(spec.formula_id, shape.measure, translate), field: shape.chart_field.label })}
                </p>
                <ChipGrid options={chart_chips} value={spec.chart_type} onChange={(chart_type) => patch({ chart_type })} disabled={disabled} columns="grid-cols-2 sm:grid-cols-4" />
              </div>
            )}
          </>
        ) : (
          <p className="text-xs" style={{ color: TEXT_MUTED }}>
            {translate("DCS_DB_KPI_CHART_UNAVAILABLE")}
          </p>
        )}
      </Step>

      <Step number={6} titleKey="DCS_DB_STEP_COLORS" hintKey="DCS_DB_STEP_COLORS_HINT">
        <ColorSettingsButton
          form={form}
          title={spec.title}
          valuesField={shape.legend || shape.chart_field}
          appearance={spec.appearance}
          onChange={(appearance) => patch({ appearance })}
          disabled={disabled}
        />
      </Step>

      <div>
        <Preview>{preview}</Preview>
        <Problem>{spec.formula_id || spec.field_id ? problem : ""}</Problem>
        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          <DcsButtonPrimary className="sm:w-56" disabled={busy || !ready || !!problem} onClick={handle_add}>
            {add_label}
          </DcsButtonPrimary>
          {editing ? (
            <DcsButtonOutline className="sm:w-36" disabled={disabled} onClick={onCancelEdit}>
              {translate("DCS_DB_DRAFT_CANCEL_EDIT")}
            </DcsButtonOutline>
          ) : (
            <DcsButtonOutline className="sm:w-32" disabled={disabled} onClick={() => setSpec(EMPTY_KPI_SPEC)}>
              {translate("DCS_DB_RESET")}
            </DcsButtonOutline>
          )}
        </div>
      </div>
    </div>
  );
}
