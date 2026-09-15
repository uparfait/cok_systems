import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { DcsLanguageProvider, useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { get_public_dashboard, get_public_dashboard_data, get_public_kpi_skipped, request_error_text } from "../util-dashboard/dashboardService.js";
import { useBoardFullscreen } from "../util-dashboard/useBoardFullscreen.js";
import { useBoardData } from "../util-dashboard/useBoardData.js";
import { BoardThemeProvider, useBoardTheme } from "../util-dashboard/boardTheme.jsx";
import BoardHeader from "../util-dashboard/BoardHeader.jsx";
import BoardGrid from "../util-dashboard/BoardGrid.jsx";
import SkippedDetailsModal from "../util-dashboard/SkippedDetailsModal.jsx";
import DcsLogoMark from "../components/DcsLogoMark.jsx";
import DcsLanguageSwitcher from "../components/DcsLanguageSwitcher.jsx";
import DcsErrorBoundary from "../components/DcsErrorBoundary.jsx";
import DcsLoadingState from "../components/DcsLoadingState.jsx";

const SUPPORTS_ZOOM = typeof CSS !== "undefined" && CSS.supports && CSS.supports("zoom", "2");
const FONT = { fontFamily: "'Montserrat', sans-serif" };

/**
 * A form dashboard opened through a public share link: no sign-in, view
 * only. The same board as the signed-in page - live data refreshed every
 * 30 seconds, the period filter, the viewer's light / dark mode and full
 * screen - with nothing that edits, removes or configures. An unknown or
 * expired link shows the server's reason instead of the board.
 */
function PublicBoard() {
  const { token } = useParams();
  const { translate } = useDcsLanguage();
  const board = useBoardTheme();
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState("");
  const [info, setInfo] = useState(null);
  const [skipped_widget, setSkippedWidget] = useState(null);
  const frozen_ref = useRef(false);

  useEffect(() => {
    let is_mounted = true;
    setLoading(true);
    get_public_dashboard(token)
      .then((response) => is_mounted && setInfo(response.data || null))
      .catch((error) => is_mounted && setFailure(request_error_text(error, translate("DCS_ERROR_GENERIC"))))
      .finally(() => is_mounted && setLoading(false));
    return () => {
      is_mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const widgets = useMemo(() => (info && info.widgets) || [], [info]);
  const form = useMemo(() => (info ? { form_group_id: info.form_group_id, form_name: info.form_name, schema: null } : { form_group_id: token, form_name: "", schema: null }), [info, token]);

  const data = useBoardData({
    scope_key: token,
    widgets,
    loading: loading || !info,
    blocked: false,
    frozen_ref,
    fetch_batch: (batch, period) => get_public_dashboard_data(token, batch, period),
  });
  const { container_ref, grid_ref, is_fullscreen, is_fallback, enter, exit, fs_mode, setFsMode, fit_scale, header_visible, show_header, schedule_header_hide } = useBoardFullscreen();

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
    <div
      ref={container_ref}
      className={`dcs-board-root dcs-board-no-select relative select-none flex-1 ${board.is_dark ? "dcs-board-dark" : ""} ${is_fullscreen ? (is_fallback ? "fixed inset-0 z-[10000] " : "") + "dcs-board-fullscreen p-2 sm:p-4" : "p-3 sm:p-5 space-y-4"}`}
      style={{ backgroundColor: "var(--board-bg, #F4F7F9)", ...(is_fullscreen ? { width: "100%", height: "100%", overflowY: fs_mode === "fit" ? "hidden" : "auto" } : {}) }}
    >
      {!is_fullscreen && (
        <div className="dcs-board-chrome border-2 px-3 py-2 sm:px-4 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-bold break-words" style={{ color: "var(--board-text, #333333)", ...FONT }}>
              {info.link.title}
            </p>
            {info.link.description && (
              <p className="text-xs mt-0.5 break-words" style={{ color: "var(--board-muted, #9E9E9E)" }}>
                {info.link.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px]" style={{ color: "var(--board-muted, #9E9E9E)", ...FONT }}>
            <span className="font-bold uppercase" style={{ letterSpacing: "0.4px" }}>
              {translate("DCS_DB_PUBLIC_VIEW_ONLY")}
            </span>
            {info.link.expires_at && <span>{translate("DCS_DB_PUBLIC_EXPIRES_ON", { date: new Date(info.link.expires_at).toLocaleDateString("en-GB", { dateStyle: "medium" }) })}</span>}
          </div>
        </div>
      )}
      <BoardHeader
        form={form}
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
      />
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
          />
        </div>
      )}
      {skipped_widget && (
        <SkippedDetailsModal
          form={form}
          widget={skipped_widget}
          period={data.applied_period_ref.current}
          fetchSkipped={(widget, period, offset, limit) => get_public_kpi_skipped(token, widget, period, offset, limit)}
          onClose={() => setSkippedWidget(null)}
        />
      )}
    </div>
  );
}

/** Standalone public route: its own language provider, no authenticated shell. */
export default function PublicDashboardPage() {
  const { translate } = { translate: (key) => key };
  void translate;
  return (
    <DcsErrorBoundary>
      <DcsLanguageProvider>
        <BoardThemeProvider>
          <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#F4F7F9" }}>
            <PublicTopBar />
            <PublicBoard />
          </div>
        </BoardThemeProvider>
      </DcsLanguageProvider>
    </DcsErrorBoundary>
  );
}

function PublicTopBar() {
  const { translate } = useDcsLanguage();
  return (
    <div className="cok-bg-primary px-4 py-2 flex items-center justify-between gap-3 flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <DcsLogoMark title={translate("DCS_HEADER_TITLE")} />
        <span className="text-white text-xs font-semibold uppercase tracking-wide truncate" style={FONT}>
          {translate("DCS_DB_PUBLIC_SHARED")}
        </span>
      </div>
      <DcsLanguageSwitcher />
    </div>
  );
}
