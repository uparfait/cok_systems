import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { useToast } from "../../../../core/contexts/ToastContext.tsx";
import { save_dashboard, request_error_text } from "../dashboardService.js";
import { IconButton, CLOSE_SVG } from "../BoardIcons.jsx";
import DcsButtonPrimary from "../../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../../components/DcsButtonOutline.jsx";
import DcsConfirmDialog from "../../components/DcsConfirmDialog.jsx";
import GenerationProgress from "../GenerationProgress.jsx";
import KpiComposer from "./KpiComposer.jsx";
import ChartComposer from "./ChartComposer.jsx";
import DraftList from "./DraftList.jsx";
import { TABS, MAX_WIDGETS, builder_fields, finalize_widgets, widget_to_spec, tab_of_widget } from "./composeWidgets.js";
import { default_box } from "../boxLayout.js";
import FiltersTab from "./FiltersTab.jsx";
import MapComposer from "./MapComposer.jsx";
import TextComposer from "./TextComposer.jsx";
import TableComposer from "./TableComposer.jsx";
import { text_widget_to_spec } from "./textCompose.js";
import { table_widget_to_spec } from "./tableCompose.js";
import { same_filter_defs } from "../boardFilters.js";
import { PRIMARY, BORDER, TEXT_DARK, TEXT_MUTED, HEADING_FONT } from "./builderUi.jsx";
import { portal_root } from "../portalRoot.js";

let draft_sequence = 0;

/**
 * The dashboard builder: a large overlay of tabs - KPI cards, Charts,
 * Diagrams, the board's Filters and a Map of the city - where the user
 * composes each widget by hand (formula, field, "in each", chart type...)
 * and watches the draft list grow on the right. Nothing touches the saved dashboard until "Save": drafts are then
 * appended to the current board or replace it, as chosen in the footer.
 *
 * With `reconfigure` it opens on ONE widget that is already on the board,
 * read back into the composer it was built with (see widget_to_spec) and
 * open for changing. Saving then puts the changed widget back where it
 * was, under its own id and in its own place, instead of adding a second
 * one beside it - so the button says Update, and nothing else on the board
 * is touched.
 */
