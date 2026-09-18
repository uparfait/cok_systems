import React, { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { get_dashboard_data, get_filter_values, get_map_shapes, request_error_text, get_dashboard } from "./dashboardService.js";
import { regenerate_and_save } from "./autoGenerate.js";
import { useBoardFullscreen } from "./useBoardFullscreen.js";
import { useBoardData } from "./useBoardData.js";
import { useDashboards } from "./useDashboards.js";
import BoardHeader from "./BoardHeader.jsx";
import DashboardSwitcher from "./DashboardSwitcher.jsx";
import BoardViewOverlays from "./BoardViewOverlays.jsx";
import BoardAuthoringOverlays from "./BoardAuthoringOverlays.jsx";
import { useBoardCanvas } from "./useBoardCanvas.jsx";
import { useWidgetEdits } from "./useWidgetEdits.js";
import BoardWidgetDialogs from "./BoardWidgetDialogs.jsx";
import { builder_fields } from "./builder/composeWidgets.js";
import BoardEmptyState from "./BoardEmptyState.jsx";
import { useBoardContents } from "./useBoardContents.js";
import { descendants_of } from "./studio/useBoardStudio.js";
import DcsLoadingState from "../components/DcsLoadingState.jsx";
import StudioBoard from "./studio/StudioBoard.jsx";
import { useDashboardCodeShortcut } from "./DashboardCodeOverlay.jsx";
import { BoardThemeProvider, useBoardTheme } from "./boardTheme.jsx";
import { MapScopeProvider, filter_names } from "./mapScope.jsx";
import { location_fields, geo_fields } from "./builder/mapFields.js";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";

// CSS zoom keeps text crisp when fitting the board; transform is the fallback.
const SUPPORTS_ZOOM = typeof CSS !== "undefined" && CSS.supports && CSS.supports("zoom", "2");

/**
 * The form's dashboards: a form holds any number of NAMED boards, picked
 * from the switcher in the header (the last one used is remembered per
 * form in this browser). The open board shows live data (silently
 * refreshed every 30 seconds, with a board-wide period filter - see
 * useBoardData), and for users allowed to edit the form: the builder,
 * per-card edits, studio mode, the Ctrl+6 code tools, public share
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
  const { translate, language } = useDcsLanguage();
  const { showSuccess, showError, showInfo } = useToast();
  const board = useBoardTheme();
  const library = useDashboards(form.form_group_id);
  const { active_id, can_edit } = library;

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
  // The widget reopened in the builder to be changed, rather than a new one added.
  const [reconfiguring, setReconfiguring] = useState(null);
  // The canvas a newly built widget should be dropped into, if any.
  const [into_canvas, setIntoCanvas] = useState(null);
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
  // Which fields name a place, so any widget grouped by one can become a map.
  const map_levels = useMemo(() => new Map(location_fields(form_fields).map((entry) => [entry.id, entry.level])), [form_fields]);
  // The field a heat map would be drawn from, when the form captures one.
  const heat_field = useMemo(() => (geo_fields(form_fields)[0] || {}).id || "", [form_fields]);

  // Every child that reads or saves widgets works on THIS dashboard.
  const scoped_form = useMemo(
    () => ({ ...form, dashboard_id: active_id, dashboard_name: library.active ? library.active.name : "" }),
    [form, active_id, library.active],
  );

  // The open board's widgets, filter fields and arrangement, and the one
  // place every save lands. The data hook below is built from the widget
  // list this returns, so it is handed a ref rather than the hook itself.
  const data_ref = useRef(null);
  const contents = useBoardContents({ form, scoped_form, active_id, library, dataRef: data_ref });
  const widgets = contents.widgets;
  const setWidgets = contents.setWidgets;
  const filters = contents.filters;
  const board_layout = contents.layout;
  const commit_widgets = contents.commit;
  const handle_change_filters = contents.change_filters;

  const loading = library.list_loading || contents.loading;
  const frozen_ref = useRef(false);
  const [shot_open_flag, setShotOpenFlag] = useState(false);
  // The records overlay: { widget, pick } while open; and whether the
  // studio mode is on (filters stop applying while it is).
  const [records, setRecords] = useState(null);
  const [selecting, setSelecting] = useState(false);
  // The switch the board's own menu uses to enter and leave studio
  // mode; the mode itself lives inside StudioBoard.
  const [studio_api, setStudioApi] = useState(null);
  frozen_ref.current = generating || review_widgets !== null || builder_tab !== null || code_open || share_open || naming || shot_open_flag || records !== null;
  useDashboardCodeShortcut(can_edit && !!active_id && !loading && !generating && review_widgets === null && builder_tab === null, () => setCodeOpen(true));

  const data = useBoardData({
    scope_key: `${form.form_group_id}:${active_id}`,
    widgets,
    loading,
    blocked: review_widgets !== null,
    frozen_ref,
    fetch_batch: (batch, period, applied) => get_dashboard_data(form.form_group_id, batch, period, applied),
  });
  data_ref.current = data;

  // Browser-native full screen with two viewing modes ("fit" zooms the whole
  // board onto one screen, "scroll" keeps natural size), the self-fitting
  // zoom and the hover-driven fixed header all live in the hook.
  const { container_ref, grid_ref, content_fits, is_fullscreen, is_fallback, enter, exit, fs_mode, setFsMode, fit_scale, header_visible, show_header, schedule_header_hide } = useBoardFullscreen();

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
  // Click-to-edit on a card (title, description, look, size, icon, colors,
  // and the box it takes inside a canvas), and removing one - both saved
  // right away with a per-card spinner. See useWidgetEdits.
  const edits = useWidgetEdits({ form: scoped_form, widgets, data, translate, showSuccess, showError, showInfo, onCommit: commit_widgets });

  // Right-clicking the board makes canvases; right-clicking a widget acts
  // on that one. Both need the board to be editable.
  const open_builder_in = (canvas) => {
    setIntoCanvas(canvas.id);
    setBuilderTab("charts");
  };
  // Removing is asked for; a section that still holds widgets is refused
  // with the count of what has to go first.
  const request_remove = (target) => {
    if (!target) return;
    const inside = descendants_of(widgets, target.id).size;
    if (inside > 0) {
      showError(translate("DCS_DB_CANVAS_HAS_CHILDREN", { count: inside }));
      return;
    }
    setWidgetToRemove(target);
  };

  const canvas_menu = useBoardCanvas({
    form: scoped_form,
    widgets,
    editable: can_edit && !generating,
    isDark: board.is_dark,
    translate,
    // One right-click menu for the whole board, and studio mode is
    // always its first entry.
    arranging: selecting,
    studio: studio_api,
    onAdd: (made) => edits.add_widget(made),
    onSettings: (target) => setAppearanceWidget(target),
    onReconfigure: (target) => {
      setReconfiguring(target);
      setBuilderTab("charts");
    },
    onAddWidget: open_builder_in,
    onRemove: request_remove,
  });

  const saving_widget_id = edits.saving_widget_id;
  const removing = edits.removing;
  const handle_update_widget = edits.update_widget;
  const handle_remove_widget = () => edits.remove_widget(widget_to_remove, () => setWidgetToRemove(null));

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
    <BoardEmptyState
      hasBoard={has_board}
      canEdit={can_edit}
      onGenerate={() => setBuilderTab("kpi")}
      onCreate={() => setNaming(true)}
      onAddCanvas={() => canvas_menu.add_canvas(null)}
    />
  );

  const map_scope = filter_names(data.filter_values);
  // A person keeps several boards open at once and they look identical.
  const board_name = library.active ? library.active.name : "";
  return (
    <MapScopeProvider fetchShapes={(names, held) => get_map_shapes(form.form_group_id, names, map_scope, held)} scopeKey={map_scope.join("|")}>
    {/* Which board is open, in the tab. */}
    {board_name ? <Helmet><title>{board_name}</title></Helmet> : null}
    {/* Full screen means the SCREEN: no padding holding the board off
        the edges, no margin around it, and no scrollbar unless there is
        genuinely more board than screen. */}
    <div
      ref={container_ref}
      className={`dcs-board-root dcs-board-no-select relative select-none ${board.is_dark ? "dcs-board-dark" : ""} ${is_fullscreen ? (is_fallback ? "fixed inset-0 z-[10000] " : "") + "dcs-board-fullscreen" : "pb-16 space-y-4"}`}
      style={is_fullscreen ? { backgroundColor: "var(--board-bg, #F4F7F9)", width: "100%", height: "100%", overflowY: fs_mode === "fit" || content_fits ? "hidden" : "auto" } : undefined}
      onContextMenu={canvas_menu.open_board_menu}
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
        onChangeFilters={can_edit && has_board && selecting ? handle_change_filters : undefined}
        fetchFilterValues={fetch_filter_values}
        onAddKpi={() => setBuilderTab("kpi")}
        onShare={() => setShareOpen(true)}
        onDelete={() => setConfirming("delete")}
        onScreenshot={open_screenshot}
      />

      {review_widgets !== null ? null : contents.loading ? (
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
          <StudioBoard
            form={scoped_form}
            fields={form_fields}
            widgets={widgets}
            dataByWidget={data.data_by_widget}
            dataLoading={data.data_loading}
            fitMode={is_fullscreen && fs_mode === "fit"}
            editable={can_edit && !generating}
            savingWidgetId={saving_widget_id}
            onUpdateWidget={handle_update_widget}
            onRemoveWidget={request_remove}
            onRetryWidget={data.retry_widget}
            onShowSkipped={(target) => setSkippedWidget(target)}
            onPickIcon={(target) => setIconWidget(target)}
            onAppearance={(target) => setAppearanceWidget(target)}
            onReconfigure={(target) => {
              setReconfiguring(target);
              setBuilderTab("charts");
            }}
            onAddToCanvas={open_builder_in}
            onWidgetMenu={canvas_menu.open_widget_menu}
            onOpenRecords={(widget, pick) => setRecords({ widget, pick })}
            mapLevels={map_levels}
            heatField={heat_field}
            layout={board_layout}
            onSelectionChange={setSelecting}
            onSelectionApi={setStudioApi}
            onSaved={(final_widgets, final_layout) => {
              // Reordering, bulk edits, placements and deletions never
              // change what the surviving widgets chart - keep their data,
              // drop the rest.
              data.settle(final_widgets);
              commit_widgets(final_widgets, undefined, final_layout);
              data.keep_only(final_widgets);
            }}
          />
        </div>
      )}

      <BoardAuthoringOverlays
        form={scoped_form}
        widgets={widgets}
        filters={filters}
        reviewWidgets={review_widgets}
        reviewFocus={review_focus}
        builderTab={builder_tab}
        reconfigure={reconfiguring}
        intoCanvas={into_canvas}
        codeOpen={code_open}
        onCloseReview={close_review}
        onCloseBuilder={() => {
          setBuilderTab(null);
          setReconfiguring(null);
          setIntoCanvas(null);
        }}
        onCloseCode={() => setCodeOpen(false)}
        onCommit={commit_widgets}
        onAutoGenerate={() => handle_generate("overwrite")}
      />
      {canvas_menu.menu_element}
      <BoardViewOverlays
        shareOpen={share_open}
        share={{ form: scoped_form, filters, fields: form_fields, fetchFilterValues: fetch_filter_values, dashboards: library.dashboards, fetchDashboardFilters: (dashboard_id) => get_dashboard({ form_group_id: form.form_group_id, dashboard_id }).then((response) => (response.data && response.data.filters) || []) }}
        records={records}
        view={{ form_group_id: form.form_group_id, schema: form.schema, board_name: library.active ? library.active.name : "", period: data.applied_period_ref.current, filters: data.applied_filters_ref.current, language }}
        shot={shot}
        shotProps={shot ? { form: scoped_form, widgets, dataByWidget: shot.data, rects: shot.rects, base: shot.base } : null}
        naming={naming}
        namingProps={{ formName: form.form_name, saving: name_saving, onSubmit: submit_name }}
        onCloseShare={() => setShareOpen(false)}
        onCloseRecords={() => setRecords(null)}
        onCloseShot={() => setShot(null)}
        onCancelNaming={() => setNaming(false)}
      />
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
        confirmDelete={{ open: confirming === "delete", busy: deleting, onConfirm: handle_delete, onCancel: () => setConfirming(null) }}
        confirmRemove={{ open: !!widget_to_remove, busy: removing, onConfirm: handle_remove_widget, onCancel: () => setWidgetToRemove(null) }}
      />
    </div>
    </MapScopeProvider>
  );
}
