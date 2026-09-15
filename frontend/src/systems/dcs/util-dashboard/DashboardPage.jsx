import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { get_dashboard, save_dashboard, get_dashboard_data, request_error_text } from "./dashboardService.js";
import { regenerate_and_save } from "./autoGenerate.js";
import { useBoardFullscreen } from "./useBoardFullscreen.js";
import { fold_family, widgets_data_signature } from "./chartCatalog.js";
import BoardHeader from "./BoardHeader.jsx";
import GeneratedWidgetsReview from "./GeneratedWidgetsReview.jsx";
import DashboardBuilder from "./builder/DashboardBuilder.jsx";
import AppearanceDialog from "./builder/AppearanceDialog.jsx";
import { builder_fields, appearance_values_field } from "./builder/composeWidgets.js";
import SkippedDetailsModal from "./SkippedDetailsModal.jsx";
import IconPickerPanel from "./icons/IconPickerPanel.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsConfirmDialog from "../components/DcsConfirmDialog.jsx";
import DcsLoadingState from "../components/DcsLoadingState.jsx";
import BoardWithSelection from "./selection/BoardWithSelection.jsx";

const REFRESH_INTERVAL_MS = 30000;

// CSS zoom keeps text crisp when fitting the board; transform is the fallback.
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
  // The builder overlay's open tab ("kpi" | "charts" | "diagrams"), null while closed.
  const [builder_tab, setBuilderTab] = useState(null);
  // While review_widgets is set the board is FROZEN behind the review list:
  // the grid is not rendered and no widget may fetch or refresh data.
  // review_focus narrows the review to just-added widgets (a manual KPI's
  // card and breakdowns); null reviews the whole board.
  const [review_widgets, setReviewWidgets] = useState(null);
  const [review_focus, setReviewFocus] = useState(null);
  const [skipped_widget, setSkippedWidget] = useState(null);
  // The widgets whose icon / colors are being edited in their dialogs.
  const [icon_widget, setIconWidget] = useState(null);
  const [appearance_widget, setAppearanceWidget] = useState(null);
  const form_fields = useMemo(() => builder_fields(form.schema), [form.schema]);

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
  frozen_ref.current = generating || review_widgets !== null || builder_tab !== null;

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
      .catch((error) => is_mounted && showError(request_error_text(error, translate("DCS_ERROR_GENERIC"))))
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
      showError(request_error_text(error, translate("DCS_ERROR_GENERIC")));
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
      showError(request_error_text(error, translate("DCS_ERROR_GENERIC")));
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

  // The automatic generation, still reachable from the builder's footer:
  // "overwrite" replaces the whole board, and the fresh board opens in the
  // review list (no data loads there) instead of fetching right away.
  const handle_generate = async (mode) => {
    setBuilderTab(null);
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
      showError(error.is_translation_key ? translate(error.message) : request_error_text(error, translate("DCS_ERROR_GENERIC")));
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

  // The builder saved the dashboard (drafts appended or replacing the
  // board): the new widget list loads through the signature effect.
  const handle_built = (final_widgets) => {
    setBuilderTab(null);
    setWidgets(final_widgets);
  };

  const handle_delete = async () => {
    setDeleting(true);
    try {
      await save_dashboard(form.form_group_id, []);
      setWidgets([]);
      setDataByWidget({});
      showSuccess(translate("DCS_DB_DELETED_TOAST"));
    } catch (error) {
      showError(request_error_text(error, translate("DCS_ERROR_GENERIC")));
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
        onAddKpi={() => setBuilderTab("kpi")}
        onRegenerate={() => setBuilderTab("kpi")}
        onDelete={() => setConfirming("delete")}
      />

      {review_widgets !== null ? null : widgets.length === 0 && !generating ? (
        <div className="bg-white border-2 p-8 text-center" style={{ borderColor: "#E0E0E0" }}>
          <p className="text-sm font-semibold mb-1" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
            {translate("DCS_DB_EMPTY_TITLE")}
          </p>
          <p className="text-xs mb-4" style={{ color: "#9E9E9E" }}>
            {translate(can_edit ? "DCS_DB_EMPTY_HINT" : "DCS_DB_EMPTY_HINT_VIEWER")}
          </p>
          {can_edit && (
            <div className="w-full sm:w-56 mx-auto">
              <DcsButtonPrimary type="button" onClick={() => setBuilderTab("kpi")}>
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
          <BoardWithSelection
            form={form}
            fields={form_fields}
            widgets={widgets}
            dataByWidget={data_by_widget}
            dataLoading={data_loading}
            fitMode={is_fullscreen && fs_mode === "fit"}
            editable={can_edit && !generating}
            savingWidgetId={saving_widget_id}
            onUpdateWidget={handle_update_widget}
            onRemoveWidget={(widget) => setWidgetToRemove(widget)}
            onRetryWidget={retry_widget}
            onShowSkipped={(target) => setSkippedWidget(target)}
            onPickIcon={(target) => setIconWidget(target)}
            onAppearance={(target) => setAppearanceWidget(target)}
            onSaved={(final_widgets) => {
              // Reordering, bulk edits and deletions never change what the
              // surviving widgets chart - keep their data, drop the rest.
              data_signature_ref.current = widgets_data_signature(final_widgets);
              setWidgets(final_widgets);
              const kept = new Set(final_widgets.map((widget) => widget.id));
              setDataByWidget((current) => Object.fromEntries(Object.entries(current).filter(([id]) => kept.has(id))));
            }}
          />
        </div>
      )}

      {review_widgets !== null && (
        <GeneratedWidgetsReview
          form={form}
          initialWidgets={review_widgets}
          focusIds={review_focus}
          onOpenDashboard={close_review}
          onClose={close_review}
          onWidgetsChange={setWidgets}
        />
      )}
      {builder_tab !== null && (
        <DashboardBuilder
          form={form}
          existingWidgets={widgets}
          initialTab={builder_tab}
          onClose={() => setBuilderTab(null)}
          onSaved={handle_built}
          onAutoGenerate={() => handle_generate("overwrite")}
        />
      )}
      {appearance_widget && (
        <AppearanceDialog
          form={form}
          title={appearance_widget.title}
          valuesField={appearance_values_field(appearance_widget, form_fields)}
          appearance={appearance_widget.appearance}
          onClose={() => setAppearanceWidget(null)}
          onApply={async (appearance) => {
            setAppearanceWidget(null);
            await handle_update_widget(appearance_widget.id, { appearance });
          }}
        />
      )}
      {icon_widget && (
        <IconPickerPanel
          widget={widgets.find((widget) => widget.id === icon_widget.id) || icon_widget}
          saving={saving_widget_id === icon_widget.id}
          onPick={async (name) => {
            await handle_update_widget(icon_widget.id, { icon: name });
            setIconWidget(null);
          }}
          onRemove={async () => {
            await handle_update_widget(icon_widget.id, { icon: null });
            setIconWidget(null);
          }}
          onClose={() => setIconWidget(null)}
        />
      )}
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
