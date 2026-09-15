import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { get_dashboard, save_dashboard, get_dashboard_data, request_error_text } from "./dashboardService.js";
import { regenerate_and_save } from "./autoGenerate.js";
import { useBoardFullscreen } from "./useBoardFullscreen.js";
import { useBoardData } from "./useBoardData.js";
import { fold_family } from "./chartCatalog.js";
import BoardHeader from "./BoardHeader.jsx";
import GeneratedWidgetsReview from "./GeneratedWidgetsReview.jsx";
import DashboardBuilder from "./builder/DashboardBuilder.jsx";
import BoardWidgetDialogs from "./BoardWidgetDialogs.jsx";
import { builder_fields } from "./builder/composeWidgets.js";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsConfirmDialog from "../components/DcsConfirmDialog.jsx";
import DcsLoadingState from "../components/DcsLoadingState.jsx";
import BoardWithSelection from "./selection/BoardWithSelection.jsx";
import DashboardCodeOverlay, { useDashboardCodeShortcut } from "./DashboardCodeOverlay.jsx";
import ShareLinksDialog from "./share/ShareLinksDialog.jsx";
import { BoardThemeProvider, useBoardTheme } from "./boardTheme.jsx";

// CSS zoom keeps text crisp when fitting the board; transform is the fallback.
const SUPPORTS_ZOOM = typeof CSS !== "undefined" && CSS.supports && CSS.supports("zoom", "2");

/**
 * The form's dashboard: live data (silently refreshed every 30 seconds,
 * with a dashboard-wide period filter - see useBoardData), and for users
 * allowed to edit the form: the builder, per-card edits, the selection
 * mode, the Ctrl+6 code tools, public share links and deletion. A
 * regeneration NEVER shows data right away: the result opens in the review
 * list first, and while that review is open NO widget fetches anything.
 */
export default function DashboardPage({ form }) {
  return (
    <BoardThemeProvider>
      <DashboardBoard form={form} />
    </BoardThemeProvider>
  );
}

