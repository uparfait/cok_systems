import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { save_dashboard, request_error_text } from "./dashboardService.js";
import { chart_definition, flatten_schema_fields, field_label_text } from "./chartCatalog.js";
import { formula_of, MAX_WIDGETS } from "./builder/composeWidgets.js";
import { build_dashboard_creation_guide, parse_pasted_dashboard, normalize_pasted_widgets, normalize_pasted_filters } from "./dashboardSpecCatalog.js";
import { MAX_BOARD_FILTERS } from "./boardFilters.js";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsButtonOutlineReverse from "../components/DcsButtonOutlineReverse.jsx";
import { portal_root } from "./portalRoot.js";

const BORDER = "#E0E0E0";
const TEXT_DARK = "#333333";
const TEXT_MUTED = "#9E9E9E";
const FONT = "'Montserrat', sans-serif";

/** Ctrl+6 (or Cmd+6) opens the dashboard code tools while enabled. */
export function useDashboardCodeShortcut(enabled, open) {
  useEffect(() => {
    if (!enabled) return undefined;
    const on_keydown = (event) => {
      if (!(event.ctrlKey || event.metaKey) || String(event.key) !== "6") return;
      event.preventDefault();
      open();
    };
    document.addEventListener("keydown", on_keydown);
    return () => document.removeEventListener("keydown", on_keydown);
  }, [enabled, open]);
}

function Panel({ title, children, aside }) {
  return (
    <div className="bg-white border-2 p-4" style={{ borderColor: BORDER }}>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <p className="text-sm font-semibold" style={{ color: TEXT_DARK, fontFamily: FONT }}>
          {title}
        </p>
        {aside}
      </div>
      {children}
    </div>
  );
}

function SelectLinks({ onAll, onNone }) {
  const { translate } = useDcsLanguage();
  return (
    <div className="flex gap-3">
      <button type="button" onClick={onAll} className="text-xs cursor-pointer underline" style={{ color: "#056daa" }}>
        {translate("DCS_BTN_SELECT_ALL")}
      </button>
      <button type="button" onClick={onNone} className="text-xs cursor-pointer underline" style={{ color: "#056daa" }}>
        {translate("DCS_BTN_SELECT_NONE")}
      </button>
    </div>
  );
}

/**
 * Ctrl+6 overlay of the dashboard, the twin of the form builder's code
 * tools: a table of the widgets already on the board, a checklist of
 * widgets to copy out as JSON, the creation rules (this form's every field
 * and every widget option, for an external AI) to copy, and a paste box
 * that saves a widget list authored elsewhere - added to the board or
 * replacing it. The server validates the result against the form.
 */
