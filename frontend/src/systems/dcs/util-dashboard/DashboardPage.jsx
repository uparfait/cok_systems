import React, { useEffect, useRef, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { get_dashboard, save_dashboard, get_dashboard_data } from "./dashboardService.js";
import { regenerate_and_save } from "./autoGenerate.js";
import { useBoardFullscreen } from "./useBoardFullscreen.js";
import { fold_family, widgets_data_signature } from "./chartCatalog.js";
import BoardHeader from "./BoardHeader.jsx";
import RegenerateDialog from "./RegenerateDialog.jsx";
import GeneratedWidgetsReview from "./GeneratedWidgetsReview.jsx";
import AddKpiDialog from "./AddKpiDialog.jsx";
import SkippedDetailsModal from "./SkippedDetailsModal.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsConfirmDialog from "../components/DcsConfirmDialog.jsx";
import DcsLoadingState from "../components/DcsLoadingState.jsx";
import WidgetCard from "./WidgetCard.jsx";

const REFRESH_INTERVAL_MS = 30000;

// Flexible auto-grow grid: every card carries a size-based flex-basis, and
// `grow` lets the items of an incomplete last row stretch over the leftover
// width instead of leaving an empty gap. NO widget may claim a full row of
// its own - every base width is at most half the board, so something can
// always sit next to it; a widget only ever spans the full width when
// nothing else shares its row (the odd one out, or a one-widget board).
// Static class strings so Tailwind keeps them; mobile is one column.
const HALF_ROW = "grow basis-full sm:basis-[calc(50%-0.75rem)]";
const SIZE_CLASSES = {
  small: `${HALF_ROW} xl:basis-[calc(25%-0.75rem)]`,
  medium: HALF_ROW,
  large: HALF_ROW,
  full: HALF_ROW,
};

// CSS zoom reflows the layout and keeps text crisp at the target size -
// transform scaling only shrinks pixels, which reads blurry. Zoom is used
// whenever the browser supports it; transform stays as the fallback.
const SUPPORTS_ZOOM = typeof CSS !== "undefined" && CSS.supports && CSS.supports("zoom", "2");

/**
 * The form's dashboard, fully automatic: every widget was generated from
 * the form's own fields, so there is nothing to configure - the page only
 * views (live data, silently refreshed every 30 seconds, with a
 * dashboard-wide period filter). Users allowed to edit the form can
 * regenerate the dashboard - choosing between "generate and update" (only
 * widgets that do not exist yet are added, everything kept stays untouched)
 * and "overwrite" (a fresh board replaces the current one) - or delete it.
 * A regeneration NEVER shows data right away: the result opens in the
 * review list where widgets can be deleted (one by one, or every widget of
 * a field at once) and retitled first, and while that review is open NO
 * widget fetches or refreshes anything - fetching resumes only once the
 * review is finished or canceled.
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
  const [regen_dialog, setRegenDialog] = useState(false);
  // While review_widgets is set the board is FROZEN behind the review list:
  // the grid is not rendered and no widget may fetch or refresh data.
  // review_focus narrows the review to just-added widgets (a manual KPI's
  // card and breakdowns); null reviews the whole board.
  const [review_widgets, setReviewWidgets] = useState(null);
  const [review_focus, setReviewFocus] = useState(null);
  const [kpi_dialog, setKpiDialog] = useState(false);
  const [skipped_widget, setSkippedWidget] = useState(null);

  const [data_by_widget, setDataByWidget] = useState({});
  const [data_loading, setDataLoading] = useState(false);
  // The dashboard opens on the current year by default - "all" stays one
  // click away in the period filter.
  const [period, setPeriod] = useState("this_year");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const run_seq_ref = useRef(0);
  const applied_period_ref = useRef({ preset: "this_year", from: null, to: null });
  const widgets_ref = useRef([]);
  widgets_ref.current = widgets;
  const frozen_ref = useRef(false);
  frozen_ref.current = generating || review_widgets !== null;

  // Browser-native full screen with two viewing modes ("fit" zooms the whole
  // board onto one screen, "scroll" keeps natural size), the self-fitting
  // zoom and the hover-driven fixed header all live in the hook.
  const {
    container_ref,
    grid_ref,
    is_fullscreen,
    is_fallback,
    enter,
    exit,
    fs_mode,
    setFsMode,
    fit_scale,
    header_visible,
    show_header,
    schedule_header_hide,
  } = useBoardFullscreen();

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

  // Every widget fetches IN PARALLEL - one request per widget, all fired at
  // once, each card rendering the moment its own data lands. One widget's
  // failure never blocks any other, and a request that drags past three
  // minutes is cut off and its card marked red - such a widget likely causes
  // errors or heavy computation and should be removed.
  const WIDGET_TIMEOUT_MS = 180000;
  const data_ref = useRef({});
  data_ref.current = data_by_widget;

  const fetch_one = (widget, applied_period, run_id, silent) =>
    Promise.race([
      get_dashboard_data(form.form_group_id, [widget], applied_period),
      new Promise((resolve, reject) => setTimeout(() => reject(new Error("TIMEOUT")), WIDGET_TIMEOUT_MS)),
    ])
      .then((response) => {
        if (run_seq_ref.current !== run_id) return;
        const result = ((response.data && response.data.results) || [])[0];
        if (result) setDataByWidget((current) => ({ ...current, [widget.id]: result }));
      })
      .catch((error) => {
        if (run_seq_ref.current !== run_id) return;
        // A silent refresh keeps whatever the card already shows; a
        // user-driven load marks just this card, never the others.
        if (!silent) {
          const code = error && error.message === "TIMEOUT" ? "TIMEOUT" : "FAILED";
          setDataByWidget((current) => ({ ...current, [widget.id]: { widget_id: widget.id, error: code } }));
        }
      });

  const fetch_data = (widget_list, applied_period, silent) => {
    if (!widget_list || widget_list.length === 0) {
      setDataByWidget({});
      return;
    }
    // A silent update only ever starts once EVERY widget already has its
    // data - while the first load is still filling the board, it skips.
    if (silent && widget_list.some((widget) => !data_ref.current[widget.id])) return;
    const run_id = run_seq_ref.current + 1;
    run_seq_ref.current = run_id;
    applied_period_ref.current = applied_period;
    if (!silent) {
      setDataByWidget({});
      setDataLoading(true);
    }
    Promise.allSettled(widget_list.map((widget) => fetch_one(widget, applied_period, run_id, silent))).then(() => {
      if (run_seq_ref.current === run_id && !silent) setDataLoading(false);
    });
  };

  // Retrying one failed card refetches ONLY that card - never the whole
  // board. The result is dropped if a newer full run started meanwhile.
  const retry_widget = (widget) => {
    const run_id = run_seq_ref.current;
    setDataByWidget((current) => {
      const next = { ...current };
      delete next[widget.id];
      return next;
    });
    fetch_one(widget, applied_period_ref.current, run_id, false);
  };

  // Text edits (title/description) also update the widgets state - only a
  // change to what a widget actually CHARTS refetches its data. Removing a
  // widget updates the signature by hand so the survivors never refetch,
  // and same-family look flips (see fold_family) never refetch at all.
  // While the post-regeneration review is open NOTHING fetches: the effect
  // re-runs the moment the review closes and only then compares signatures,
  // so the regenerated board loads exactly once, after the user is done.
  const data_signature_ref = useRef("");
  useEffect(() => {
    if (loading || review_widgets !== null) return;
    const signature = widgets_data_signature(widgets);
    if (signature === data_signature_ref.current) return;
    data_signature_ref.current = signature;
    fetch_data(widgets, applied_period_ref.current, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, widgets, review_widgets]);

  // The generated board is deliberately large (every field categorized by
  // every other) - each card can be removed on its own, after a warning.
  const [widget_to_remove, setWidgetToRemove] = useState(null);
  const [removing, setRemoving] = useState(false);
  const handle_remove_widget = async () => {
    const target = widget_to_remove;
    if (!target) return;
    const next_widgets = widgets
      .filter((widget) => widget.id !== target.id)
      .map((widget, index) => ({ ...widget, position: index }));
    setRemoving(true);
    try {
      const saved = await save_dashboard(form.form_group_id, next_widgets);
      const final_widgets = (saved.data && saved.data.widgets) || next_widgets;
      data_signature_ref.current = widgets_data_signature(final_widgets);
      setWidgets(final_widgets);
      setDataByWidget((current) => {
        const next = { ...current };
        delete next[target.id];
        return next;
      });
      showSuccess(translate("DCS_DB_WIDGET_REMOVED"));
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setRemoving(false);
      setWidgetToRemove(null);
    }
  };

  // Click-to-edit on a card's title/description: the change is saved into
  // the form's dashboard right away, with a per-card spinner and a toast.
  const [saving_widget_id, setSavingWidgetId] = useState(null);
  const handle_update_widget = async (widget_id, changes) => {
    const previous = widgets.find((widget) => widget.id === widget_id);
    const next_widgets = widgets.map((widget) => (widget.id === widget_id ? { ...widget, ...changes } : widget));
    setSavingWidgetId(widget_id);
    try {
      const saved = await save_dashboard(form.form_group_id, next_widgets);
      const final_widgets = (saved.data && saved.data.widgets) || next_widgets;
      // The signature is settled by hand so the board never refetches as a
      // whole; only a switch that changes the data's folding family (donut
      // to bar, for example) refreshes THAT one card.
      data_signature_ref.current = widgets_data_signature(final_widgets);
      setWidgets(final_widgets);
      if (changes.chart_type && previous && fold_family(changes.chart_type) !== fold_family(previous.chart_type)) {
        const updated = final_widgets.find((widget) => widget.id === widget_id);
        if (updated) retry_widget(updated);
      }
      showSuccess(translate("DCS_DB_WIDGET_UPDATED"));
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setSavingWidgetId(null);
    }
  };

  useEffect(() => {
    const interval_id = window.setInterval(() => {
      // A regeneration in progress or under review freezes the board - the
      // silent refresh sits out until the review is finished or canceled.
      if (frozen_ref.current) return;
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
    if (loading || frozen_ref.current) return;
    if (period !== "custom") {
      setFrom("");
      setTo("");
      const applied = period === "all" ? null : { preset: period, from: null, to: null };
      fetch_data(widgets, applied, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  // "update" adds only the widgets that do not exist yet; "overwrite"
  // replaces the whole board. Either way the fresh board opens in the
  // review list (no data loads there) instead of fetching right away.
  const handle_generate = async (mode) => {
    setRegenDialog(false);
    setGenerating(true);
    setProgress({ percent: 5, message_key: "DCS_DB_GEN_PROGRESS_ANALYZE" });
    try {
      const result = await regenerate_and_save(form, translate, mode, widgets, (percent, message_key) =>
        setProgress({ percent, message_key }),
      );
      setWidgets(result.widgets);
      setReviewFocus(null);
      setReviewWidgets(result.widgets);
      if (mode === "update") {
        showSuccess(
          result.added > 0
            ? translate("DCS_DB_REGEN_UPDATED_TOAST", { count: result.added })
            : translate("DCS_DB_REGEN_NO_NEW_TOAST"),
        );
      } else {
        showSuccess(translate("DCS_DB_GENERATED_TOAST", { count: result.widgets.length }));
      }
    } catch (error) {
      showError(error.is_translation_key ? translate(error.message) : error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setGenerating(false);
    }
  };

  // Finishing or canceling the review unfreezes the board: the signature
  // effect runs again and fetches the (possibly pruned) widgets in parallel.
  const close_review = () => {
    setReviewWidgets(null);
    setReviewFocus(null);
  };

  // A manual KPI was saved (card plus automatic breakdowns): the review
  // opens focused on just those new widgets, freezing the board meanwhile.
  const handle_kpi_added = (final_widgets, new_ids) => {
    setKpiDialog(false);
    setWidgets(final_widgets);
    setReviewFocus(new_ids);
    setReviewWidgets(final_widgets);
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
    <div
      ref={container_ref}
      className={`relative ${is_fullscreen ? (is_fallback ? "fixed inset-0 z-[10000] " : "") + "p-2 sm:p-4" : "pb-16 space-y-4"}`}
      style={
        is_fullscreen
          ? { backgroundColor: "#F4F7F9", width: "100%", height: "100%", overflowY: fs_mode === "fit" ? "hidden" : "auto" }
          : undefined
      }
    >
      <BoardHeader
        form={form}
        widgets_count={widgets.length}
        can_edit={can_edit}
        generating={generating}
        reviewing={review_widgets !== null}
        deleting={deleting}
        progress={progress}
        is_fullscreen={is_fullscreen}
        fs_mode={fs_mode}
        setFsMode={setFsMode}
        enter={enter}
        exit={exit}
        header_visible={header_visible}
        show_header={show_header}
        schedule_header_hide={schedule_header_hide}
        period={period}
        setPeriod={setPeriod}
        from={from}
        setFrom={setFrom}
        to={to}
        setTo={setTo}
        onApplyPeriod={handle_period_apply}
        onAddKpi={() => setKpiDialog(true)}
        onRegenerate={() => setRegenDialog(true)}
        onDelete={() => setConfirming("delete")}
      />

      {review_widgets !== null ? (
        <div className="bg-white border-2 p-4 sm:p-5" style={{ borderColor: "#E0E0E0" }}>
          <GeneratedWidgetsReview
            form={form}
            initialWidgets={review_widgets}
            focusIds={review_focus}
            onOpenDashboard={close_review}
            onClose={close_review}
            onWidgetsChange={setWidgets}
          />
        </div>
      ) : widgets.length === 0 && !generating ? (
        <div className="bg-white border-2 p-8 text-center" style={{ borderColor: "#E0E0E0" }}>
          <p className="text-sm font-semibold mb-1" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
            {translate("DCS_DB_EMPTY_TITLE")}
          </p>
          <p className="text-xs mb-4" style={{ color: "#9E9E9E" }}>
            {translate(can_edit ? "DCS_DB_EMPTY_HINT" : "DCS_DB_EMPTY_HINT_VIEWER")}
          </p>
          {can_edit && (
            <div className="w-full sm:w-56 mx-auto">
              <DcsButtonPrimary type="button" onClick={() => handle_generate("overwrite")}>
                {translate("DCS_DB_BTN_GENERATE")}
              </DcsButtonPrimary>
            </div>
          )}
        </div>
      ) : (
        <div
          ref={grid_ref}
          style={
            is_fullscreen && fs_mode === "fit"
              ? SUPPORTS_ZOOM
                ? { zoom: fit_scale }
                : { transform: `scale(${fit_scale})`, transformOrigin: "top left", width: `${Math.round(10000 / fit_scale) / 100}%` }
              : undefined
          }
        >
          <div className="flex flex-wrap items-stretch gap-3">
            {widgets.map((widget) => (
              <div
                key={widget.id}
                // A lone widget always spans the whole board - a small card
                // floating in empty space reads as broken, not minimal.
                className={widgets.length === 1 ? SIZE_CLASSES.full : SIZE_CLASSES[widget.size] || SIZE_CLASSES.medium}
              >
                <WidgetCard
                  widget={widget}
                  data={data_by_widget[widget.id]}
                  loading={data_loading && !data_by_widget[widget.id]}
                  fitMode={is_fullscreen && fs_mode === "fit"}
                  editable={can_edit && !generating}
                  savingText={saving_widget_id === widget.id}
                  onUpdateText={(changes) => handle_update_widget(widget.id, changes)}
                  onRemove={can_edit && !generating ? () => setWidgetToRemove(widget) : undefined}
                  onChangeType={can_edit && !generating ? (next_type) => handle_update_widget(widget.id, { chart_type: next_type }) : undefined}
                  onRetry={() => retry_widget(widget)}
                  onShowSkipped={(target) => setSkippedWidget(target)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {regen_dialog && <RegenerateDialog onPick={handle_generate} onCancel={() => setRegenDialog(false)} />}
      {kpi_dialog && <AddKpiDialog form={form} widgets={widgets} onAdded={handle_kpi_added} onCancel={() => setKpiDialog(false)} />}
      {skipped_widget && (
        <SkippedDetailsModal
          form={form}
          widget={skipped_widget}
          period={applied_period_ref.current}
          onClose={() => setSkippedWidget(null)}
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
      {widget_to_remove && (
        <DcsConfirmDialog
          titleKey="DCS_DB_REMOVE_TITLE"
          messageKey="DCS_DB_REMOVE_MESSAGE"
          confirming={removing}
          onConfirm={handle_remove_widget}
          onCancel={() => setWidgetToRemove(null)}
        />
      )}
    </div>
  );
}
