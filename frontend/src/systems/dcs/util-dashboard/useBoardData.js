import { useEffect, useRef, useState } from "react";
import { widgets_data_signature } from "./chartCatalog.js";
import { applied_filter_list } from "./boardFilters.js";

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
 * fetch_batch(widgets, period, filters) is whichever endpoint fits the
 * caller - authenticated or public; filters are the board filters' applied
 * values, which every fetch (the silent refresh too) carries.
 * initialFilterValues seeds them (a share link's locked values). `blocked` pauses the signature-driven fetch
 * (a review list open), frozen_ref.current pauses the silent refresh.
 */
export function useBoardData({ scope_key, widgets, loading, blocked, frozen_ref, fetch_batch, initialFilterValues }) {
  const [data_by_widget, setDataByWidget] = useState({});
  const [data_loading, setDataLoading] = useState(false);
  // The dashboard opens on the current year by default - "all" stays one
  // click away in the period filter.
  const [period, setPeriod] = useState("this_year");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // The board filters' applied values: field_id -> value; absent means all.
  const [filter_values, setFilterValues] = useState(initialFilterValues || {});
  const applied_filters_ref = useRef(applied_filter_list(initialFilterValues || {}));

  const run_seq_ref = useRef(0);
  // How many loads the viewer is waiting on right now.
  const waiting_ref = useRef(0);
  const applied_period_ref = useRef({ preset: "this_year", from: null, to: null });
  const widgets_ref = useRef([]);
  widgets_ref.current = widgets;
  const data_ref = useRef({});
  data_ref.current = data_by_widget;
  const data_signature_ref = useRef("");

  const fetch_one = (widget, applied_period, run_id, silent) =>
    Promise.race([
      fetch_batch([widget], applied_period, applied_filters_ref.current),
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
    // The board is NEVER emptied to reload it: every card keeps the data
    // it has until its own new result replaces it, and the board marks
    // itself busy so the cards can cover themselves meanwhile.
    // Counted, not matched against the newest run id: a silent poll also
    // takes a run id, so a load that finishes after one started would never
    // recognise itself and the board would stay busy for ever. Every load
    // the viewer waits on adds one here and takes it back when it settles,
    // whether its results were still wanted or not, and the board is busy
    // for exactly as long as one of them is out.
    if (!silent) {
      waiting_ref.current += 1;
      setDataLoading(true);
    }
    Promise.allSettled(widget_list.map((widget) => fetch_one(widget, applied_period, run_id, silent))).then(() => {
      if (silent) return;
      waiting_ref.current = Math.max(0, waiting_ref.current - 1);
      if (waiting_ref.current === 0) setDataLoading(false);
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

  /** Applies several filter values at once ("" clears one) and refetches the whole board under them. */
  const set_filter_values = (patch) => {
    const next = { ...filter_values };
    Object.entries(patch || {}).forEach(([field_id, value]) => {
      if (value === "" || value === null || value === undefined) delete next[field_id];
      else next[field_id] = value;
    });
    setFilterValues(next);
    applied_filters_ref.current = applied_filter_list(next);
    fetch_data(widgets_ref.current, applied_period_ref.current, false);
  };
  const set_filter_value = (field_id, value) => set_filter_values({ [field_id]: value });
  /** Forgets the values of filters no longer on the board; refetches only if one was active. */
  const prune_filters = (defs) => {
    const keep = new Set((defs || []).map((def) => def.field_id));
    const next = Object.fromEntries(Object.entries(filter_values).filter(([id]) => keep.has(id)));
    if (Object.keys(next).length === Object.keys(filter_values).length) return;
    setFilterValues(next);
    applied_filters_ref.current = applied_filter_list(next);
    fetch_data(widgets_ref.current, applied_period_ref.current, false);
  };

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
    applied_filters_ref,
    filter_values,
    set_filter_value,
    set_filter_values,
    prune_filters,
    fetch_data,
    retry_widget,
    handle_period_apply,
    settle,
    keep_only,
    clear,
  };
}