export default function DashboardCodeOverlay({ form, widgets, filters, onSaved, onClose }) {
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const [pasted, setPasted] = useState("");
  const [problem, setProblem] = useState("");
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(() => new Set(widgets.map((widget) => widget.id)));

  const fields = flatten_schema_fields((form.schema && form.schema.fields) || []);
  const label_of = (ref) => {
    const id = ref && typeof ref === "object" ? ref.field_id : ref;
    if (!id) return "-";
    if (id === "submitted_at") return translate("DCS_DB_SUBMITTED_AT");
    const field = fields.find((entry) => entry.id === id);
    return field ? field_label_text(field) : id;
  };
  const type_text = (chart_type) => {
    const definition = chart_definition(chart_type);
    return definition ? translate(definition.labelKey) : chart_type;
  };
  const measure_text = (widget) => {
    // A section and a text block measure nothing.
    if (["canvas", "text"].includes(widget.chart_type)) return "-";
    const formula = formula_of((widget.metric || {}).aggregation);
    const name = formula ? translate(formula.labelKey) : (widget.metric || {}).aggregation || "count";
    const field = (widget.metric || {}).field_id;
    return field ? `${name} - ${label_of(field)}` : name;
  };

  const toggle = (id) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const copy_rules = () => {
    window.navigator.clipboard.writeText(JSON.stringify(build_dashboard_creation_guide(form), null, 2));
    showSuccess(translate("DCS_DB_TOAST_RULES_COPIED"));
  };

  const copy_widgets = () => {
    const chosen = widgets.filter((widget) => selected.has(widget.id));
    window.navigator.clipboard.writeText(JSON.stringify({ filters: filters || [], widgets: chosen }, null, 2));
    showSuccess(translate("DCS_DB_TOAST_JSON_COPIED"));
  };

  const apply = async (mode) => {
    setProblem("");
    let normalized;
    let pasted_filters = null;
    try {
      const parsed = parse_pasted_dashboard(pasted);
      normalized = normalize_pasted_widgets(form, parsed.widgets);
      if (parsed.filters) pasted_filters = normalize_pasted_filters(form, parsed.filters);
    } catch (error) {
      setProblem(translate("DCS_DB_ERROR_INVALID_CODE"));
      return;
    }
    const unknown = normalized.unknown_fields.concat(pasted_filters ? pasted_filters.unknown_fields : []);
    if (unknown.length > 0) {
      setProblem(translate("DCS_DB_CODE_UNKNOWN_FIELDS", { ids: unknown.join(", ") }));
      return;
    }
    // Pasted filters are added to the board's (or replace them); none pasted leaves them alone.
    let next_filters;
    if (pasted_filters) {
      const base = mode === "add" ? filters || [] : [];
      const ids = new Set(base.map((def) => def.field_id));
      next_filters = base.concat(pasted_filters.filters.filter((def) => !ids.has(def.field_id))).slice(0, MAX_BOARD_FILTERS);
    }
    const merged = (mode === "add" ? widgets.concat(normalized.widgets) : normalized.widgets).map((widget, index) => ({ ...widget, position: index }));
    if (merged.length > MAX_WIDGETS) {
      setProblem(translate("DCS_DB_CODE_TOO_MANY", { count: merged.length, max: MAX_WIDGETS }));
      return;
    }
    setSaving(true);
    try {
      const saved = await save_dashboard(form, merged, next_filters);
      const final_widgets = (saved.data && saved.data.widgets) || merged;
      showSuccess(translate("DCS_DB_TOAST_CREATED_FROM_CODE", { count: final_widgets.length }));
      onSaved(final_widgets, next_filters ? (saved.data && saved.data.filters) || next_filters : undefined);
    } catch (error) {
      setProblem(request_error_text(error, translate("DCS_ERROR_GENERIC")));
      showError(request_error_text(error, translate("DCS_ERROR_GENERIC")));
    } finally {
      setSaving(false);
    }
  };

  const cell = "p-2 border align-top";
  const cell_style = { borderColor: BORDER, color: TEXT_DARK };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex flex-col" style={{ backgroundColor: "#F7F9FB" }}>
      <div className="cok-bg-primary px-4 py-3 flex items-center justify-between flex-shrink-0">
        <span className="text-white font-semibold uppercase tracking-wide text-sm" style={{ fontFamily: FONT }}>
          {translate("DCS_DB_CODE_TITLE")}
        </span>
        <DcsButtonOutlineReverse onClick={onClose} disabled={saving}>
          {translate("DCS_BTN_CLOSE")}
        </DcsButtonOutlineReverse>
      </div>

      <div className="flex-1 overflow-y-auto p-4 min-[700px]:p-6">
        <div className="w-full min-[900px]:max-w-[900px] mx-auto space-y-6">
          <Panel title={translate("DCS_DB_CODE_CURRENT_TITLE", { count: widgets.length })}>
            {widgets.length === 0 ? (
              <p className="text-xs" style={{ color: TEXT_MUTED }}>
                {translate("DCS_DB_CODE_NO_WIDGETS")}
              </p>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#F7F9FB" }}>
                      {["DCS_DB_CODE_TABLE_TYPE", "DCS_DB_CODE_TABLE_TITLE", "DCS_DB_CODE_TABLE_MEASURE", "DCS_DB_CODE_TABLE_GROUP", "DCS_DB_CODE_TABLE_SPLIT"].map((key) => (
                        <th key={key} className="text-left p-2 border" style={{ borderColor: BORDER }}>
                          {translate(key)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {widgets.map((widget) => (
                      <tr key={widget.id}>
                        <td className={cell} style={cell_style}>{type_text(widget.chart_type)}</td>
                        <td className={cell} style={cell_style}>{widget.title}</td>
                        <td className={cell} style={cell_style}>{measure_text(widget)}</td>
                        <td className={cell} style={cell_style}>{widget.x_field_id ? `${label_of(widget.x_field_id)} / ${label_of(widget.y_field_id)}` : label_of(widget.group_by)}</td>
                        <td className={cell} style={cell_style}>{label_of(widget.split_by || widget.legend_by)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title={translate("DCS_DB_CODE_COPY_SELECT_TITLE")} aside={<SelectLinks onAll={() => setSelected(new Set(widgets.map((widget) => widget.id)))} onNone={() => setSelected(new Set())} />}>
            {widgets.length === 0 ? (
              <p className="text-xs" style={{ color: TEXT_MUTED }}>
                {translate("DCS_DB_CODE_NO_WIDGETS")}
              </p>
            ) : (
              <div className="grid grid-cols-1 min-[700px]:grid-cols-2 gap-x-4">
                {widgets.map((widget) => (
                  <label key={widget.id} className="w-full flex items-center gap-3 px-1 py-1.5 cursor-pointer hover:bg-gray-50 min-w-0">
                    <input type="checkbox" checked={selected.has(widget.id)} onChange={() => toggle(widget.id)} />
                    <span className="text-sm truncate" style={{ color: TEXT_DARK }}>{widget.title}</span>
                    <span className="text-xs flex-shrink-0" style={{ color: TEXT_MUTED }}>({type_text(widget.chart_type)})</span>
                  </label>
                ))}
              </div>
            )}
            <DcsButtonOutline className="w-full mt-3" onClick={copy_widgets} disabled={selected.size === 0}>
              {translate("DCS_DB_BTN_COPY_CREATED")}
            </DcsButtonOutline>
          </Panel>

          <Panel title={translate("DCS_DB_CODE_RULES_TITLE")}>
            <p className="text-xs mb-3" style={{ color: TEXT_MUTED }}>
              {translate("DCS_DB_CODE_RULES_HINT", { count: fields.length })}
            </p>
            <DcsButtonOutline className="w-full" onClick={copy_rules}>
              {translate("DCS_BTN_COPY_CREATION_RULES")}
            </DcsButtonOutline>
          </Panel>

          <div className="bg-white border-2 p-4 space-y-3" style={{ borderColor: BORDER }}>
            <label className="cok-auth-label">{translate("DCS_DB_CODE_PASTE_LABEL")}</label>
            <textarea className="cok-auth-input w-full py-2" rows={10} style={{ fontFamily: "monospace", fontSize: 12 }} placeholder={translate("DCS_DB_CODE_PASTE_PLACEHOLDER")} value={pasted} onChange={(event) => setPasted(event.target.value)} disabled={saving} />
            {problem && (
              <p className="text-xs" style={{ color: "#E74C3C" }}>
                {problem}
              </p>
            )}
            <p className="text-xs" style={{ color: TEXT_MUTED }}>
              {translate("DCS_DB_CODE_REPLACE_WARNING")}
            </p>
            <div className="flex flex-col min-[700px]:flex-row gap-3 pt-1">
              <DcsButtonPrimary className="flex-1" onClick={() => apply("add")} disabled={!pasted.trim() || saving}>
                {translate("DCS_DB_BTN_PASTE_ADD")}
              </DcsButtonPrimary>
              <DcsButtonOutline className="flex-1" onClick={() => apply("overwrite")} disabled={!pasted.trim() || saving}>
                {translate("DCS_DB_BTN_PASTE_OVERWRITE")}
              </DcsButtonOutline>
            </div>
          </div>
        </div>
      </div>
    </div>,
    portal_root(),
  );
}
