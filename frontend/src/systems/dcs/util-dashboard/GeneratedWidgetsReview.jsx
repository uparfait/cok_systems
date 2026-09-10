import React, { useMemo, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { save_dashboard } from "./dashboardService.js";
import { chart_definition, classify_fields, field_label_text, SUBMITTED_AT_FIELD } from "./chartCatalog.js";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsConfirmDialog from "../components/DcsConfirmDialog.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";

const TEXT_DARK = "#333333";
const TEXT_MUTED = "#9E9E9E";
const PRIMARY = "#056daa";
const HEADING_FONT = { fontFamily: "'Montserrat', sans-serif" };

/**
 * Every field a widget is built from - the measure's number field, the
 * group and split choice fields and the point-chart axes all count, so
 * "delete all widgets that include this field" catches a field wherever it
 * appears in a widget.
 */
function widget_field_ids(widget) {
  const ids = [];
  const push = (field_id) => {
    if (field_id && !ids.includes(field_id)) ids.push(field_id);
  };
  push(widget.metric && widget.metric.field_id);
  push(widget.group_by && widget.group_by.field_id);
  push(widget.split_by && widget.split_by.field_id);
  push(widget.x_field_id);
  push(widget.y_field_id);
  push(widget.size_field_id);
  return ids;
}

function reindex_positions(widget_list) {
  return widget_list.map((widget, index) => ({ ...widget, position: index }));
}

/**
 * The review step shown right after a basic dashboard is generated: every
 * generated widget is listed WITHOUT loading any data (title, description
 * and chart type only, in one scrollable list) so the user can delete the
 * ones they do not want - one by one, or every widget that includes a given
 * field at once - and adjust titles and descriptions before opening the
 * full basic dashboard, which is where the data actually loads. With
 * focusIds only those widgets are listed (a manual KPI's fresh card and
 * breakdowns) while every save still persists the WHOLE board around them.
 */
export default function GeneratedWidgetsReview({ form, initialWidgets, focusIds, onOpenDashboard, onClose, onCountChange, onWidgetsChange }) {
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();

  const [widgets, setWidgets] = useState(initialWidgets || []);
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [focus_ids] = useState(() => (focusIds && focusIds.length > 0 ? new Set(focusIds) : null));
  const in_focus = (widget) => !focus_ids || focus_ids.has(widget.id);
  const visible = widgets.filter(in_focus);

  const field_labels = useMemo(() => {
    const labels = new Map();
    classify_fields(form.schema).all.forEach((field) => labels.set(field.id, field_label_text(field)));
    labels.set(SUBMITTED_AT_FIELD, translate("DCS_DB_SUBMITTED_AT"));
    return labels;
  }, [form.schema, translate]);

  const label_of = (field_id) => field_labels.get(field_id) || field_id;

  const field_usage = useMemo(() => {
    const usage = new Map();
    widgets.forEach((widget) => {
      if (!in_focus(widget)) return;
      widget_field_ids(widget).forEach((field_id) => usage.set(field_id, (usage.get(field_id) || 0) + 1));
    });
    return [...usage.entries()].sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgets]);

  const persist = async (next_widgets, toast_message) => {
    setSaving(true);
    try {
      const positioned = reindex_positions(next_widgets);
      const saved = await save_dashboard(form.form_group_id, positioned);
      const final_widgets = (saved.data && saved.data.widgets) || positioned;
      setWidgets(final_widgets);
      if (onCountChange) onCountChange(final_widgets.length);
      if (onWidgetsChange) onWidgetsChange(final_widgets);
      if (toast_message) showSuccess(toast_message);
      return true;
    } catch (error) {
      showError((error.response && error.response.data && error.response.data.message) || translate("DCS_ERROR_GENERIC"));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const draft_of = (widget) => drafts[widget.id] || { title: widget.title || "", description: widget.description || "" };
  const is_dirty = (widget) => {
    const draft = drafts[widget.id];
    return Boolean(draft) && (draft.title !== (widget.title || "") || draft.description !== (widget.description || ""));
  };
  const set_draft = (widget, patch) => setDrafts((current) => ({ ...current, [widget.id]: { ...draft_of(widget), ...patch } }));
  const clear_draft = (widget_id) =>
    setDrafts((current) => {
      const next = { ...current };
      delete next[widget_id];
      return next;
    });

  const handle_save_row = async (widget) => {
    const draft = draft_of(widget);
    const title = draft.title.trim();
    if (!title) {
      showError(translate("DCS_DB_REVIEW_TITLE_REQUIRED"));
      return;
    }
    const next = widgets.map((entry) =>
      entry.id === widget.id ? { ...entry, title, description: draft.description.trim() } : entry,
    );
    const ok = await persist(next, translate("DCS_DB_WIDGET_UPDATED"));
    if (ok) clear_draft(widget.id);
  };

  const handle_confirmed = async () => {
    if (!confirm) return;
    if (confirm.kind === "widget") {
      const next = widgets.filter((entry) => entry.id !== confirm.widget_id);
      const ok = await persist(next, translate("DCS_DB_WIDGET_REMOVED"));
      if (ok) {
        clear_draft(confirm.widget_id);
        setConfirm(null);
      }
      return;
    }
    // Only the widgets under review are swept - in a focused review (a
    // fresh manual KPI) the rest of the board is never touched.
    const matches = (entry) => in_focus(entry) && widget_field_ids(entry).includes(confirm.field_id);
    const removed = widgets.filter(matches);
    const next = widgets.filter((entry) => !matches(entry));
    const ok = await persist(next, translate("DCS_DB_REVIEW_FIELD_REMOVED_TOAST", { count: removed.length }));
    if (ok) {
      removed.forEach((entry) => clear_draft(entry.id));
      setConfirm(null);
    }
  };

  const chart_label = (widget) => {
    const definition = chart_definition(widget.chart_type);
    return definition ? translate(definition.labelKey) : widget.chart_type;
  };

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
        <p className="text-sm font-semibold" style={{ color: TEXT_DARK, ...HEADING_FONT }}>
          {translate("DCS_DB_REVIEW_TITLE")}
        </p>
        <p className="text-xs font-semibold" style={{ color: PRIMARY, ...HEADING_FONT }}>
          {translate("DCS_DB_FORM_WIDGET_COUNT", { count: visible.length })}
        </p>
      </div>
      <p className="text-xs mb-3" style={{ color: TEXT_MUTED }}>
        {translate("DCS_DB_REVIEW_HINT")}
      </p>

      <div className="flex flex-col sm:flex-row flex-wrap gap-2 mb-4">
        {widgets.length > 0 && (
          <div className="w-full sm:w-64">
            <DcsButtonPrimary type="button" disabled={saving} onClick={onOpenDashboard}>
              {translate("DCS_DB_REVIEW_OPEN_FULL")}
            </DcsButtonPrimary>
          </div>
        )}
        <div className="w-full sm:w-40">
          <DcsButtonOutline type="button" disabled={saving} onClick={onClose}>
            {translate("DCS_DB_REVIEW_CLOSE")}
          </DcsButtonOutline>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-xs py-2" style={{ color: TEXT_MUTED }}>
          {translate(focus_ids ? "DCS_DB_REVIEW_FOCUS_EMPTY" : "DCS_DB_REVIEW_ALL_REMOVED")}
        </p>
      ) : (
        <>
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: TEXT_MUTED, ...HEADING_FONT }}>
              {translate("DCS_DB_REVIEW_FIELDS_TITLE")}
            </p>
            <p className="text-xs mb-2" style={{ color: TEXT_MUTED }}>
              {translate("DCS_DB_REVIEW_FIELDS_HINT")}
            </p>
            <div className="flex flex-wrap gap-2">
              {field_usage.map(([field_id, count]) => (
                <div
                  key={field_id}
                  className="flex items-center gap-2 border px-2 py-1"
                  style={{ borderColor: "#E0E0E0", backgroundColor: "#FFFFFF" }}
                >
                  <span className="text-xs" style={{ color: TEXT_DARK }}>
                    {label_of(field_id)}
                  </span>
                  <button
                    type="button"
                    className="text-xs font-semibold cursor-pointer"
                    style={{ color: "#E74C3C", ...HEADING_FONT, background: "none", border: "none", padding: 0 }}
                    disabled={saving}
                    onClick={() => setConfirm({ kind: "field", field_id })}
                  >
                    {translate("DCS_DB_REVIEW_DELETE_ALL", { count })}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-y-auto pr-1 flex flex-col gap-3" style={{ maxHeight: "65vh" }}>
            {visible.map((widget) => {
              const draft = draft_of(widget);
              const dirty = is_dirty(widget);
              const used_fields = widget_field_ids(widget);
              return (
                <div key={widget.id} className="border p-3" style={{ borderColor: "#E0E0E0", backgroundColor: "#FFFFFF" }}>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span
                      className="text-xs font-semibold px-2 py-0.5"
                      style={{ color: PRIMARY, backgroundColor: "#EAF3F8", ...HEADING_FONT }}
                    >
                      {chart_label(widget)}
                    </span>
                    <button
                      type="button"
                      className="text-xs font-semibold cursor-pointer"
                      style={{ color: "#E74C3C", ...HEADING_FONT, background: "none", border: "none", padding: 0 }}
                      disabled={saving}
                      onClick={() => setConfirm({ kind: "widget", widget_id: widget.id })}
                    >
                      {translate("DCS_DB_REMOVE_WIDGET")}
                    </button>
                  </div>

                  <label className="block text-xs mb-1" style={{ color: TEXT_MUTED }}>
                    {translate("DCS_DB_WIDGET_TITLE")}
                  </label>
                  <input
                    className="cok-auth-input w-full py-2 mb-2"
                    value={draft.title}
                    maxLength={120}
                    disabled={saving}
                    onChange={(event) => set_draft(widget, { title: event.target.value })}
                  />

                  <label className="block text-xs mb-1" style={{ color: TEXT_MUTED }}>
                    {translate("DCS_DB_REVIEW_DESCRIPTION")}
                  </label>
                  <textarea
                    className="cok-auth-input w-full py-2"
                    rows={2}
                    maxLength={300}
                    placeholder={translate("DCS_DB_REVIEW_DESC_PLACEHOLDER")}
                    value={draft.description}
                    disabled={saving}
                    onChange={(event) => set_draft(widget, { description: event.target.value })}
                  />

                  {used_fields.length > 0 && (
                    <p className="text-xs mt-2" style={{ color: TEXT_MUTED }}>
                      {translate("DCS_DB_REVIEW_ROW_FIELDS", { labels: used_fields.map(label_of).join(", ") })}
                    </p>
                  )}

                  {dirty && (
                    <div className="flex gap-2 mt-2">
                      {saving ? (
                        <SpiralLoader />
                      ) : (
                        <>
                          <div className="w-36">
                            <DcsButtonPrimary type="button" onClick={() => handle_save_row(widget)}>
                              {translate("DCS_DB_REVIEW_SAVE_ROW")}
                            </DcsButtonPrimary>
                          </div>
                          <div className="w-28">
                            <DcsButtonOutline type="button" onClick={() => clear_draft(widget.id)}>
                              {translate("DCS_DB_REVIEW_CANCEL_ROW")}
                            </DcsButtonOutline>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {confirm && (
        <DcsConfirmDialog
          titleKey={confirm.kind === "widget" ? "DCS_DB_REMOVE_TITLE" : "DCS_DB_REVIEW_DEL_FIELD_TITLE"}
          messageKey={confirm.kind === "widget" ? "DCS_DB_REMOVE_MESSAGE" : "DCS_DB_REVIEW_DEL_FIELD_MESSAGE"}
          confirming={saving}
          onCancel={() => setConfirm(null)}
          onConfirm={handle_confirmed}
        />
      )}
    </div>
  );
}