export default function DashboardBuilder({ form, existingWidgets, existingFilters, initialTab, reconfigure, intoCanvas, onClose, onSaved, onAutoGenerate }) {
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const existing = existingWidgets || [];

  // Reconfiguring starts with the widget itself as the one draft, already
  // open in its composer.
  const reopened = useMemo(() => {
    if (!reconfigure) return null;
    // Each kind of widget is read back by the composer that builds it.
    const spec = reconfigure.chart_type === "text" ? text_widget_to_spec(reconfigure) : reconfigure.chart_type === "table" ? table_widget_to_spec(reconfigure) : widget_to_spec(reconfigure);
    return { key: "reconfigure", tab: tab_of_widget(reconfigure), spec, widgets: [reconfigure], summary: reconfigure.title || reconfigure.chart_type };
  }, [reconfigure]);
  const [tab, setTab] = useState(reopened ? reopened.tab : initialTab || "kpi");
  const [drafts, setDrafts] = useState(reopened ? [reopened] : []);
  // The board's filter fields (Filters tab), saved together with the widgets.
  const [filter_defs, setFilterDefs] = useState(existingFilters || []);
  const filters_changed = !same_filter_defs(filter_defs, existingFilters || []);
  const [mode, setMode] = useState(existing.length > 0 ? "append" : "replace");
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [confirm_close, setConfirmClose] = useState(false);
  // The draft reopened in its composer; adding then replaces it in place.
  const [editing, setEditing] = useState(reopened);

  const fields = useMemo(() => builder_fields(form.schema), [form.schema]);
  const draft_widgets = drafts.reduce((sum, draft) => sum + draft.widgets.length, 0);
  const base_count = mode === "append" ? existing.length : 0;
  const room = Math.max(0, MAX_WIDGETS - base_count);
  const over_limit = draft_widgets > room;

  const handle_add = (draft) => {
    if (editing) {
      const key = editing.key;
      setDrafts((current) => current.map((entry) => (entry.key === key ? { ...draft, key } : entry)));
      setEditing(null);
      return;
    }
    draft_sequence += 1;
    setDrafts((current) => current.concat([{ ...draft, key: `draft_${draft_sequence}` }]));
  };

  const handle_edit = (draft) => {
    setTab(draft.tab);
    setEditing(draft);
  };

  const handle_remove = (key) => {
    setDrafts((current) => current.filter((draft) => draft.key !== key));
    if (editing && editing.key === key) setEditing(null);
  };

  const switch_tab = (next) => {
    setTab(next);
    setEditing(null);
  };

  const composer_key = editing ? editing.key : "new";

  const request_close = () => {
    if (saving) return;
    if (drafts.length > 0 || filters_changed) setConfirmClose(true);
    else onClose();
  };

  const can_save = (draft_widgets > 0 || filters_changed) && !over_limit;

  const handle_save = async () => {
    if (!can_save) return;
    setSaving(true);
    setProgress(20);
    try {
      const built = drafts.flatMap((draft) => draft.widgets);
      // Built for a canvas: each one names it and starts at a sensible
      // size inside it, to be dragged or set from there.
      const fresh = intoCanvas ? built.map((widget) => Object.assign({}, widget, { parent_id: intoCanvas, box: default_box() })) : built;
      // Reconfiguring changes ONE widget in place: it keeps its id and its
      // position, and every other widget on the board is left alone.
      // ...and where it sits stays too: the composer does not own the
      // canvas a widget is in or the box it takes there.
      const replaced = reconfigure
        ? existing.map((widget) =>
            widget.id === reconfigure.id && fresh[0]
              ? Object.assign({}, fresh[0], {
                  id: reconfigure.id,
                  position: widget.position,
                  parent_id: widget.parent_id || null,
                  box: widget.parent_id ? widget.box || fresh[0].box || null : null,
                  // Read over time, and the fixed conditions it carried,
                  // unless the composer fanned out conditions of its own.
                  over_time: widget.over_time || null,
                  filters: Array.isArray(fresh[0].filters) && fresh[0].filters.length > 0 ? fresh[0].filters : widget.filters || [],
                })
              : widget,
          )
        : null;
      // Filters alone can be saved too: the widgets then stay as they are.
      const merged = replaced || (draft_widgets === 0 ? existing : finalize_widgets(mode === "append" ? existing.concat(fresh) : fresh));
      setProgress(60);
      const saved = await save_dashboard(form, merged, filter_defs);
      const final_widgets = (saved.data && saved.data.widgets) || merged;
      setProgress(100);
      showSuccess(translate("DCS_DB_BUILDER_SAVED", { count: final_widgets.length }));
      onSaved(final_widgets, (saved.data && saved.data.filters) || filter_defs);
    } catch (error) {
      showError(request_error_text(error, translate("DCS_ERROR_GENERIC")));
      setSaving(false);
      setProgress(0);
    }
  };

  const tab_count = (tab_id) => (tab_id === "filters" ? filter_defs.length : drafts.filter((draft) => draft.tab === tab_id).reduce((sum, draft) => sum + draft.widgets.length, 0));

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/45" onClick={request_close} />
      <div className="dcs-builder-pop relative bg-white border-2 w-full flex flex-col" style={{ maxWidth: 1180, height: "94vh", borderColor: PRIMARY }}>
        <div className="flex items-center justify-between gap-2 flex-shrink-0 px-4 sm:px-5 py-2" style={{ backgroundColor: PRIMARY }}>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase leading-tight truncate" style={{ color: "#FFFFFF", letterSpacing: "0.3px", ...HEADING_FONT }}>
              {translate("DCS_DB_BUILDER_TITLE")}
            </p>
            <p className="text-[11px] font-semibold truncate" style={{ color: "rgba(255,255,255,0.85)", ...HEADING_FONT }}>
              {translate("DCS_DB_BUILDER_SUBTITLE", { name: form.form_name || form.form_group_id })}
            </p>
          </div>
          <IconButton title={translate("DCS_BTN_CLOSE")} onClick={request_close} onDark danger disabled={saving}>
            {CLOSE_SVG}
          </IconButton>
        </div>

        <div className="flex items-end gap-1 px-4 sm:px-5 flex-shrink-0 overflow-x-auto" style={{ borderBottom: `1px solid ${BORDER}` }}>
          {TABS.map((entry) => {
            const active = entry.id === tab;
            const count = tab_count(entry.id);
            return (
              <button
                key={entry.id}
                type="button"
                aria-selected={active}
                role="tab"
                disabled={saving}
                onClick={() => switch_tab(entry.id)}
                className="dcs-builder-tab text-xs font-bold uppercase px-3 py-3 cursor-pointer whitespace-nowrap flex items-center gap-2"
                style={{ color: active ? PRIMARY : TEXT_MUTED, borderBottom: `3px solid ${active ? PRIMARY : "transparent"}`, letterSpacing: "0.6px", ...HEADING_FONT }}
              >
                {translate(entry.labelKey)}
                {count > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5" style={{ backgroundColor: active ? PRIMARY : "#E9EEF2", color: active ? "#FFFFFF" : TEXT_DARK }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-4">
            {tab === "kpi" && (
              <KpiComposer key={`kpi_${composer_key}`} form={form} fields={fields} filterDefs={filter_defs} onAdd={handle_add} disabled={saving} initialSpec={editing ? editing.spec : null} editing={!!editing} onCancelEdit={() => setEditing(null)} />
            )}
            {tab === "charts" && (
              <ChartComposer key={`charts_${composer_key}`} form={form} fields={fields} filterDefs={filter_defs} kind="charts" onAdd={handle_add} disabled={saving} initialSpec={editing ? editing.spec : null} editing={!!editing} onCancelEdit={() => setEditing(null)} />
            )}
            {tab === "diagrams" && (
              <ChartComposer key={`diagrams_${composer_key}`} form={form} fields={fields} filterDefs={filter_defs} kind="diagrams" onAdd={handle_add} disabled={saving} initialSpec={editing ? editing.spec : null} editing={!!editing} onCancelEdit={() => setEditing(null)} />
            )}
            {tab === "map" && (
              <MapComposer key={`map_${composer_key}`} form={form} fields={fields} filterDefs={filter_defs} onAdd={handle_add} disabled={saving} initialSpec={editing ? editing.spec : null} editing={!!editing} onCancelEdit={() => setEditing(null)} />
            )}
            {tab === "table" && (
              <TableComposer key={`table_${composer_key}`} form={form} fields={fields} filterDefs={filter_defs} onAdd={handle_add} disabled={saving} initialSpec={editing ? editing.spec : null} editing={!!editing} onCancelEdit={() => setEditing(null)} />
            )}
            {tab === "text" && (
              <TextComposer key={`text_${composer_key}`} form={form} fields={fields} onAdd={handle_add} disabled={saving} initialSpec={editing ? editing.spec : null} editing={!!editing} onCancelEdit={() => setEditing(null)} />
            )}
            {tab === "filters" && <FiltersTab fields={fields} widgets={(mode === "append" ? existing : []).concat(drafts.flatMap((draft) => draft.widgets))} selected={filter_defs} onChange={setFilterDefs} disabled={saving} />}
          </div>
          <aside className="dcs-builder-aside lg:w-[340px] flex-shrink-0 min-h-0 px-4 sm:px-5 py-4 flex flex-col" style={{ backgroundColor: "#FBFCFD" }}>
            <DraftList drafts={drafts} onRemove={handle_remove} onEdit={handle_edit} editingKey={editing ? editing.key : null} disabled={saving} />
          </aside>
        </div>

        <div className="flex-shrink-0 px-4 sm:px-5 py-3 flex flex-col gap-3" style={{ borderTop: `1px solid ${BORDER}` }}>
          {saving ? (
            <GenerationProgress percent={progress} messageKey="DCS_DB_BUILDER_SAVING" />
          ) : (
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                {existing.length > 0 && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {["append", "replace"].map((option) => (
                      <label key={option} className="inline-flex items-center gap-2 cursor-pointer text-xs" style={{ color: TEXT_DARK, ...HEADING_FONT }}>
                        <span
                          className="flex items-center justify-center flex-shrink-0"
                          style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${mode === option ? PRIMARY : BORDER}` }}
                          onClick={() => setMode(option)}
                        >
                          {mode === option && <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: PRIMARY }} />}
                        </span>
                        <input type="radio" className="sr-only" checked={mode === option} onChange={() => setMode(option)} />
                        {translate(option === "append" ? "DCS_DB_BUILDER_MODE_APPEND" : "DCS_DB_BUILDER_MODE_REPLACE", { count: existing.length })}
                      </label>
                    ))}
                  </div>
                )}
                {over_limit ? (
                  <p className="text-xs font-semibold" style={{ color: "#E74C3C" }}>
                    {room === 0 ? translate("DCS_DB_BUILDER_FULL") : translate("DCS_DB_BUILDER_ROOM", { count: room, limit: MAX_WIDGETS })}
                  </p>
                ) : (
                  onAutoGenerate && (
                    <button type="button" className="text-xs text-left cursor-pointer self-start" style={{ color: PRIMARY, background: "none", border: "none", padding: 0, textDecoration: "underline", ...HEADING_FONT }} onClick={onAutoGenerate}>
                      {translate("DCS_DB_BUILDER_AUTO")}
                    </button>
                  )
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                <DcsButtonOutline className="sm:w-32" onClick={request_close}>
                  {translate("DCS_DB_BUILDER_CANCEL")}
                </DcsButtonOutline>
                <DcsButtonPrimary className="sm:w-56" disabled={!can_save} onClick={handle_save}>
                  {reconfigure ? translate("DCS_DB_BUILDER_UPDATE") : draft_widgets === 0 && filters_changed ? translate("DCS_DB_BUILDER_SAVE_FILTERS") : translate("DCS_DB_BUILDER_SAVE", { count: draft_widgets })}
                </DcsButtonPrimary>
              </div>
            </div>
          )}
        </div>
      </div>

      {confirm_close && (
        <DcsConfirmDialog titleKey="DCS_DB_BUILDER_DISCARD_TITLE" messageKey="DCS_DB_BUILDER_DISCARD_MESSAGE" onCancel={() => setConfirmClose(false)} onConfirm={onClose} />
      )}
    </div>,
    portal_root(),
  );
}
