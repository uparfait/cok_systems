import { useEffect, useRef, useState } from "react";
import { widgets_data_signature } from "./chartCatalog.js";

const REFRESH_INTERVAL_MS = 30000;
// A request that drags past three minutes is cut off and its card marked
// red - such a widget likely causes errors or heavy computation.
const WIDGET_TIMEOUT_MS = 180000;

/**
 * The data side of a dashboard board, shared by the signed-in page and the
 * public share-link page: every widget fetches IN PARALLEL (one request per
 * widget, each card rendering the moment its own data lands, one failure
 * never blocking another), a silent refresh every 30 seconds that keeps
 * whatever a card already shows, a retry for one failed card, and the
 * board-wide period filter. Only a change to what a widget actually CHARTS
 * (see widgets_data_signature) refetches; callers settle the signature by
 * hand after edits that change nothing about the data.
 *
 * fetch_batch(widgets, period) is whichever endpoint fits the caller -
 * authenticated or public. `blocked` pauses the signature-driven fetch
 * (a review list open), frozen_ref.current pauses the silent refresh.
 */
export function useBoardData({ scope_key, widgets, loading, blocked, frozen_ref, fetch_batch }) {
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
  const data_ref = useRef({});
  data_ref.current = data_by_widget;
  const data_signature_ref = useRef("");

  const fetch_one = (widget, applied_period, run_id, silent) =>
    Promise.race([
      fetch_batch([widget], applied_period),
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

  // While blocked NOTHING fetches: the effect re-runs the moment the block
  // lifts and only then compares signatures, so a regenerated board loads
  // exactly once, after the user is done reviewing it.
  useEffect(() => {
    if (loading || blocked) return;
    const signature = widgets_data_signature(widgets);
    if (signature === data_signature_ref.current) return;
    data_signature_ref.current = signature;
    fetch_data(widgets, applied_period_ref.current, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, widgets, blocked]);

  useEffect(() => {
    const interval_id = window.setInterval(() => {
      if (frozen_ref && frozen_ref.current) return;
      fetch_data(widgets_ref.current, applied_period_ref.current, true);
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope_key]);

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
    if (loading || (frozen_ref && frozen_ref.current)) return;
    if (period !== "custom") {
      setFrom("");
      setTo("");
      const applied = period === "all" ? null : { preset: period, from: null, to: null };
      fetch_data(widgets, applied, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  /** Marks the given widget list as already fetched (an edit that changed no data). */
  const settle = (final_widgets) => {
    data_signature_ref.current = widgets_data_signature(final_widgets);
  };
  /** Drops the cached data of every widget not in the kept list. */
  const keep_only = (kept_widgets) => {
    const kept = new Set(kept_widgets.map((widget) => widget.id));
    setDataByWidget((current) => Object.fromEntries(Object.entries(current).filter(([id]) => kept.has(id))));
  };
  const clear = () => setDataByWidget({});

  return {
    data_by_widget,
    data_loading,
    period,
    setPeriod,
    from,
    setFrom,
    to,
    setTo,
    applied_period_ref,
    fetch_data,
    retry_widget,
    handle_period_apply,
    settle,
    keep_only,
    clear,
  };
}
