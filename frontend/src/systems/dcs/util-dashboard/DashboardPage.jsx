import React, { useEffect, useRef, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { get_dashboard, save_dashboard, get_dashboard_data } from "./dashboardService.js";
import { generate_and_save } from "./autoGenerate.js";
import GenerationProgress from "./GenerationProgress.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsConfirmDialog from "../components/DcsConfirmDialog.jsx";
import DcsLoadingState from "../components/DcsLoadingState.jsx";
import DcsPeriodFilter from "../components/DcsPeriodFilter.jsx";
import WidgetCard from "./WidgetCard.jsx";

const REFRESH_INTERVAL_MS = 30000;
const DANGER = "#E74C3C";

// Static class strings so Tailwind keeps them; mobile is always one column.
const SIZE_CLASSES = {
  small: "sm:col-span-1",
  medium: "sm:col-span-2",
  large: "sm:col-span-2 xl:col-span-3",
  full: "sm:col-span-2 xl:col-span-4",
};

/**
 * The form's dashboard, fully automatic: every widget was generated from
 * the form's own fields, so there is nothing to configure - the page only
 * views (live data, silently refreshed every 30 seconds, with a
 * dashboard-wide period filter). Users allowed to edit the form can
 * regenerate the whole dashboard (with visible progress) or delete it.
 */
export default function DashboardPage({ form }) {
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [can_edit, setCanEdit] = useState(false);
  const [widgets, setWidgets] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, message_key: "" });
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(null);

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
      .then((response) => {
        if (!is_mounted) return;
        setWidgets((response.data && response.data.widgets) || []);
        setCanEdit((response.data && response.data.can_edit) === true);
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

  const handle_generate = async () => {
    setConfirming(null);
    setGenerating(true);
    setProgress({ percent: 5, message_key: "DCS_DB_GEN_PROGRESS_ANALYZE" });
    try {
      const saved_widgets = await generate_and_save(form, translate, (percent, message_key) =>
        setProgress({ percent, message_key }),
      );
      setWidgets(saved_widgets);
      showSuccess(translate("DCS_DB_GENERATED_TOAST", { count: saved_widgets.length }));
    } catch (error) {
      showError(error.is_translation_key ? translate(error.message) : error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setGenerating(false);
    }
  };

  const handle_delete = async () => {
    setDeleting(true);
    try {
      await save_dashboard(form.form_group_id, []);
      setWidgets([]);
      setDataByWidget({});
      showSuccess(translate("DCS_DB_DELETED_TOAST"));
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setDeleting(false);
      setConfirming(null);
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
            <p className="text-xs" style={{ color: "#9E9E9E" }}>
              {translate("DCS_DB_AUTO_HINT")}
            </p>
          </div>
          {can_edit && widgets.length > 0 && !generating && (
            <div className="flex flex-wrap gap-2">
              <div className="w-44">
                <DcsButtonOutline type="button" disabled={deleting} onClick={() => setConfirming("generate")}>
                  {translate("DCS_DB_REGENERATE")}
                </DcsButtonOutline>
              </div>
              <div className="w-44">
                <DcsButtonOutline type="button" variant="danger" disabled={deleting} onClick={() => setConfirming("delete")} style={{ color: DANGER }}>
                  {deleting ? translate("DCS_DB_WORKING") : translate("DCS_DB_BTN_DELETE")}
                </DcsButtonOutline>
              </div>
            </div>
          )}
        </div>
        {generating && <GenerationProgress percent={progress.percent} messageKey={progress.message_key} />}
        {widgets.length > 0 && !generating && (
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

      {widgets.length === 0 && !generating ? (
        <div className="bg-white border-2 p-8 text-center" style={{ borderColor: "#E0E0E0" }}>
          <p className="text-sm font-semibold mb-1" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
            {translate("DCS_DB_EMPTY_TITLE")}
          </p>
          <p className="text-xs mb-4" style={{ color: "#9E9E9E" }}>
            {translate(can_edit ? "DCS_DB_EMPTY_HINT" : "DCS_DB_EMPTY_HINT_VIEWER")}
          </p>
          {can_edit && (
            <div className="w-full sm:w-56 mx-auto">
              <DcsButtonPrimary type="button" onClick={handle_generate}>
                {translate("DCS_DB_BTN_GENERATE")}
              </DcsButtonPrimary>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {widgets.map((widget) => (
            <div key={widget.id} className={SIZE_CLASSES[widget.size] || SIZE_CLASSES.medium}>
              <WidgetCard
                widget={widget}
                data={data_by_widget[widget.id]}
                loading={data_loading && !data_by_widget[widget.id]}
                onRetry={() => fetch_data(widgets, applied_period_ref.current, false)}
              />
            </div>
          ))}
        </div>
      )}

      {confirming === "generate" && (
        <DcsConfirmDialog
          titleKey="DCS_DB_GEN_CONFIRM_TITLE"
          messageKey="DCS_DB_GEN_CONFIRM_MESSAGE"
          onConfirm={handle_generate}
          onCancel={() => setConfirming(null)}
        />
      )}
      {confirming === "delete" && (
        <DcsConfirmDialog
          titleKey="DCS_DB_DEL_CONFIRM_TITLE"
          messageKey="DCS_DB_DEL_CONFIRM_MESSAGE"
          confirming={deleting}
          onConfirm={handle_delete}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  );
}
