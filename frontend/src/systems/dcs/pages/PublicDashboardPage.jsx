import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { DcsLanguageProvider, useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { get_public_map_shapes, get_public_dashboard, get_public_dashboard_data, get_public_kpi_skipped, get_public_filter_values, get_public_widget_records, export_public_widget_records, request_error_text } from "../util-dashboard/dashboardService.js";
import RecordsOverlay from "../util-dashboard/records/RecordsOverlay.jsx";
import { applied_filter_map } from "../util-dashboard/boardFilters.js";
import { useBoardFullscreen } from "../util-dashboard/useBoardFullscreen.js";
import { useBoardData } from "../util-dashboard/useBoardData.js";
import { BoardThemeProvider, useBoardTheme } from "../util-dashboard/boardTheme.jsx";
import { Helmet } from "react-helmet-async";
import { MapScopeProvider, filter_names } from "../util-dashboard/mapScope.jsx";
import BoardHeader from "../util-dashboard/BoardHeader.jsx";
import BoardGrid from "../util-dashboard/BoardGrid.jsx";
import SkippedDetailsModal from "../util-dashboard/SkippedDetailsModal.jsx";
import ScreenshotStudio from "../util-dashboard/screenshot/ScreenshotStudio.jsx";
import DcsErrorBoundary from "../components/DcsErrorBoundary.jsx";
import DcsLoadingState from "../components/DcsLoadingState.jsx";

const SUPPORTS_ZOOM = typeof CSS !== "undefined" && CSS.supports && CSS.supports("zoom", "2");
const FONT = { fontFamily: "'Montserrat', sans-serif" };

/**
 * A form dashboard opened through a public share link: no sign-in, view
 * only. The same board as the signed-in page - live data refreshed every
 * 30 seconds, the period filter, the board's filters, the viewer's light /
 * dark mode and full screen - with nothing that edits, removes or
 * configures. The link's configuration decides the rest: filters are
 * either the viewer's to pick or fixed to the link's values (shown, not
 * changeable, and enforced by the server), and the title is the link's own
 * when the link says so. An unknown or expired link shows the server's
 * reason instead of the board.
 */
function PublicBoard() {
  const { token } = useParams();
  // Which of the link's dashboards is open: ?d=<id>, the link's own when absent.
  const [search_params, setSearchParams] = useSearchParams();
  const dashboard_id = search_params.get("d") || "";
  const { translate } = useDcsLanguage();
  const board = useBoardTheme();
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState("");
  const [info, setInfo] = useState(null);
  const [skipped_widget, setSkippedWidget] = useState(null);
  const [records, setRecords] = useState(null);
  const frozen_ref = useRef(false);

  useEffect(() => {
    let is_mounted = true;
    setLoading(true);
    setFailure("");
    get_public_dashboard(token, dashboard_id)
      .then((response) => is_mounted && setInfo(response.data || null))
      .catch((error) => is_mounted && setFailure(request_error_text(error, translate("DCS_ERROR_GENERIC"))))
      .finally(() => is_mounted && setLoading(false));
    return () => {
      is_mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, dashboard_id]);
  const open_id = (info && info.dashboard_id) || dashboard_id;
  const shared = (info && info.shared_dashboards) || [];
  const pick_dashboard = (next) => setSearchParams(next ? { d: next } : {});

  const widgets = useMemo(() => (info && info.widgets) || [], [info]);
  const form = useMemo(() => (info ? { form_group_id: info.form_group_id, form_name: info.form_name, schema: null } : { form_group_id: token, form_name: "", schema: null }), [info, token]);

  const data = useBoardData({
    scope_key: `${token}:${open_id}`,
    widgets,
    loading: loading || !info,
    blocked: false,
    frozen_ref,
    fetch_batch: (batch, period, applied) => get_public_dashboard_data(token, batch, period, applied, open_id),
  });
  const config = (info && info.link && info.link.config) || { filter_mode: "free", locked_filters: [], show_title: false };
  const locked = config.filter_mode === "locked";
  // Only the filters the link fixed are locked; the rest stay the viewer's ("All" by default).
  // A shared link can fix some filters itself: the map is scoped by those
  // too, exactly as the filter bar shows them.
  const map_scope = filter_names(locked ? { ...data.filter_values, ...applied_filter_map(config.locked_filters) } : data.filter_values);
  const board_title = (config.show_title && info && info.link && info.link.title) || (info && info.dashboard_name) || (info && info.form_name) || "";
  const locked_ids = useMemo(() => new Set(locked ? (config.locked_filters || []).map((entry) => entry.field_id) : []), [locked, config.locked_filters]);
  const fetch_filter_values = (field_id) => get_public_filter_values(token, field_id, data.applied_filters_ref.current, data.applied_period_ref.current, open_id).then((response) => (response.data && response.data.values) || []);
  // Several dashboards behind one link: the viewer picks which to open.
  const dashboard_picker =
    shared.length > 1 ? (
      <select
        className="dcs-board-chrome text-sm font-bold py-1 px-2 cursor-pointer"
        style={{ color: "var(--board-text, #333333)", backgroundColor: "var(--board-card, #FFFFFF)", border: "1px solid var(--board-border, #E0E0E0)", maxWidth: "100%", ...FONT }}
        value={open_id}
        onChange={(event) => pick_dashboard(event.target.value)}
        aria-label={translate("DCS_DB_PUBLIC_PICK_DASHBOARD")}
      >
        {shared.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.name}
          </option>
        ))}
      </select>
    ) : null;
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
  frozen_ref.current = shot !== null || records !== null;

  if (loading) return <DcsLoadingState />;

  if (failure || !info) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white border-2 p-8 text-center w-full" style={{ maxWidth: 480, borderColor: "#E0E0E0" }}>
          <p className="text-sm font-semibold mb-2" style={{ color: "#333333", ...FONT }}>
            {translate("DCS_DB_PUBLIC_UNAVAILABLE_TITLE")}
          </p>
          <p className="text-xs" style={{ color: "#9E9E9E" }}>
            {failure || translate("DCS_ERROR_GENERIC")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <MapScopeProvider fetchShapes={(names, held) => get_public_map_shapes(token, names, map_scope, held)} scopeKey={map_scope.join("|")}>
      {/* Which board this link opens, in the tab - the name the link was
          given, else the board's own, else the form's. */}
      {board_title ? (
        <Helmet>
          <title>{board_title}</title>
        </Helmet>
      ) : null}
    <div
      ref={container_ref}
      className={`dcs-board-root dcs-board-public dcs-board-no-select relative select-none flex-1 min-w-0 max-w-full ${board.is_dark ? "dcs-board-dark" : ""} ${is_fullscreen ? (is_fallback ? "fixed inset-0 z-[10000] " : "") + "dcs-board-fullscreen p-2 sm:p-4" : "p-3 sm:p-5 space-y-4"}`}
      style={{ backgroundColor: "var(--board-bg, #F4F7F9)", ...(is_fullscreen ? { width: "100%", height: "100%", overflowY: fs_mode === "fit" ? "hidden" : "auto" } : {}) }}
    >
      <BoardHeader
        form={form}
        title={dashboard_picker || (config.show_title && info.link && info.link.title) || info.dashboard_name || info.form_name || ""}
        widgets_count={widgets.length}
        can_edit={false}
        generating={false}
        reviewing={false}
        deleting={false}
        progress={{ percent: 0, message_key: "" }}
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
        filters={info.filters || []}
        fields={info.filter_fields || []}
        widgets={widgets}
        filterValues={locked ? { ...data.filter_values, ...applied_filter_map(config.locked_filters) } : data.filter_values}
        onFilterValue={data.set_filter_value}
        onFilterValues={data.set_filter_values}
        fetchFilterValues={fetch_filter_values}
        lockedFilterIds={locked_ids}
        lockedPeriod={locked ? config.locked_period || null : null}
        onScreenshot={open_screenshot}
      />
      {shot && <ScreenshotStudio form={{ ...form, dashboard_name: info.dashboard_name }} widgets={widgets} dataByWidget={shot.data} rects={shot.rects} base={shot.base} onClose={() => setShot(null)} />}
      {widgets.length === 0 ? (
        <div className="dcs-board-chrome border-2 p-8 text-center">
          <p className="text-sm font-semibold" style={{ color: "var(--board-text, #333333)", ...FONT }}>
            {translate("DCS_DB_EMPTY_TITLE")}
          </p>
        </div>
      ) : (
        <div ref={grid_ref} style={is_fullscreen && fs_mode === "fit" ? (SUPPORTS_ZOOM ? { zoom: fit_scale } : { transform: `scale(${fit_scale})`, transformOrigin: "top left", width: `${Math.round(10000 / fit_scale) / 100}%` }) : undefined}>
          <BoardGrid
            widgets={widgets}
            dataByWidget={data.data_by_widget}
            dataLoading={data.data_loading}
            fitMode={is_fullscreen && fs_mode === "fit"}
            editable={false}
            savingWidgetId={null}
            onUpdateWidget={() => {}}
            onRemoveWidget={() => {}}
            onRetryWidget={data.retry_widget}
            onShowSkipped={(target) => setSkippedWidget(target)}
            selection={null}
            onOpenRecords={config.allow_records ? (widget, pick) => setRecords({ widget, pick }) : undefined}
          />
        </div>
      )}
      {records && (
        <RecordsOverlay
          title={records.widget.title}
          subtitle={info.dashboard_name || ""}
          fetchPage={(page) => get_public_widget_records(token, { widget: records.widget, period: data.applied_period_ref.current, filters: data.applied_filters_ref.current, pick: records.pick, page, limit: 20, dashboard_id: open_id })}
          exportRecords={(on_progress) => export_public_widget_records(token, { widget: records.widget, period: data.applied_period_ref.current, filters: data.applied_filters_ref.current, pick: records.pick, dashboard_id: open_id }, on_progress)}
          onClose={() => setRecords(null)}
        />
      )}
      {skipped_widget && (
        <SkippedDetailsModal
          form={form}
          widget={skipped_widget}
          period={data.applied_period_ref.current}
          fetchSkipped={(widget, period, offset, limit) => get_public_kpi_skipped(token, widget, period, offset, limit, data.applied_filters_ref.current, open_id)}
          onClose={() => setSkippedWidget(null)}
        />
      )}
    </div>
    </MapScopeProvider>
  );
}

/**
 * Standalone public route: no authenticated shell and no page header - the
 * board and its filter bar are the page. The page carries no language
 * control, so it is pinned to English rather than following whatever the
 * viewer once chose elsewhere. Nothing may ever be wider than the screen.
 */
export default function PublicDashboardPage() {
  return (
    <DcsErrorBoundary>
      <DcsLanguageProvider fixedLanguage="en">
        <BoardThemeProvider>
          <div className="min-h-screen flex flex-col overflow-x-hidden" style={{ backgroundColor: "#F4F7F9", maxWidth: "100vw" }}>
            <PublicBoard />
          </div>
        </BoardThemeProvider>
      </DcsLanguageProvider>
    </DcsErrorBoundary>
  );
}
