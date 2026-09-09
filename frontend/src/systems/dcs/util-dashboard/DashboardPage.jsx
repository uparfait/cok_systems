import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { get_dashboard, save_dashboard, get_dashboard_data } from "./dashboardService.js";
import { generate_and_save } from "./autoGenerate.js";
import { useBoardFullscreen } from "./useBoardFullscreen.js";
import { IconButton, FULLSCREEN_SVG, EXIT_SVG, FIT_SVG, SCROLL_SVG, REFRESH_SVG, TRASH_SVG } from "./BoardIcons.jsx";
import GenerationProgress from "./GenerationProgress.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsConfirmDialog from "../components/DcsConfirmDialog.jsx";
import DcsLoadingState from "../components/DcsLoadingState.jsx";
import DcsPeriodFilter from "../components/DcsPeriodFilter.jsx";
import WidgetCard from "./WidgetCard.jsx";

const REFRESH_INTERVAL_MS = 30000;
const DANGER = "#E74C3C";

// Flexible auto-grow grid: every card carries a size-based flex-basis, and
// `grow` lets the items of an incomplete last row stretch over the leftover
// width instead of leaving an empty gap. Static class strings so Tailwind
// keeps them; mobile is always one full-width column.
const SIZE_CLASSES = {
  small: "grow basis-full sm:basis-[calc(50%-0.75rem)] xl:basis-[calc(25%-0.75rem)]",
  medium: "grow basis-full sm:basis-[calc(50%-0.75rem)] xl:basis-[calc(50%-0.75rem)]",
  large: "grow basis-full sm:basis-full xl:basis-[calc(75%-0.75rem)]",
  full: "grow basis-full",
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
  // The dashboard opens on the current year by default - "all" stays one
  // click away in the period filter.
  const [period, setPeriod] = useState("this_year");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const run_seq_ref = useRef(0);
  const applied_period_ref = useRef({ preset: "this_year", from: null, to: null });
  const widgets_ref = useRef([]);
  widgets_ref.current = widgets;

  // Browser-native full screen with two viewing modes: "fit" scales the
  // whole board so everything is on screen at once (a single widget grows to
  // fill it, a huge board shrinks), "scroll" keeps natural size and scrolls.
  const { container_ref, is_fullscreen, is_fallback, enter, exit } = useBoardFullscreen();
  const [fs_mode, setFsMode] = useState("fit");
  const [fit_scale, setFitScale] = useState(1);
  const [header_visible, setHeaderVisible] = useState(true);
  const grid_ref = useRef(null);
  const header_ref = useRef(null);
  const hide_timer_ref = useRef(null);

  // In full screen the header is fixed to the very top and lives on hover:
  // it slides away 100ms after the pointer leaves it, and an invisible strip
  // along the top edge brings it back the moment the pointer returns - all
  // with a smooth animation. A touch on the strip shows it for a moment.
  const cancel_header_hide = () => {
    if (hide_timer_ref.current) window.clearTimeout(hide_timer_ref.current);
  };
  const show_header = () => {
    cancel_header_hide();
    setHeaderVisible(true);
  };
  const schedule_header_hide = (delay_ms) => {
    cancel_header_hide();
    hide_timer_ref.current = window.setTimeout(() => setHeaderVisible(false), delay_ms);
  };

  useEffect(() => {
    if (!is_fullscreen) {
      cancel_header_hide();
      setHeaderVisible(true);
      return undefined;
    }
    setHeaderVisible(true);
    schedule_header_hide(100);
    return cancel_header_hide;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is_fullscreen]);

  // Fit mode keeps EVERYTHING on one screen at the LARGEST zoom possible:
  // a small board zooms IN to fill the viewport, a huge one zooms out just
  // enough that nothing hides behind a scrollbar. The header floats above
  // the board in full screen, so the whole container height belongs to the
  // grid. Zooming reflows the grid (its width changes in layout units), and
  // data streams in card by card, so a ResizeObserver keeps re-measuring
  // and re-zooming until the board settles - whatever changes, the fit
  // corrects itself. The 0.03 tolerance stops measure/zoom ping-pong.
  useLayoutEffect(() => {
    if (!is_fullscreen || fs_mode !== "fit") {
      setFitScale(1);
      return undefined;
    }
    const grid = grid_ref.current;
    const container = container_ref.current;
    if (!grid || !container) return undefined;

    let frame = null;
    const compute = () => {
      const available = container.clientHeight - 40;
      // The bounding rect is the VISUAL size on screen - it already includes
      // the current zoom (or transform), so the next factor is simply the
      // current one corrected by how far off the visual height is.
      const visual = grid.getBoundingClientRect().height;
      if (visual <= 0 || available <= 0) return;
      setFitScale((current) => {
        const desired = Math.min(3, Math.max(0.2, Math.floor((available / visual) * current * 100) / 100));
        return Math.abs(desired - current) > 0.03 ? desired : current;
      });
    };
    const schedule = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(compute);
    };

    compute();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    if (observer) observer.observe(grid);
    window.addEventListener("resize", schedule);
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is_fullscreen, fs_mode]);

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

  // The board NEVER asks for everything at once: widgets are fetched ONE BY
  // ONE, each request starting only after the previous one finished. Every
  // card renders the moment its own data lands, so the page fills in
  // progressively instead of freezing on one massive response and repaint.
  // A newer run (period change, regenerate, retry) invalidates the sequence
  // between any two requests.
  const fetch_data = async (widget_list, applied_period, silent) => {
    if (!widget_list || widget_list.length === 0) {
      setDataByWidget({});
      return;
    }
    const run_id = run_seq_ref.current + 1;
    run_seq_ref.current = run_id;
    applied_period_ref.current = applied_period;
    if (!silent) {
      setDataByWidget({});
      setDataLoading(true);
    }
    for (const widget of widget_list) {
      if (run_seq_ref.current !== run_id) return;
      try {
        const response = await get_dashboard_data(form.form_group_id, [widget], applied_period);
        if (run_seq_ref.current !== run_id) return;
        const result = ((response.data && response.data.results) || [])[0];
        if (result) setDataByWidget((current) => ({ ...current, [widget.id]: result }));
      } catch (error) {
        if (run_seq_ref.current !== run_id) return;
        // A silent refresh keeps whatever the card already shows; a
        // user-driven load marks just this card as failed and moves on.
        if (!silent) setDataByWidget((current) => ({ ...current, [widget.id]: { widget_id: widget.id, error: "FAILED" } }));
      }
    }
    if (run_seq_ref.current === run_id && !silent) setDataLoading(false);
  };

  // Retrying one failed card refetches ONLY that card - never the whole
  // board. The result is dropped if a newer full run started meanwhile.
  const retry_widget = async (widget) => {
    const run_id = run_seq_ref.current;
    setDataByWidget((current) => {
      const next = { ...current };
      delete next[widget.id];
      return next;
    });
    try {
      const response = await get_dashboard_data(form.form_group_id, [widget], applied_period_ref.current);
      if (run_seq_ref.current !== run_id) return;
      const result = ((response.data && response.data.results) || [])[0];
      setDataByWidget((current) => ({ ...current, [widget.id]: result || { widget_id: widget.id, error: "FAILED" } }));
    } catch (error) {
      if (run_seq_ref.current !== run_id) return;
      setDataByWidget((current) => ({ ...current, [widget.id]: { widget_id: widget.id, error: "FAILED" } }));
    }
  };

  // Text edits (title/description) also update the widgets state - only a
  // change to what a widget actually CHARTS refetches its data.
  const data_signature_ref = useRef("");
  useEffect(() => {
    if (loading) return;
    const signature = JSON.stringify(
      widgets.map((widget) => [
        widget.id,
        widget.chart_type,
        widget.metric,
        widget.group_by,
        widget.split_by,
        widget.x_field_id,
        widget.y_field_id,
        widget.size_field_id,
        widget.filters,
        widget.period,
        widget.sort,
        widget.limit,
      ]),
    );
    if (signature === data_signature_ref.current) return;
    data_signature_ref.current = signature;
    fetch_data(widgets, applied_period_ref.current, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, widgets]);

  // Click-to-edit on a card's title/description: the change is saved into
  // the form's dashboard right away, with a per-card spinner and a toast.
  const [saving_widget_id, setSavingWidgetId] = useState(null);
  const handle_update_widget = async (widget_id, changes) => {
    const next_widgets = widgets.map((widget) => (widget.id === widget_id ? { ...widget, ...changes } : widget));
    setSavingWidgetId(widget_id);
    try {
      const saved = await save_dashboard(form.form_group_id, next_widgets);
      setWidgets((saved.data && saved.data.widgets) || next_widgets);
      showSuccess(translate("DCS_DB_WIDGET_UPDATED"));
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setSavingWidgetId(null);
    }
  };

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
    <div
      ref={container_ref}
      className={`relative ${is_fullscreen ? (is_fallback ? "fixed inset-0 z-[10000] " : "") + "p-2 sm:p-4" : "pb-16 space-y-4"}`}
      style={
        is_fullscreen
          ? { backgroundColor: "#F4F7F9", width: "100%", height: "100%", overflowY: fs_mode === "fit" ? "hidden" : "auto" }
          : undefined
      }
    >
      {is_fullscreen && (
        // Invisible strip along the top edge: hovering it (or touching it)
        // slides the fixed header back in.
        <div
          className="fixed top-0 left-0 right-0"
          style={{ height: 22, zIndex: 29 }}
          onMouseEnter={show_header}
          onTouchStart={() => {
            show_header();
            schedule_header_hide(2500);
          }}
        />
      )}
      <div
        ref={header_ref}
        className="bg-white border-2 px-3 py-2 sm:px-4 flex flex-col gap-2"
        onMouseEnter={is_fullscreen ? show_header : undefined}
        onMouseLeave={is_fullscreen ? () => schedule_header_hide(100) : undefined}
        style={{
          borderColor: "#E0E0E0",
          ...(is_fullscreen
            ? {
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                zIndex: 30,
                opacity: header_visible ? 1 : 0,
                transform: header_visible ? "translateY(0)" : "translateY(-105%)",
                pointerEvents: header_visible ? "auto" : "none",
                transition: "opacity 240ms ease, transform 240ms ease",
                boxShadow: "0 6px 18px rgba(0,0,0,0.14)",
              }
            : {}),
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            className="min-w-0 truncate"
            style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 15, color: "#333333", textTransform: "uppercase", letterSpacing: "0.3px" }}
          >
            {translate("DCS_DB_BOARD_TITLE", { name: form.form_name || form.form_group_id })}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {is_fullscreen && (
              <IconButton title={translate("DCS_DB_FIT_MODE")} onClick={() => setFsMode("fit")} active={fs_mode === "fit"}>
                {FIT_SVG}
              </IconButton>
            )}
            {is_fullscreen && (
              <IconButton title={translate("DCS_DB_SCROLL_MODE")} onClick={() => setFsMode("scroll")} active={fs_mode === "scroll"}>
                {SCROLL_SVG}
              </IconButton>
            )}
            {widgets.length > 0 && !generating && (
              <IconButton
                title={translate(is_fullscreen ? "DCS_DB_EXIT_FULLSCREEN" : "DCS_DB_FULLSCREEN")}
                onClick={is_fullscreen ? exit : enter}
              >
                {is_fullscreen ? EXIT_SVG : FULLSCREEN_SVG}
              </IconButton>
            )}
            {can_edit && widgets.length > 0 && !generating && !is_fullscreen && (
              <>
                <IconButton title={translate("DCS_DB_REGENERATE")} onClick={() => setConfirming("generate")} disabled={deleting}>
                  {REFRESH_SVG}
                </IconButton>
                <IconButton title={translate("DCS_DB_BTN_DELETE")} onClick={() => setConfirming("delete")} danger disabled={deleting}>
                  {TRASH_SVG}
                </IconButton>
              </>
            )}
          </div>
          <style>{`.dcs-db-iconbtn { transition: background-color 160ms ease, color 160ms ease, transform 120ms ease; } .dcs-db-iconbtn:hover:not(:disabled) { transform: translateY(-1px); }`}</style>
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
                  onRetry={() => retry_widget(widget)}
                />
              </div>
            ))}
          </div>
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
