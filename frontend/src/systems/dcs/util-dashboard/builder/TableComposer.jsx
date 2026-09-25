import React, { useEffect, useMemo, useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { useToast } from "../../../../core/contexts/ToastContext.tsx";
import DcsButtonPrimary from "../../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../../components/DcsButtonOutline.jsx";
import { SUBMITTED_AT_FIELD } from "../chartCatalog.js";
import { Step, ChipGrid, Switch, Problem, Preview, FieldSelect, TitleFields, TEXT_MUTED } from "./builderUi.jsx";
import ColorSettingsButton from "./ColorSettingsButton.jsx";
import WidgetBehaviorStep from "./WidgetBehaviorStep.jsx";
import TableColumnsEditor from "./TableColumnsEditor.jsx";
import TableFieldsPicker from "./TableFieldsPicker.jsx";
import { field_options, formula_of } from "./composeWidgets.js";
import { EMPTY_TABLE_SPEC, TABLE_MODES, COLUMN_SOURCES, COLUMN_FORMULAS, FIELD_FORMULAS, PAGE_SIZE_MIN, PAGE_SIZE_MAX, ROW_LIMIT_MAX, table_spec_problems, default_table_title, build_table_draft } from "./tableCompose.js";

const SIZES = ["small", "medium", "large"];
const SORTS = ["value_desc", "value_asc", "label_asc"];

/**
 * The Table tab of the builder. First the kind: RECORDS (the submissions
 * themselves, the ticked fields as columns, ten to a hundred rows a page)
 * or SUMMARY (one row per value of a field, a column per value of another
 * field or per measure defined one by one, with totals). Then the words,
 * how the widget behaves under the board's date and filters, and its
 * colours. With initialSpec it reopens an existing table for editing.
 */
export default function TableComposer({ form, fields, filterDefs, onAdd, disabled, initialSpec, editing, onCancelEdit }) {
  const { translate } = useDcsLanguage();
  const { showSuccess } = useToast();
  const [spec, setSpec] = useState(initialSpec || EMPTY_TABLE_SPEC);
  const patch = (changes) => setSpec((current) => ({ ...current, ...changes }));
  const records = spec.mode === "records";
  const choice_options = useMemo(() => field_options(fields.filter((field) => field.is_choice), translate), [fields, translate]);
  const all_options = useMemo(() => field_options(fields, translate), [fields, translate]);
  const sort_options = useMemo(() => [{ id: SUBMITTED_AT_FIELD, name: translate("DCS_DB_SUBMITTED_AT") }].concat(all_options), [all_options, translate]);
  const formula_label = (id) => {
    const formula = formula_of(id);
    return formula ? translate(formula.labelKey) : id;
  };
  const formula_chips = COLUMN_FORMULAS.map((id) => ({ id, label: formula_label(id) }));

  useEffect(() => {
    if (spec.title_touched) return;
    const next = default_table_title(spec, fields, translate, formula_label);
    if (next !== spec.title) patch({ title: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.mode, spec.group_id, spec.columns_from, spec.split_id, spec.aggregation, spec.field_id, translate]);

  const problems = table_spec_problems(spec, fields, translate);
  const ready = problems.length === 0;
  const group = fields.find((field) => field.id === spec.group_id) || null;
  const split = fields.find((field) => field.id === spec.split_id) || null;
  const preview = !ready
    ? ""
    : records
      ? translate("DCS_DB_TABLE_PREVIEW_RECORDS", { count: spec.fields.length, rows: spec.page_size })
      : translate("DCS_DB_TABLE_PREVIEW_SUMMARY", { field: group ? group.label : "", count: spec.columns_from === "split" ? (split ? split.label : "") : spec.columns.length });

  const handle_add = () => {
    if (!ready) return;
    const widgets = build_table_draft(form, spec, fields);
    onAdd({
      tab: "table",
      summary: spec.title.trim(),
      detail: records ? translate("DCS_DB_TABLE_MODE_RECORDS") : `${translate("DCS_DB_TABLE_MODE_SUMMARY")} - ${group ? group.label : ""}${split ? ` / ${split.label}` : ""}`,
      with_chart: "",
      widgets,
      spec,
    });
    showSuccess(editing ? translate("DCS_DB_DRAFT_UPDATED") : translate("DCS_DB_TABLE_ADDED"));
    setSpec(EMPTY_TABLE_SPEC);
  };

  const bounded = (value, least, most) => Math.min(most, Math.max(least, Math.round(Number(value) || least)));

  return (
    <div className="dcs-view-swap flex flex-col gap-5">
      {editing && <Preview>{translate("DCS_DB_DRAFT_EDITING")}</Preview>}
      <p className="text-xs" style={{ color: TEXT_MUTED }}>{translate("DCS_DB_TABLE_INTRO")}</p>

      <Step number={1} titleKey="DCS_DB_STEP_TABLE_KIND">
        <ChipGrid
          options={TABLE_MODES.map((mode) => ({ id: mode, label: translate(`DCS_DB_TABLE_MODE_${mode.toUpperCase()}`), hintKey: `DCS_DB_TABLE_MODE_${mode.toUpperCase()}_HINT` }))}
          value={spec.mode}
          onChange={(mode) => patch({ mode, size: mode === "records" ? "large" : spec.size })}
          disabled={disabled}
          columns="grid-cols-2 sm:w-96"
        />
      </Step>

      {records ? (
        <Step number={2} titleKey="DCS_DB_STEP_TABLE_FIELDS" hintKey="DCS_DB_TABLE_FIELDS_HINT">
          <TableFieldsPicker fields={fields} value={spec.fields} onChange={(picked) => patch({ fields: picked })} disabled={disabled} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs" style={{ color: TEXT_MUTED }}>{translate("DCS_DB_TABLE_PAGE_SIZE")}</span>
              <input type="number" min={PAGE_SIZE_MIN} max={PAGE_SIZE_MAX} step={5} className="dcs-rename-input" value={spec.page_size} disabled={disabled} onChange={(event) => patch({ page_size: Number(event.target.value) })} onBlur={() => patch({ page_size: bounded(spec.page_size, PAGE_SIZE_MIN, PAGE_SIZE_MAX) })} />
            </label>
            <div>
              <FieldSelect label={translate("DCS_DB_TABLE_SORT")} options={sort_options} value={spec.sort_field} onChange={(sort_field) => patch({ sort_field })} placeholder={translate("DCS_DB_SUBMITTED_AT")} disabled={disabled} />
              <ChipGrid options={["desc", "asc"].map((dir) => ({ id: dir, label: translate(`DCS_DB_TABLE_SORT_${dir.toUpperCase()}`) }))} value={spec.sort_dir} onChange={(sort_dir) => patch({ sort_dir })} disabled={disabled} columns="grid-cols-2" />
            </div>
          </div>
          <div className="mt-3">
            <Switch checked={spec.show_submitted_at !== false} onChange={(show_submitted_at) => patch({ show_submitted_at })} label={translate("DCS_DB_TABLE_SHOW_SUBMITTED")} disabled={disabled} />
          </div>
        </Step>
      ) : (
        <>
          <Step number={2} titleKey="DCS_DB_STEP_TABLE_ROWS" hintKey="DCS_DB_TABLE_ROWS_HINT">
            <FieldSelect options={choice_options} value={spec.group_id} onChange={(group_id) => patch({ group_id, split_id: spec.split_id === group_id ? "" : spec.split_id })} placeholder={translate("DCS_DB_FIELD_GROUP_PLACEHOLDER")} disabled={disabled} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs" style={{ color: TEXT_MUTED }}>{translate("DCS_DB_TABLE_ROW_LIMIT")}</span>
                <input type="number" min={1} max={ROW_LIMIT_MAX} className="dcs-rename-input" value={spec.row_limit} disabled={disabled} onChange={(event) => patch({ row_limit: Number(event.target.value) })} onBlur={() => patch({ row_limit: bounded(spec.row_limit, 1, ROW_LIMIT_MAX) })} />
              </label>
              <div>
                <p className="text-xs mb-1" style={{ color: TEXT_MUTED }}>{translate("DCS_DB_TABLE_ROW_ORDER")}</p>
                <ChipGrid options={SORTS.map((sort) => ({ id: sort, label: translate(`DCS_DB_SORT_${sort.toUpperCase()}`) }))} value={spec.sort} onChange={(sort) => patch({ sort })} disabled={disabled} columns="grid-cols-3" />
              </div>
            </div>
          </Step>
          <Step number={3} titleKey="DCS_DB_STEP_TABLE_COLUMNS" hintKey="DCS_DB_TABLE_COLUMNS_HINT">
            <ChipGrid options={COLUMN_SOURCES.map((source) => ({ id: source, label: translate(source === "split" ? "DCS_DB_TABLE_COLUMNS_SPLIT" : "DCS_DB_TABLE_COLUMNS_MEASURES") }))} value={spec.columns_from} onChange={(columns_from) => patch({ columns_from })} disabled={disabled} columns="grid-cols-2 sm:w-96" />
            <div className="dcs-view-swap mt-3">
              {spec.columns_from === "split" ? (
                <>
                  <FieldSelect label={translate("DCS_DB_TABLE_SPLIT_FIELD")} options={choice_options.filter((option) => option.id !== spec.group_id)} value={spec.split_id} onChange={(split_id) => patch({ split_id })} placeholder={translate("DCS_DB_FIELD_SPLIT_PLACEHOLDER")} disabled={disabled} />
                  <p className="text-xs mb-1" style={{ color: TEXT_MUTED }}>{translate("DCS_DB_TABLE_CELL_FORMULA")}</p>
                  <ChipGrid options={formula_chips} value={spec.aggregation} onChange={(aggregation) => patch({ aggregation })} disabled={disabled} columns="grid-cols-2 sm:grid-cols-4" />
                  {FIELD_FORMULAS.includes(spec.aggregation) && (
                    <div className="mt-2">
                      <FieldSelect options={all_options} value={spec.field_id} onChange={(field_id) => patch({ field_id })} placeholder={translate("DCS_DB_NEED_MEASURE_FIELD")} disabled={disabled} />
                    </div>
                  )}
                </>
              ) : (
                <TableColumnsEditor fields={fields} columns={spec.columns} onChange={(columns) => patch({ columns })} disabled={disabled} />
              )}
            </div>
            <div className="flex flex-wrap gap-4 mt-3">
              <Switch checked={spec.totals_row !== false} onChange={(totals_row) => patch({ totals_row })} label={translate("DCS_DB_TABLE_TOTALS_ROW")} disabled={disabled} />
              <Switch checked={spec.totals_column === true} onChange={(totals_column) => patch({ totals_column })} label={translate("DCS_DB_TABLE_TOTALS_COLUMN")} disabled={disabled} />
            </div>
          </Step>
        </>
      )}

      <Step number={records ? 3 : 4} titleKey="DCS_DB_STEP_DETAILS">
        <TitleFields title={spec.title} description={spec.description} onTitle={(title) => patch({ title, title_touched: true })} onDescription={(description) => patch({ description })} disabled={disabled} />
        <div className="mt-2">
          <p className="text-xs mb-1" style={{ color: TEXT_MUTED }}>{translate("DCS_DB_SIZE")}</p>
          <ChipGrid options={SIZES.map((size) => ({ id: size, label: translate(`DCS_DB_SIZE_${size.toUpperCase()}`) }))} value={spec.size} onChange={(size) => patch({ size })} disabled={disabled} columns="grid-cols-3" />
        </div>
      </Step>

      <WidgetBehaviorStep number={records ? 4 : 5} spec={spec} onPatch={patch} fields={fields} filterDefs={filterDefs} disabled={disabled} />

      <Step number={records ? 5 : 6} titleKey="DCS_DB_STEP_COLORS" hintKey="DCS_DB_STEP_COLORS_HINT">
        <ColorSettingsButton form={form} title={spec.title} valuesField={records ? null : split || group} appearance={spec.appearance} onChange={(appearance) => patch({ appearance })} disabled={disabled} />
      </Step>

      <div>
        <Preview>{preview}</Preview>
        <Problem>{!ready ? problems[0] : ""}</Problem>
        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          <DcsButtonPrimary className="sm:w-56" disabled={disabled || !ready} onClick={handle_add}>
            {editing ? translate("DCS_DB_DRAFT_UPDATE") : translate("DCS_DB_ADD_TABLE")}
          </DcsButtonPrimary>
          {editing ? (
            <DcsButtonOutline className="sm:w-36" disabled={disabled} onClick={onCancelEdit}>
              {translate("DCS_DB_DRAFT_CANCEL_EDIT")}
            </DcsButtonOutline>
          ) : (
            <DcsButtonOutline className="sm:w-32" disabled={disabled} onClick={() => setSpec(EMPTY_TABLE_SPEC)}>
              {translate("DCS_DB_RESET")}
            </DcsButtonOutline>
          )}
        </div>
      </div>
    </div>
  );
}
