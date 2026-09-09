import React, { useEffect, useRef, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { get_dashboard, save_dashboard, get_dashboard_data } from "./dashboardService.js";
import { generate_and_save } from "./autoGenerate.js";
import { useBoardFullscreen } from "./useBoardFullscreen.js";
import { fold_family, widgets_data_signature } from "./chartCatalog.js";
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
  const header_ref = useRef(null);

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
  const data_signature_ref = useRef("");
  useEffect(() => {
    if (loading) return;
    const signature = widgets_data_signature(widgets);
    if (signature === data_signature_ref.current) return;
    data_signature_ref.current = signature;
    fetch_data(widgets, applied_period_ref.current, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, widgets]);

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
                  onRemove={can_edit && !generating ? () => setWidgetToRemove(widget) : undefined}
                  onChangeType={can_edit && !generating ? (next_type) => handle_update_widget(widget.id, { chart_type: next_type }) : undefined}
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
