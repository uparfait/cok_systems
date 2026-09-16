import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { get_dashboard, save_dashboard, get_dashboard_data, get_filter_values, request_error_text } from "./dashboardService.js";
import { regenerate_and_save } from "./autoGenerate.js";
import { useBoardFullscreen } from "./useBoardFullscreen.js";
import { useBoardData } from "./useBoardData.js";
import { useDashboards } from "./useDashboards.js";
import { fold_family } from "./chartCatalog.js";
import BoardHeader from "./BoardHeader.jsx";
import DashboardSwitcher from "./DashboardSwitcher.jsx";
import DashboardNameDialog from "./DashboardNameDialog.jsx";
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
import ScreenshotStudio from "./screenshot/ScreenshotStudio.jsx";
import { BoardThemeProvider, useBoardTheme } from "./boardTheme.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";

// CSS zoom keeps text crisp when fitting the board; transform is the fallback.
const SUPPORTS_ZOOM = typeof CSS !== "undefined" && CSS.supports && CSS.supports("zoom", "2");

/**
 * The form's dashboards: a form holds any number of NAMED boards, picked
 * from the switcher in the header (the last one used is remembered per
 * form in this browser). The open board shows live data (silently
 * refreshed every 30 seconds, with a board-wide period filter - see
 * useBoardData), and for users allowed to edit the form: the builder,
 * per-card edits, the selection mode, the Ctrl+6 code tools, public share
 * links of THIS board and deletion of THIS board. A form without any
 * dashboard first asks for a name. A regeneration NEVER shows data right
 * away: the result opens in the review list first, and while that review
 * is open NO widget fetches anything.
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
  const library = useDashboards(form.form_group_id);
  const { active_id, can_edit } = library;

  const [widgets_loading, setWidgetsLoading] = useState(true);
  const [widgets, setWidgets] = useState([]);
  // The board's filter fields (see boardFilters.js), saved with the dashboard.
  const [filters, setFilters] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, message_key: "" });
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(null);
  // The "name a new dashboard" dialog and its request.
  const [naming, setNaming] = useState(false);
  const [name_saving, setNameSaving] = useState(false);
  const asked_ref = useRef(false);
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

  // Every child that reads or saves widgets works on THIS dashboard.
  const scoped_form = useMemo(
    () => ({ ...form, dashboard_id: active_id, dashboard_name: library.active ? library.active.name : "" }),
    [form, active_id, library.active],
  );

  const loading = library.list_loading || widgets_loading;
  const frozen_ref = useRef(false);
  const [shot_open_flag, setShotOpenFlag] = useState(false);
  frozen_ref.current = generating || review_widgets !== null || builder_tab !== null || code_open || share_open || naming || shot_open_flag;
  useDashboardCodeShortcut(can_edit && !!active_id && !loading && !generating && review_widgets === null && builder_tab === null, () => setCodeOpen(true));

  const data = useBoardData({
    scope_key: `${form.form_group_id}:${active_id}`,
    widgets,
    loading,
    blocked: review_widgets !== null,
    frozen_ref,
    fetch_batch: (batch, period, applied) => get_dashboard_data(form.form_group_id, batch, period, applied),
  });

  // Browser-native full screen with two viewing modes ("fit" zooms the whole
  // board onto one screen, "scroll" keeps natural size), the self-fitting
  // zoom and the hover-driven fixed header all live in the hook.
  const { container_ref, grid_ref, is_fullscreen, is_fallback, enter, exit, fs_mode, setFsMode, fit_scale, header_visible, show_header, schedule_header_hide } = useBoardFullscreen();

  // The screenshot studio: the board as it stands right now - each card's
  // place measured on screen (undoing any fit zoom) and its current data
  // copied, so nothing in the studio ever refreshes.
  const [shot, setShot] = useState(null);
  const open_screenshot = () => {
    const grid = grid_ref.current;
    if (!grid) return;
    const box = grid.getBoundingClientRect();
    const ratio = grid.offsetWidth ? box.width / grid.offsetWidth : 1;
    const rects = Array.from(grid.querySelectorAll("[data-widget-id]")).map((node) => {
      const rect = node.getBoundingClientRect();
      return { id: node.getAttribute("data-widget-id"), x: (rect.left - box.left) / ratio, y: (rect.top - box.top) / ratio, w: rect.width / ratio, h: rect.height / ratio };
    });
    setShot({ rects, base: { w: grid.offsetWidth, h: grid.offsetHeight }, data: { ...data.data_by_widget } });
  };
  useEffect(() => setShotOpenFlag(shot !== null), [shot]);

  useEffect(() => {
    if (library.list_error) showError(request_error_text(library.list_error, translate("DCS_ERROR_GENERIC")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library.list_error]);

  // A form with no dashboard yet asks its editor for the first one's name - once.
  useEffect(() => {
    if (library.list_loading || asked_ref.current) return;
    if (library.dashboards.length === 0 && can_edit) {
      asked_ref.current = true;
      setNaming(true);
    }
  }, [library.list_loading, library.dashboards.length, can_edit]);

  // The active dashboard's widgets, loaded whenever the switcher changes it.
  useEffect(() => {
    if (!active_id) {
      setWidgets([]);
      setWidgetsLoading(false);
      return undefined;
    }
    let is_mounted = true;
    setWidgetsLoading(true);
    get_dashboard({ form_group_id: form.form_group_id, dashboard_id: active_id })
      .then((response) => {
        if (!is_mounted) return;
        setWidgets((response.data && response.data.widgets) || []);
        setFilters((response.data && response.data.filters) || []);
      })
      .catch((error) => is_mounted && showError(request_error_text(error, translate("DCS_ERROR_GENERIC"))))
      .finally(() => is_mounted && setWidgetsLoading(false));
    return () => {
      is_mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.form_group_id, active_id]);

  // Every save lands in the same place: the board and the switcher's count;
  // a save that also carried the filter fields updates those too.
  const commit_widgets = (final_widgets, final_filters) => {
    setWidgets(final_widgets);
    library.set_count(active_id, final_widgets.length);
    if (Array.isArray(final_filters)) {
      setFilters(final_filters);
      data.prune_filters(final_filters);
    }
  };

  // Adding or removing a filter field from the bar is saved right away.
  const handle_change_filters = async (defs) => {
    try {
      const saved = await save_dashboard(scoped_form, widgets, defs);
      commit_widgets((saved.data && saved.data.widgets) || widgets, (saved.data && saved.data.filters) || defs);
      data.settle((saved.data && saved.data.widgets) || widgets);
    } catch (error) {
      showError(request_error_text(error, translate("DCS_ERROR_GENERIC")));
    }
  };

  // The values a filter offers follow the period and the other filters.
  const fetch_filter_values = (field_id, others) =>
    get_filter_values(form.form_group_id, field_id, others || data.applied_filters_ref.current, data.applied_period_ref.current).then((response) => (response.data && response.data.values) || []);

  const submit_name = async (name) => {
    setNameSaving(true);
    try {
      const created = await library.create(name);
      setNaming(false);
      showSuccess(translate("DCS_DB_CREATED_TOAST", { name: created.name }));
    } catch (error) {
      showError(request_error_text(error, translate("DCS_ERROR_GENERIC")));
    } finally {
      setNameSaving(false);
    }
  };

  const rename_active = async (name) => {
    try {
      await library.rename(name);
      showSuccess(translate("DCS_DB_RENAMED_TOAST"));
    } catch (error) {
      showError(request_error_text(error, translate("DCS_ERROR_GENERIC")));
      throw error;
    }
  };

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
      const saved = await save_dashboard(scoped_form, next_widgets);
      const final_widgets = (saved.data && saved.data.widgets) || next_widgets;
      data.settle(final_widgets);
      commit_widgets(final_widgets);
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
      const saved = await save_dashboard(scoped_form, next_widgets);
      const final_widgets = (saved.data && saved.data.widgets) || next_widgets;
      data.settle(final_widgets);
      commit_widgets(final_widgets);
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
      const result = await regenerate_and_save(scoped_form, translate, mode, widgets, (percent, message_key) => setProgress({ percent, message_key }));
      commit_widgets(result.widgets);
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

  // Deleting removes THIS dashboard (and its share links); the next one in
  // the list takes over, or the editor is asked to name a new first one.
  const handle_delete = async () => {
    setDeleting(true);
    try {
      const remaining = await library.remove();
      data.clear();
      setWidgets([]);
      showSuccess(translate("DCS_DB_DELETED_TOAST"));
      if (remaining.length === 0) setNaming(true);
    } catch (error) {
      showError(request_error_text(error, translate("DCS_ERROR_GENERIC")));
    } finally {
      setDeleting(false);
      setConfirming(null);
    }
  };

  if (library.list_loading) return <DcsLoadingState />;

  const has_board = !!active_id;
  const empty_state = (
    <div className="dcs-board-chrome border-2 p-8 text-center">
      <p className="text-sm font-semibold mb-1" style={{ color: "var(--board-text, #333333)", fontFamily: "'Montserrat', sans-serif" }}>
        {translate(has_board ? "DCS_DB_EMPTY_TITLE" : "DCS_DB_NO_DASHBOARDS_TITLE")}
      </p>
      <p className="text-xs mb-4" style={{ color: "var(--board-muted, #9E9E9E)" }}>
        {translate(!can_edit ? "DCS_DB_EMPTY_HINT_VIEWER" : has_board ? "DCS_DB_EMPTY_HINT" : "DCS_DB_NO_DASHBOARDS_HINT")}
      </p>
      {can_edit && (
        <div className="w-full sm:w-56 mx-auto">
          <DcsButtonPrimary type="button" onClick={() => (has_board ? setBuilderTab("kpi") : setNaming(true))}>
            {translate(has_board ? "DCS_DB_BTN_GENERATE" : "DCS_DB_CREATE_BTN")}
          </DcsButtonPrimary>
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={container_ref}
      className={`dcs-board-root dcs-board-no-select relative select-none ${board.is_dark ? "dcs-board-dark" : ""} ${is_fullscreen ? (is_fallback ? "fixed inset-0 z-[10000] " : "") + "dcs-board-fullscreen p-2 sm:p-4" : "pb-16 space-y-4"}`}
      style={is_fullscreen ? { backgroundColor: "var(--board-bg, #F4F7F9)", width: "100%", height: "100%", overflowY: fs_mode === "fit" ? "hidden" : "auto" } : undefined}
    >
      <BoardHeader
        form={form}
        title={<DashboardSwitcher dashboards={library.dashboards} activeId={active_id} canEdit={can_edit && !generating} onSelect={library.select} onRename={rename_active} onCreate={() => setNaming(true)} />}
        widgets_count={widgets.length}
        can_edit={can_edit && has_board}
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
        filters={filters}
        fields={form_fields}
        widgets={widgets}
        filterValues={data.filter_values}
        onFilterValue={data.set_filter_value}
        onFilterValues={data.set_filter_values}
        onChangeFilters={can_edit && has_board ? handle_change_filters : undefined}
        fetchFilterValues={fetch_filter_values}
        onAddKpi={() => setBuilderTab("kpi")}
        onShare={() => setShareOpen(true)}
        onDelete={() => setConfirming("delete")}
        onScreenshot={open_screenshot}
      />

      {review_widgets !== null ? null : widgets_loading ? (
        <div className="dcs-board-chrome border-2 flex justify-center py-12">
          <SpiralLoader />
        </div>
      ) : widgets.length === 0 && !generating ? (
        empty_state
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
            form={scoped_form}
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
              commit_widgets(final_widgets);
              data.keep_only(final_widgets);
            }}
          />
        </div>
      )}

      {review_widgets !== null && (
        <GeneratedWidgetsReview form={scoped_form} initialWidgets={review_widgets} focusIds={review_focus} onOpenDashboard={close_review} onClose={close_review} onWidgetsChange={commit_widgets} />
      )}
      {builder_tab !== null && (
        <DashboardBuilder
          form={scoped_form}
          existingWidgets={widgets}
          existingFilters={filters}
          initialTab={builder_tab}
          onClose={() => setBuilderTab(null)}
          onSaved={(final_widgets, final_filters) => {
            setBuilderTab(null);
            commit_widgets(final_widgets, final_filters);
          }}
          onAutoGenerate={() => handle_generate("overwrite")}
        />
      )}
      {code_open && (
        <DashboardCodeOverlay
          form={scoped_form}
          widgets={widgets}
          filters={filters}
          onClose={() => setCodeOpen(false)}
          onSaved={(final_widgets, final_filters) => {
            setCodeOpen(false);
            commit_widgets(final_widgets, final_filters);
          }}
        />
      )}
      {share_open && <ShareLinksDialog form={scoped_form} filters={filters} fields={form_fields} fetchFilterValues={fetch_filter_values} onClose={() => setShareOpen(false)} />}
      {shot && <ScreenshotStudio form={scoped_form} widgets={widgets} dataByWidget={shot.data} rects={shot.rects} base={shot.base} onClose={() => setShot(null)} />}
      {naming && <DashboardNameDialog formName={form.form_name} saving={name_saving} onSubmit={submit_name} onCancel={() => setNaming(false)} />}
      <BoardWidgetDialogs
        form={scoped_form}
        fields={form_fields}
        widgets={widgets}
        savingWidgetId={saving_widget_id}
        appearanceWidget={appearance_widget}
        iconWidget={icon_widget}
        skippedWidget={skipped_widget}
        period={data.applied_period_ref.current}
        appliedFilters={data.applied_filters_ref.current}
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