function DashboardBoard({ form }) {
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const board = useBoardTheme();

  const [loading, setLoading] = useState(true);
  const [can_edit, setCanEdit] = useState(false);
  const [widgets, setWidgets] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, message_key: "" });
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(null);
  // The builder overlay's open tab ("kpi" | "charts" | "diagrams"), null while closed.
  const [builder_tab, setBuilderTab] = useState(null);
  // The Ctrl+6 code tools overlay and the share links dialog.
  const [code_open, setCodeOpen] = useState(false);
  const [share_open, setShareOpen] = useState(false);
  // While review_widgets is set the board is FROZEN behind the review list:
  // the grid is not rendered and no widget may fetch or refresh data.
  // review_focus narrows the review to just-added widgets; null reviews all.
  const [review_widgets, setReviewWidgets] = useState(null);
  const [review_focus, setReviewFocus] = useState(null);
  const [skipped_widget, setSkippedWidget] = useState(null);
  // The widgets whose icon / colors are being edited in their dialogs.
  const [icon_widget, setIconWidget] = useState(null);
  const [appearance_widget, setAppearanceWidget] = useState(null);
  const form_fields = useMemo(() => builder_fields(form.schema), [form.schema]);

  const frozen_ref = useRef(false);
  frozen_ref.current = generating || review_widgets !== null || builder_tab !== null || code_open || share_open;
  useDashboardCodeShortcut(can_edit && !loading && !generating && review_widgets === null && builder_tab === null, () => setCodeOpen(true));

  const data = useBoardData({
    scope_key: form.form_group_id,
    widgets,
    loading,
    blocked: review_widgets !== null,
    frozen_ref,
    fetch_batch: (batch, period) => get_dashboard_data(form.form_group_id, batch, period),
  });

  // Browser-native full screen with two viewing modes ("fit" zooms the whole
  // board onto one screen, "scroll" keeps natural size), the self-fitting
  // zoom and the hover-driven fixed header all live in the hook.
  const { container_ref, grid_ref, is_fullscreen, is_fallback, enter, exit, fs_mode, setFsMode, fit_scale, header_visible, show_header, schedule_header_hide } = useBoardFullscreen();

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

  // The generated board is deliberately large - each card can be removed on
  // its own, after a warning. Removing never refetches the survivors.
  const [widget_to_remove, setWidgetToRemove] = useState(null);
  const [removing, setRemoving] = useState(false);
  const handle_remove_widget = async () => {
    const target = widget_to_remove;
    if (!target) return;
    const next_widgets = widgets.filter((widget) => widget.id !== target.id).map((widget, index) => ({ ...widget, position: index }));
    setRemoving(true);
    try {
      const saved = await save_dashboard(form.form_group_id, next_widgets);
      const final_widgets = (saved.data && saved.data.widgets) || next_widgets;
      data.settle(final_widgets);
      setWidgets(final_widgets);
      data.keep_only(final_widgets);
      showSuccess(translate("DCS_DB_WIDGET_REMOVED"));
    } catch (error) {
      showError(request_error_text(error, translate("DCS_ERROR_GENERIC")));
    } finally {
      setRemoving(false);
      setWidgetToRemove(null);
    }
  };

  // Click-to-edit on a card (title, description, look, size, icon, colors):
  // saved right away with a per-card spinner. Only a switch that changes
  // the data's folding family (donut to bar, for example) refreshes THAT
  // one card; nothing else refetches.
  const [saving_widget_id, setSavingWidgetId] = useState(null);
  const handle_update_widget = async (widget_id, changes) => {
    const previous = widgets.find((widget) => widget.id === widget_id);
    const next_widgets = widgets.map((widget) => (widget.id === widget_id ? { ...widget, ...changes } : widget));
    setSavingWidgetId(widget_id);
    try {
      const saved = await save_dashboard(form.form_group_id, next_widgets);
      const final_widgets = (saved.data && saved.data.widgets) || next_widgets;
      data.settle(final_widgets);
      setWidgets(final_widgets);
      if (changes.chart_type && previous && fold_family(changes.chart_type) !== fold_family(previous.chart_type)) {
        const updated = final_widgets.find((widget) => widget.id === widget_id);
        if (updated) data.retry_widget(updated);
      }
      showSuccess(translate("DCS_DB_WIDGET_UPDATED"));
    } catch (error) {
      showError(request_error_text(error, translate("DCS_ERROR_GENERIC")));
    } finally {
      setSavingWidgetId(null);
    }
  };

  // The automatic generation, still reachable from the builder's footer:
  // "overwrite" replaces the whole board, and the fresh board opens in the
  // review list (no data loads there) instead of fetching right away.
  const handle_generate = async (mode) => {
    setBuilderTab(null);
    setGenerating(true);
    setProgress({ percent: 5, message_key: "DCS_DB_GEN_PROGRESS_ANALYZE" });
    try {
      const result = await regenerate_and_save(form, translate, mode, widgets, (percent, message_key) => setProgress({ percent, message_key }));
      setWidgets(result.widgets);
      setReviewFocus(null);
      setReviewWidgets(result.widgets);
      if (mode === "update") {
        showSuccess(result.added > 0 ? translate("DCS_DB_REGEN_UPDATED_TOAST", { count: result.added }) : translate("DCS_DB_REGEN_NO_NEW_TOAST"));
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

  const handle_delete = async () => {
    setDeleting(true);
    try {
      await save_dashboard(form.form_group_id, []);
      setWidgets([]);
      data.clear();
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
      className={`dcs-board-root dcs-board-no-select relative select-none ${board.is_dark ? "dcs-board-dark" : ""} ${is_fullscreen ? (is_fallback ? "fixed inset-0 z-[10000] " : "") + "dcs-board-fullscreen p-2 sm:p-4" : "pb-16 space-y-4"}`}
      style={is_fullscreen ? { backgroundColor: "var(--board-bg, #F4F7F9)", width: "100%", height: "100%", overflowY: fs_mode === "fit" ? "hidden" : "auto" } : undefined}
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
        period={data.period}
        setPeriod={data.setPeriod}
        from={data.from}
        setFrom={data.setFrom}
        to={data.to}
        setTo={data.setTo}
        onApplyPeriod={data.handle_period_apply}
        onAddKpi={() => setBuilderTab("kpi")}
        onShare={() => setShareOpen(true)}
        onDelete={() => setConfirming("delete")}
      />

      {review_widgets !== null ? null : widgets.length === 0 && !generating ? (
        <div className="dcs-board-chrome border-2 p-8 text-center">
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--board-text, #333333)", fontFamily: "'Montserrat', sans-serif" }}>
            {translate("DCS_DB_EMPTY_TITLE")}
          </p>
          <p className="text-xs mb-4" style={{ color: "var(--board-muted, #9E9E9E)" }}>
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
            dataByWidget={data.data_by_widget}
            dataLoading={data.data_loading}
            fitMode={is_fullscreen && fs_mode === "fit"}
            editable={can_edit && !generating}
            savingWidgetId={saving_widget_id}
            onUpdateWidget={handle_update_widget}
            onRemoveWidget={(widget) => setWidgetToRemove(widget)}
            onRetryWidget={data.retry_widget}
            onShowSkipped={(target) => setSkippedWidget(target)}
            onPickIcon={(target) => setIconWidget(target)}
            onAppearance={(target) => setAppearanceWidget(target)}
            onSaved={(final_widgets) => {
              // Reordering, bulk edits and deletions never change what the
              // surviving widgets chart - keep their data, drop the rest.
              data.settle(final_widgets);
              setWidgets(final_widgets);
              data.keep_only(final_widgets);
            }}
          />
        </div>
      )}

      {review_widgets !== null && (
        <GeneratedWidgetsReview form={form} initialWidgets={review_widgets} focusIds={review_focus} onOpenDashboard={close_review} onClose={close_review} onWidgetsChange={setWidgets} />
      )}
      {builder_tab !== null && (
        <DashboardBuilder
          form={form}
          existingWidgets={widgets}
          initialTab={builder_tab}
          onClose={() => setBuilderTab(null)}
          onSaved={(final_widgets) => {
            setBuilderTab(null);
            setWidgets(final_widgets);
          }}
          onAutoGenerate={() => handle_generate("overwrite")}
        />
      )}
      {code_open && (
        <DashboardCodeOverlay
          form={form}
          widgets={widgets}
          onClose={() => setCodeOpen(false)}
          onSaved={(final_widgets) => {
            setCodeOpen(false);
            setWidgets(final_widgets);
          }}
        />
      )}
      {share_open && <ShareLinksDialog form={form} onClose={() => setShareOpen(false)} />}
      <BoardWidgetDialogs
        form={form}
        fields={form_fields}
        widgets={widgets}
        savingWidgetId={saving_widget_id}
        appearanceWidget={appearance_widget}
        iconWidget={icon_widget}
        skippedWidget={skipped_widget}
        period={data.applied_period_ref.current}
        onUpdate={handle_update_widget}
        onCloseAppearance={() => setAppearanceWidget(null)}
        onCloseIcon={() => setIconWidget(null)}
        onCloseSkipped={() => setSkippedWidget(null)}
      />
      {confirming === "delete" && (
        <DcsConfirmDialog titleKey="DCS_DB_DEL_CONFIRM_TITLE" messageKey="DCS_DB_DEL_CONFIRM_MESSAGE" confirming={deleting} onConfirm={handle_delete} onCancel={() => setConfirming(null)} />
      )}
      {widget_to_remove && (
        <DcsConfirmDialog titleKey="DCS_DB_REMOVE_TITLE" messageKey="DCS_DB_REMOVE_MESSAGE" confirming={removing} onConfirm={handle_remove_widget} onCancel={() => setWidgetToRemove(null)} />
      )}
    </div>
  );
}
