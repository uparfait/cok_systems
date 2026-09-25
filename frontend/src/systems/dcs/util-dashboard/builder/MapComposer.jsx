import React, { useEffect, useMemo, useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { useToast } from "../../../../core/contexts/ToastContext.tsx";
import DcsButtonPrimary from "../../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../../components/DcsButtonOutline.jsx";
import LibraryIcon from "../icons/LibraryIcon.jsx";
import IconPickerPanel from "../icons/IconPickerPanel.jsx";
import ColorInput from "./ColorInput.jsx";
import { MARKER_SET } from "../charts/mapMarkers.js";
import { HEAT_LOW, HEAT_HIGH, SPREADS } from "../charts/heatScale.js";
import { Step, ChipGrid, Switch, Problem, Preview, FieldSelect, TitleFields, TEXT_MUTED, PRIMARY, BORDER } from "./builderUi.jsx";
import ColorSettingsButton from "./ColorSettingsButton.jsx";
import WidgetBehaviorStep from "./WidgetBehaviorStep.jsx";
import { with_behavior, period_problem } from "./widgetBehavior.js";
import { CHART_FORMULAS, formula_of, field_options, build_map_draft, ALL_SUBMISSIONS_ID } from "./composeWidgets.js";
import { map_levels_of, geo_fields, number_fields } from "./mapFields.js";

export const EMPTY_MAP_SPEC = {
  kind: "world",
  level: "",
  place_id: "",
  aggregation: "count",
  field_id: "",
  split_id: "",
  marker: MARKER_SET[0],
  show_markers: false,
  show_labels: true,
  point_id: "",
  weight_id: "",
  spread: "balanced",
  show_points: true,
  low_color: HEAT_LOW,
  high_color: HEAT_HIGH,
  title: "",
  title_touched: false,
  description: "",
  size: "large",
  appearance: null,
};

const SIZES = ["small", "medium", "large"];

/**
 * The Map tab. A map is one of two quite different things, and the first
 * step is which:
 *
 * A WORLD map paints administrative boundaries. The level decides which are
 * drawn (districts, sectors, cells, villages) and the form field of that
 * level names them; the formula decides what each place is worth, and an
 * optional choice field splits every place into values the legend names and
 * the markers tell apart.
 *
 * A HEAT map paints the records themselves, each at the position it was
 * collected - so it is only offered when the form captures one, through its
 * map location field. It has no levels, no boundaries and no markers:
 * weight, spread and color are all it needs. Each point weighs one answer,
 * or as much as a number field says (a household size, an amount), and a
 * choice field spreads a layer of heat per value, each in its own color.
 */
export default function MapComposer({ form, fields, filterDefs, onAdd, disabled, initialSpec, editing, onCancelEdit }) {
  const { translate } = useDcsLanguage();
  const { showSuccess } = useToast();
  const [spec, setSpec] = useState(initialSpec || EMPTY_MAP_SPEC);
  // The whole icon library, the way a KPI card picks its icon.
  const [picking_icon, setPickingIcon] = useState(false);
  const patch = (changes) => setSpec((current) => ({ ...current, ...changes }));

  const levels = useMemo(() => map_levels_of(fields), [fields]);
  const places = useMemo(() => geo_fields(fields), [fields]);
  const numbers = useMemo(() => number_fields(fields), [fields]);
  const options = useMemo(() => field_options(fields, translate), [fields, translate]);
  const formula = formula_of(spec.aggregation);
  const counts_all = spec.aggregation === "count";
  const measure_options = useMemo(
    () => (counts_all ? [{ id: ALL_SUBMISSIONS_ID, name: translate("DCS_DB_GEN_TOTAL"), badge: translate("DCS_DB_FT_TOTAL") }].concat(options) : options),
    [counts_all, options, translate],
  );
  const level_entry = levels.find((entry) => entry.level === spec.level) || null;
  const place_options = level_entry ? level_entry.fields.map((entry) => ({ id: entry.id, name: entry.label })) : [];
  const place_id = spec.place_id || (place_options[0] ? place_options[0].id : "");
  const is_heat = spec.kind === "heat";
  const point_id = spec.point_id || (places[0] ? places[0].id : "");
  // Only a choice field can split a map into named values.
  const split_options = useMemo(() => field_options(fields.filter((field) => field.is_choice && field.id !== place_id), translate), [fields, place_id, translate]);
  const weight_options = useMemo(() => numbers.map((field) => ({ id: field.id, name: field.label })), [numbers]);
  const level_name = (level) => translate(`DCS_DB_MAP_LEVEL_${level.toUpperCase()}`);
  // "per Village" reads better in a title than "per Villages".
  const one_level_name = (level) => translate(`DCS_DB_MAP_ONE_${level.toUpperCase()}`);

  const has_boundaries = levels.some((entry) => entry.level !== "province");
  const has_points = places.length > 0;

  // The first level the form can draw, chosen for the user.
  useEffect(() => {
    if (spec.level || levels.length === 0) return;
    const first = levels.find((entry) => entry.level !== "province") || levels[0];
    patch({ level: first.level, place_id: first.fields[0].id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levels.length]);

  // A form that can only do one of the two opens on that one.
  useEffect(() => {
    if (!has_boundaries && has_points && spec.kind !== "heat") patch({ kind: "heat" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [has_boundaries, has_points]);

  useEffect(() => {
    if (spec.title_touched) return;
    const measure = counts_all && (!spec.field_id || spec.field_id === ALL_SUBMISSIONS_ID) ? translate("DCS_DB_GEN_TOTAL") : (options.find((option) => option.id === spec.field_id) || {}).name || "";
    const next = is_heat
      ? translate("DCS_DB_MAP_HEAT_DEFAULT_TITLE", { measure: measure || translate("DCS_DB_GEN_TOTAL") })
      : level_entry
        ? translate("DCS_DB_MAP_DEFAULT_TITLE", { measure: measure || translate("DCS_DB_GEN_TOTAL"), level: one_level_name(spec.level) })
        : "";
    if (next && next !== spec.title) patch({ title: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.kind, spec.level, spec.aggregation, spec.field_id, translate]);

  if (!has_boundaries && !has_points) return <Problem>{translate("DCS_DB_MAP_NO_PLACES")}</Problem>;

  const measure_missing = !counts_all && !spec.field_id;
  const problem = is_heat
    ? !point_id
      ? translate("DCS_DB_MAP_PICK_POINT")
      : !spec.title.trim()
        ? translate("DCS_DB_NEED_TITLE")
        : ""
    : !spec.level
      ? translate("DCS_DB_MAP_PICK_LEVEL")
      : measure_missing
        ? translate("DCS_DB_NEED_MEASURE_FIELD")
        : !spec.title.trim()
          ? translate("DCS_DB_NEED_TITLE")
          : period_problem(spec.period, translate);

  const add = () => {
    if (problem) return;
    const spread = SPREADS[spec.spread] || SPREADS.balanced;
    const widget = build_map_draft(form, {
      chart_type: "map",
      title: spec.title.trim().slice(0, 120),
      description: spec.description.trim().slice(0, 300) || null,
      size: spec.size,
      appearance: spec.appearance,
      metric: { aggregation: spec.aggregation, field_id: counts_all && (!spec.field_id || spec.field_id === ALL_SUBMISSIONS_ID) ? null : spec.field_id },
      group_by: is_heat ? null : { field_id: place_id },
      split_by: spec.split_id ? { field_id: spec.split_id } : null,
      map: is_heat
        ? {
            mode: "heat",
            point_field_id: point_id,
            weight_field_id: spec.weight_id || null,
            radius: spread.radius,
            intensity: spread.intensity,
            show_points: spec.show_points,
            low_color: spec.low_color,
            high_color: spec.high_color,
          }
        : { mode: "world", level: spec.level, marker: spec.marker, show_markers: spec.show_markers, show_labels: spec.show_labels },
    });
    onAdd({
      tab: "map",
      summary: widget.title,
      detail: is_heat ? translate("DCS_DB_MAP_KIND_HEAT") : `${translate("DCS_DB_CHART_MAP")} - ${level_name(spec.level)}`,
      with_chart: "",
      widgets: with_behavior([widget], spec),
      spec: { ...spec, place_id, point_id },
    });
    showSuccess(editing ? translate("DCS_DB_DRAFT_UPDATED") : translate("DCS_DB_MAP_ADDED"));
    setSpec(EMPTY_MAP_SPEC);
  };

  const kinds = [
    { id: "world", label: translate("DCS_DB_MAP_KIND_WORLD"), disabled: !has_boundaries },
    { id: "heat", label: translate("DCS_DB_MAP_KIND_HEAT"), disabled: !has_points },
  ].filter((entry) => !entry.disabled);

  return (
    <div className="space-y-5">
      <Step number={1} titleKey="DCS_DB_MAP_STEP_KIND" hintKey="DCS_DB_MAP_STEP_KIND_HINT">
        <ChipGrid options={kinds} value={spec.kind} onChange={(kind) => patch({ kind })} disabled={disabled} columns="grid-cols-2" />
        {!has_points && <Preview>{translate("DCS_DB_MAP_NO_GEO")}</Preview>}
        {is_heat && <Preview>{translate("DCS_DB_MAP_HEAT_ABOUT")}</Preview>}
      </Step>

      {is_heat ? (
        <>
          <Step number={2} titleKey="DCS_DB_MAP_STEP_POINTS" hintKey="DCS_DB_MAP_STEP_POINTS_HINT">
            <FieldSelect
              label={translate("DCS_DB_MAP_POINT_FIELD")}
              options={places.map((field) => ({ id: field.id, name: field.label }))}
              value={point_id}
              onChange={(value) => patch({ point_id: value })}
              disabled={disabled}
            />
            <FieldSelect
              label={translate("DCS_DB_MAP_WEIGHT_FIELD")}
              options={weight_options}
              value={spec.weight_id}
              onChange={(weight_id) => patch({ weight_id })}
              placeholder={translate("DCS_DB_MAP_WEIGHT_NONE")}
              disabled={disabled}
              allowClear
            />
            <FieldSelect
              label={translate("DCS_DB_MAP_SPLIT")}
              options={split_options}
              value={spec.split_id}
              onChange={(split_id) => patch({ split_id })}
              placeholder={translate("DCS_DB_FIELD_SPLIT_PLACEHOLDER")}
              disabled={disabled}
              allowClear
            />
            <Preview>{translate(spec.split_id ? "DCS_DB_MAP_HEAT_SPLIT_PREVIEW" : "DCS_DB_MAP_HEAT_PREVIEW")}</Preview>
          </Step>

          <Step number={3} titleKey="DCS_DB_MAP_STEP_HEAT_LOOK" hintKey="DCS_DB_MAP_STEP_HEAT_LOOK_HINT">
            <p className="text-xs mb-1" style={{ color: TEXT_MUTED }}>
              {translate("DCS_DB_MAP_SPREAD")}
            </p>
            <ChipGrid
              options={Object.keys(SPREADS).map((id) => ({ id, label: translate(`DCS_DB_MAP_SPREAD_${id.toUpperCase()}`) }))}
              value={spec.spread}
              onChange={(spread) => patch({ spread })}
              disabled={disabled}
              columns="grid-cols-3"
            />
            {!spec.split_id && (
              <div className="flex flex-wrap items-end gap-3 mt-3">
                <ColorInput label={translate("DCS_DB_MAP_HEAT_LOW")} value={spec.low_color} onChange={(low_color) => patch({ low_color })} disabled={disabled} />
                <ColorInput label={translate("DCS_DB_MAP_HEAT_HIGH")} value={spec.high_color} onChange={(high_color) => patch({ high_color })} disabled={disabled} />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-4 mt-3">
              <Switch checked={spec.show_points} onChange={(show_points) => patch({ show_points })} label={translate("DCS_DB_MAP_SHOW_POINTS")} disabled={disabled} />
            </div>
            <p className="text-xs mb-1 mt-3" style={{ color: TEXT_MUTED }}>
              {translate("DCS_DB_SIZE")}
            </p>
            <ChipGrid options={SIZES.map((size) => ({ id: size, label: translate(`DCS_DB_SIZE_${size.toUpperCase()}`) }))} value={spec.size} onChange={(size) => patch({ size })} disabled={disabled} columns="grid-cols-3" />
          </Step>
        </>
      ) : (
        <>
          <Step number={2} titleKey="DCS_DB_MAP_STEP_LEVEL">
            <ChipGrid
              options={levels.map((entry) => ({ id: entry.level, label: level_name(entry.level) }))}
              value={spec.level}
              onChange={(level) => patch({ level, place_id: (levels.find((entry) => entry.level === level).fields[0] || {}).id || "" })}
              disabled={disabled}
            />
            {place_options.length > 1 && (
              <div className="mt-2">
                <FieldSelect label={translate("DCS_DB_MAP_PLACE_FIELD")} options={place_options} value={place_id} onChange={(value) => patch({ place_id: value })} disabled={disabled} />
              </div>
            )}
            {level_entry && <Preview>{translate("DCS_DB_MAP_LEVEL_PREVIEW", { level: level_name(spec.level), field: (place_options.find((option) => option.id === place_id) || {}).name || "" })}</Preview>}
          </Step>

          <Step number={3} titleKey="DCS_DB_STEP_MEASURE" hintKey="DCS_DB_MAP_STEP_FORMULA_HINT">
            <ChipGrid
              options={CHART_FORMULAS.map((entry) => ({ id: entry.id, label: translate(entry.labelKey), hintKey: entry.hintKey }))}
              value={spec.aggregation}
              onChange={(aggregation) => patch({ aggregation, field_id: aggregation !== "count" && spec.field_id === ALL_SUBMISSIONS_ID ? "" : spec.field_id })}
              disabled={disabled}
            />
            <div className="mt-2">
              <FieldSelect
                label={translate(formula ? formula.labelKey : "DCS_DB_STEP_FORMULA")}
                options={measure_options}
                value={spec.field_id || (counts_all ? ALL_SUBMISSIONS_ID : "")}
                onChange={(field_id) => patch({ field_id })}
                placeholder={translate("DCS_DB_GEN_TOTAL")}
                disabled={disabled}
              />
              <FieldSelect
                label={translate("DCS_DB_MAP_SPLIT")}
                options={split_options}
                value={spec.split_id}
                onChange={(split_id) => patch({ split_id })}
                placeholder={translate("DCS_DB_FIELD_SPLIT_PLACEHOLDER")}
                disabled={disabled}
                allowClear
              />
            </div>
          </Step>

          <Step number={4} titleKey="DCS_DB_MAP_STEP_LOOK" hintKey="DCS_DB_MAP_STEP_LOOK_HINT">
            <div className="flex flex-wrap items-center gap-4 mb-3">
              <Switch checked={spec.show_labels} onChange={(show_labels) => patch({ show_labels })} label={translate("DCS_DB_MAP_SHOW_LABELS")} disabled={disabled} />
              <Switch checked={spec.show_markers} onChange={(show_markers) => patch({ show_markers })} label={translate("DCS_DB_MAP_SHOW_MARKERS")} disabled={disabled} />
            </div>
            {spec.show_markers && (
              <div className="dcs-map-marker-grid mb-2">
                {MARKER_SET.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    disabled={disabled}
                    title={icon.split(":").pop()}
                    onClick={() => patch({ marker: icon })}
                    className="dcs-map-marker-pick"
                    style={{ borderColor: spec.marker === icon ? PRIMARY : BORDER, backgroundColor: spec.marker === icon ? "rgba(5,109,170,0.08)" : "#FFFFFF" }}
                  >
                    <LibraryIcon icon={icon} size={18} color={spec.marker === icon ? PRIMARY : "#333333"} />
                  </button>
                ))}
              </div>
            )}
            {spec.show_markers && (
              <button
                type="button"
                className="dcs-link-action text-xs font-bold uppercase"
                style={{ color: PRIMARY, background: "none", border: "none", padding: 0, cursor: "pointer", letterSpacing: "0.4px" }}
                disabled={disabled}
                onClick={() => setPickingIcon(true)}
              >
                {translate("DCS_DB_MAP_MORE_ICONS")}
              </button>
            )}
            {picking_icon && (
              <IconPickerPanel
                widget={{ icon: spec.marker }}
                onPick={(icon) => {
                  patch({ marker: icon });
                  setPickingIcon(false);
                }}
                onRemove={() => {
                  patch({ marker: MARKER_SET[0] });
                  setPickingIcon(false);
                }}
                onClose={() => setPickingIcon(false)}
              />
            )}
            {spec.show_markers && spec.split_id && <Preview>{translate("DCS_DB_MAP_MARKER_SPLIT")}</Preview>}
            <p className="text-xs mb-1 mt-2" style={{ color: TEXT_MUTED }}>
              {translate("DCS_DB_SIZE")}
            </p>
            <ChipGrid options={SIZES.map((size) => ({ id: size, label: translate(`DCS_DB_SIZE_${size.toUpperCase()}`) }))} value={spec.size} onChange={(size) => patch({ size })} disabled={disabled} columns="grid-cols-3" />
          </Step>
        </>
      )}

      <Step number={4} titleKey="DCS_DB_STEP_DETAILS">
        <TitleFields
          title={spec.title}
          description={spec.description}
          onTitle={(title) => patch({ title, title_touched: true })}
          onDescription={(description) => patch({ description })}
          disabled={disabled}
        />
      </Step>

      <Step number={5} titleKey="DCS_DB_STEP_COLORS" hintKey="DCS_DB_STEP_COLORS_HINT">
        <ColorSettingsButton
          form={form}
          title={spec.title}
          valuesField={fields.find((field) => field.id === (spec.split_id || (is_heat ? point_id : place_id))) || null}
          appearance={spec.appearance}
          onChange={(appearance) => patch({ appearance })}
          disabled={disabled}
        />
      </Step>

      <WidgetBehaviorStep number={6} spec={spec} onPatch={patch} fields={fields} filterDefs={filterDefs} disabled={disabled} />

      <div>
        <Problem>{problem}</Problem>
        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          <DcsButtonPrimary className="sm:w-56" type="button" onClick={add} disabled={disabled || !!problem}>
            {translate(editing ? "DCS_DB_DRAFT_UPDATE" : "DCS_DB_MAP_ADD")}
          </DcsButtonPrimary>
          {editing ? (
            <DcsButtonOutline className="sm:w-36" type="button" onClick={onCancelEdit} disabled={disabled}>
              {translate("DCS_DB_DRAFT_CANCEL_EDIT")}
            </DcsButtonOutline>
          ) : (
            <DcsButtonOutline className="sm:w-32" type="button" onClick={() => setSpec(EMPTY_MAP_SPEC)} disabled={disabled}>
              {translate("DCS_DB_RESET")}
            </DcsButtonOutline>
          )}
        </div>
      </div>
    </div>
  );
}
