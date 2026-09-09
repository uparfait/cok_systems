import React, { useEffect, useRef, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { get_dashboard, save_dashboard, get_dashboard_data } from "./dashboardService.js";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsConfirmDialog from "../components/DcsConfirmDialog.jsx";
import DcsLoadingState from "../components/DcsLoadingState.jsx";
import DcsPeriodFilter from "../components/DcsPeriodFilter.jsx";
import WidgetCard from "./WidgetCard.jsx";
import WidgetWizard from "./WidgetWizard.jsx";
import { next_size } from "./widgetModel.js";

const REFRESH_INTERVAL_MS = 30000;

// Static class strings so Tailwind keeps them; mobile is always one column.
const SIZE_CLASSES = {
  small: "sm:col-span-1",
  medium: "sm:col-span-2",
  large: "sm:col-span-2 xl:col-span-3",
  full: "sm:col-span-2 xl:col-span-4",
};

/**
 * The FORM's dashboard tab: renders the saved widgets with live data
 * (silently refreshed every 30 seconds), a dashboard-wide period override,
 * and - for users allowed to edit this form - a full builder: add via the
 * step wizard, edit, remove, reorder and resize, then save everything as
 * one configuration. Every form owns exactly one dashboard of its own.
 */
export default function DashboardPage({ form }) {
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [can_edit, setCanEdit] = useState(false);
  const [widgets, setWidgets] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [edit_mode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [wizard, setWizard] = useState(null);
  const [widget_to_remove, setWidgetToRemove] = useState(null);

  const [data_by_widget, setDataByWidget] = useState({});
  const [data_loading, setDataLoading] = useState(false);
  const [period, setPeriod] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const run_seq_ref = useRef(0);
  const applied_period_ref = useRef(null);
  const widgets_ref = useRef([]);
  widgets_ref.current = widgets;

  useEffect(() => {
    let is_mounted = true;
    setLoading(true);
    get_dashboard(form.form_group_id)
      .then((dashboard_response) => {
        if (!is_mounted) return;
        setWidgets((dashboard_response.data && dashboard_response.data.widgets) || []);
        setCanEdit((dashboard_response.data && dashboard_response.data.can_edit) === true);
        setDirty(false);
      })
      .catch((error) => is_mounted && showError(error.message || translate("DCS_ERROR_GENERIC")))
      .finally(() => is_mounted && setLoading(false));
    return () => {
      is_mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.form_group_id]);

  const fetch_data = (widget_list, applied_period, silent) => {
    if (!widget_list || widget_list.length === 0) {
      setDataByWidget({});
      return;
    }
    const run_id = run_seq_ref.current + 1;
    run_seq_ref.current = run_id;
    applied_period_ref.current = applied_period;
    if (!silent) setDataLoading(true);
    get_dashboard_data(form.form_group_id, widget_list, applied_period)
      .then((response) => {
        if (run_seq_ref.current !== run_id) return;
        const map = {};
        ((response.data && response.data.results) || []).forEach((result) => {
          map[result.widget_id] = result;
        });
        setDataByWidget(map);
      })
      .catch((error) => {
        if (run_seq_ref.current !== run_id || silent) return;
        showError(error.message || translate("DCS_ERROR_GENERIC"));
      })
      .finally(() => {
        if (run_seq_ref.current === run_id && !silent) setDataLoading(false);
      });
  };

  useEffect(() => {
    if (!loading) fetch_data(widgets, applied_period_ref.current, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, widgets]);

  useEffect(() => {
    const interval_id = window.setInterval(() => {
      fetch_data(widgets_ref.current, applied_period_ref.current, true);
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.form_group_id]);

  // The custom popup hands the picked dates directly - state updates are
  // asynchronous, so reading from/to here would apply the PREVIOUS range.
  const handle_period_apply = (applied_from, applied_to) => {
    const next_from = typeof applied_from === "string" ? applied_from : from;
    const next_to = typeof applied_to === "string" ? applied_to : to;
    if (period === "custom" && !next_from) return;
    const applied = period === "all" ? null : { preset: period, from: next_from || null, to: next_to || null };
    fetch_data(widgets, applied, false);
  };

  useEffect(() => {
    if (loading) return;
    if (period !== "custom") {
      setFrom("");
      setTo("");
      const applied = period === "all" ? null : { preset: period, from: null, to: null };
      fetch_data(widgets, applied, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const mutate_widgets = (next_widgets) => {
    setWidgets(next_widgets.map((widget, index) => ({ ...widget, position: index })));
    setDirty(true);
  };

  const move_widget = (index, direction) => {
    const next = widgets.slice();
    const swap = index + direction;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    mutate_widgets(next);
  };

  const handle_wizard_done = (widget) => {
    const exists = widgets.some((entry) => entry.id === widget.id);
    mutate_widgets(exists ? widgets.map((entry) => (entry.id === widget.id ? widget : entry)) : widgets.concat([widget]));
    setWizard(null);
  };

  const handle_save = async () => {
    setSaving(true);
    try {
      const response = await save_dashboard(form.form_group_id, widgets);
      setWidgets((response.data && response.data.widgets) || widgets);
      setDirty(false);
      showSuccess(translate("DCS_DB_SAVED_TOAST"));
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <DcsLoadingState />;

  return (
    <div className="pb-16 space-y-4">
      <div className="bg-white border-2 p-3 sm:p-4 flex flex-col gap-3" style={{ borderColor: "#E0E0E0" }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 18, color: "#333333" }}>
              {translate("DCS_DB_TITLE")}
            </h2>
            {dirty && (
              <p className="text-xs" style={{ color: "#F2994A" }}>
                {translate("DCS_DB_UNSAVED")}
              </p>
            )}
          </div>
          {can_edit && (
            <div className="flex flex-wrap gap-2">
              {edit_mode && (
                <div className="w-40">
                  <DcsButtonOutline type="button" onClick={() => setWizard({ widget: null })}>
                    {translate("DCS_DB_ADD_WIDGET")}
                  </DcsButtonOutline>
                </div>
              )}
              <div className="w-44">
                {edit_mode ? (
                  <DcsButtonPrimary type="button" onClick={handle_save} disabled={saving || !dirty}>
                    {saving ? translate("DCS_DB_SAVING") : translate("DCS_DB_SAVE")}
                  </DcsButtonPrimary>
                ) : (
                  <DcsButtonPrimary type="button" onClick={() => setEditMode(true)}>
                    {translate("DCS_DB_EDIT_MODE")}
                  </DcsButtonPrimary>
                )}
              </div>
              {edit_mode && (
                <div className="w-32">
                  <DcsButtonOutline type="button" onClick={() => setEditMode(false)}>
                    {translate("DCS_DB_DONE")}
                  </DcsButtonOutline>
                </div>
              )}
            </div>
          )}
        </div>
        {widgets.length > 0 && (
          <DcsPeriodFilter
            period={period}
            onPeriodChange={setPeriod}
            from={from}
            onFromChange={setFrom}
            to={to}
            onToChange={setTo}
            onApply={handle_period_apply}
            allowWrap
          />
        )}
      </div>

      {widgets.length === 0 ? (
        <div className="bg-white border-2 p-8 text-center" style={{ borderColor: "#E0E0E0" }}>
          <p className="text-sm font-semibold mb-1" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
            {translate("DCS_DB_EMPTY_TITLE")}
          </p>
          <p className="text-xs mb-4" style={{ color: "#9E9E9E" }}>
            {translate(can_edit ? "DCS_DB_EMPTY_HINT" : "DCS_DB_EMPTY_HINT_VIEWER")}
          </p>
          {can_edit && (
            <div className="w-full sm:w-56 mx-auto">
              <DcsButtonPrimary type="button" onClick={() => { setEditMode(true); setWizard({ widget: null }); }}>
                {translate("DCS_DB_ADD_WIDGET")}
              </DcsButtonPrimary>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {widgets.map((widget, index) => (
            <div key={widget.id} className={SIZE_CLASSES[widget.size] || SIZE_CLASSES.medium}>
              <WidgetCard
                widget={widget}
                data={data_by_widget[widget.id]}
                loading={data_loading && !data_by_widget[widget.id]}
                editMode={edit_mode && can_edit}
                canMoveUp={index > 0}
                canMoveDown={index < widgets.length - 1}
                onMoveUp={() => move_widget(index, -1)}
                onMoveDown={() => move_widget(index, 1)}
                onResize={() => mutate_widgets(widgets.map((entry) => (entry.id === widget.id ? { ...entry, size: next_size(entry.size) } : entry)))}
                onEdit={() => setWizard({ widget })}
                onRemove={() => setWidgetToRemove(widget)}
                onRetry={() => fetch_data(widgets, applied_period_ref.current, false)}
              />
            </div>
          ))}
        </div>
      )}

      {wizard && (
        <WidgetWizard
          form={form}
          initialWidget={wizard.widget}
          onClose={() => setWizard(null)}
          onDone={handle_wizard_done}
        />
      )}

      {widget_to_remove && (
        <DcsConfirmDialog
          titleKey="DCS_DB_REMOVE_TITLE"
          messageKey="DCS_DB_REMOVE_MESSAGE"
          onConfirm={() => {
            mutate_widgets(widgets.filter((entry) => entry.id !== widget_to_remove.id));
            setWidgetToRemove(null);
          }}
          onCancel={() => setWidgetToRemove(null)}
        />
      )}
    </div>
  );
}
