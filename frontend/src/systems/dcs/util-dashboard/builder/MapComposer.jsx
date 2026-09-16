import React, { useEffect, useMemo, useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { useToast } from "../../../../core/contexts/ToastContext.tsx";
import DcsButtonPrimary from "../../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../../components/DcsButtonOutline.jsx";
import LibraryIcon from "../icons/LibraryIcon.jsx";
import { MARKER_SET } from "../charts/mapMarkers.js";
import { Step, ChipGrid, Switch, Problem, Preview, FieldSelect, TitleFields, TEXT_MUTED, PRIMARY, BORDER } from "./builderUi.jsx";
import ColorSettingsButton from "./ColorSettingsButton.jsx";
import { CHART_FORMULAS, formula_of, field_options, build_map_draft, ALL_SUBMISSIONS_ID } from "./composeWidgets.js";
import { map_levels_of } from "./mapFields.js";

export const EMPTY_MAP_SPEC = {
  level: "",
  place_id: "",
  aggregation: "count",
  field_id: "",
  split_id: "",
  marker: MARKER_SET[0],
  show_markers: false,
  show_labels: true,
  title: "",
  title_touched: false,
  description: "",
  size: "large",
  appearance: null,
};

const SIZES = ["small", "medium", "large"];

/**
 * The Map tab: a widget that paints the City of Kigali's own boundaries
 * instead of bars. The level decides which boundaries are drawn (districts,
 * sectors, cells, villages) and the form field of that level names them;
 * the formula decides what each place is worth, and an optional choice
 * field (gender, status) splits every place into values the legend names
 * and the markers tell apart.
 *
 * A map is only offered when the form actually asks where something
 * happened - a district or something below it.
 */
export default function MapComposer({ form, fields, onAdd, disabled, initialSpec, editing, onCancelEdit }) {
  const { translate } = useDcsLanguage();
  const { showSuccess } = useToast();
  const [spec, setSpec] = useState(initialSpec || EMPTY_MAP_SPEC);
  const patch = (changes) => setSpec((current) => ({ ...current, ...changes }));

  const levels = useMemo(() => map_levels_of(fields), [fields]);
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
  // Only a choice field can split a place into named values.
  const split_options = useMemo(() => field_options(fields.filter((field) => field.is_choice && field.id !== place_id), translate), [fields, place_id, translate]);
  const level_name = (level) => translate(`DCS_DB_MAP_LEVEL_${level.toUpperCase()}`);
  // "per Village" reads better in a title than "per Villages".
  const one_level_name = (level) => translate(`DCS_DB_MAP_ONE_${level.toUpperCase()}`);

  // The first level the form can draw, chosen for the user.
  useEffect(() => {
    if (spec.level || levels.length === 0) return;
    const first = levels.find((entry) => entry.level !== "province") || levels[0];
    patch({ level: first.level, place_id: first.fields[0].id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levels.length]);

  useEffect(() => {
    if (spec.title_touched || !level_entry) return;
    const measure = counts_all && (!spec.field_id || spec.field_id === ALL_SUBMISSIONS_ID) ? translate("DCS_DB_GEN_TOTAL") : (options.find((option) => option.id === spec.field_id) || {}).name || "";
    const next = translate("DCS_DB_MAP_DEFAULT_TITLE", { measure: measure || translate("DCS_DB_GEN_TOTAL"), level: one_level_name(spec.level) });
    if (next !== spec.title) patch({ title: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.level, spec.aggregation, spec.field_id, translate]);

  if (levels.length === 0 || !levels.some((entry) => entry.level !== "province")) {
    return (
      <Problem>{translate("DCS_DB_MAP_NO_PLACES")}</Problem>
    );
  }

  const measure_missing = !counts_all && !spec.field_id;
  const problem = !spec.level ? translate("DCS_DB_MAP_PICK_LEVEL") : measure_missing ? translate("DCS_DB_NEED_MEASURE_FIELD") : !spec.title.trim() ? translate("DCS_DB_NEED_TITLE") : "";

  const add = () => {
    if (problem) return;
    const widget = build_map_draft(form, {
      chart_type: "map",
      title: spec.title.trim().slice(0, 120),
      description: spec.description.trim().slice(0, 300) || null,
      size: spec.size,
      appearance: spec.appearance,
      metric: { aggregation: spec.aggregation, field_id: counts_all && (!spec.field_id || spec.field_id === ALL_SUBMISSIONS_ID) ? null : spec.field_id },
      group_by: { field_id: place_id },
      split_by: spec.split_id ? { field_id: spec.split_id } : null,
      map: { level: spec.level, marker: spec.marker, show_markers: spec.show_markers, show_labels: spec.show_labels },
    });
    onAdd({
      tab: "map",
      summary: widget.title,
      detail: `${translate("DCS_DB_CHART_MAP")} - ${level_name(spec.level)}`,
      with_chart: "",
      widgets: [widget],
      spec: { ...spec, place_id },
    });
    showSuccess(editing ? translate("DCS_DB_DRAFT_UPDATED") : translate("DCS_DB_MAP_ADDED"));
    setSpec(EMPTY_MAP_SPEC);
  };

  return (
    <div className="space-y-5">
      <Step number={1} titleKey="DCS_DB_MAP_STEP_LEVEL" hintKey="DCS_DB_MAP_STEP_LEVEL_HINT">
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

      <Step number={2} titleKey="DCS_DB_STEP_MEASURE" hintKey="DCS_DB_MAP_STEP_FORMULA_HINT">
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

      <Step number={3} titleKey="DCS_DB_MAP_STEP_LOOK" hintKey="DCS_DB_MAP_STEP_LOOK_HINT">
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
        {spec.show_markers && spec.split_id && <Preview>{translate("DCS_DB_MAP_MARKER_SPLIT")}</Preview>}
        <p className="text-xs mb-1 mt-2" style={{ color: TEXT_MUTED }}>
          {translate("DCS_DB_SIZE")}
        </p>
        <ChipGrid options={SIZES.map((size) => ({ id: size, label: translate(`DCS_DB_SIZE_${size.toUpperCase()}`) }))} value={spec.size} onChange={(size) => patch({ size })} disabled={disabled} columns="grid-cols-3" />
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

      <Step number={5} titleKey="DCS_DB_STEP_COLORS" hintKey="DCS_DB_STEP_COLORS_HINT">
        <ColorSettingsButton
          form={form}
          title={spec.title}
          valuesField={fields.find((field) => field.id === (spec.split_id || place_id)) || null}
          appearance={spec.appearance}
          onChange={(appearance) => patch({ appearance })}
          disabled={disabled}
        />
      </Step>

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
