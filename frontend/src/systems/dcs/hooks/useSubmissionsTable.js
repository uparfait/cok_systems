import { useEffect, useRef, useState } from "react";
import { get_submissions } from "../services/submissionsService.js";

const PAGE_SIZE = 20;
const REFRESH_INTERVAL_MS = 10000;
const SEARCH_DEBOUNCE_MS = 400;
// The table opens on the running year rather than on everything ever
// collected: a form with years of records behind it should not make
// somebody wait for all of them before they can look at this year's.
const DEFAULT_PERIOD = "this_year";

/**
 * Shared submissions-table state for both data pages (per-version and
 * all-versions): page, date range, free-text search and sort direction,
 * all driving one paginated fetch. Refreshes itself silently every 10
 * seconds using whichever params were last actually applied (tracked in a
 * ref, not the live filter inputs), the same pattern the submissions chart
 * uses - a still-being-typed custom range or search term is never silently
 * fetched before it's actually ready.
 *
 * version is optional - passing one scopes every fetch to that single form
 * version; omitting it (undefined) fetches across every version.
 *
 * pinned_record_id, when set, narrows the table to that one record and
 * nothing else - what the gallery does when a picture is followed back
 * to the row it came from.
 *
 * column_filters are the per-column value picks the table's own header
 * dropdowns hold ({ field_id: [value, ...] }); they are applied on the
 * server, so a narrowed table is narrowed on every page and its total
 * counts only what is left.
 */
export function useSubmissionsTable(form_group_id, version, column_filters, pinned_record_id) {
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  // The range the rows on screen were actually fetched under. The pickers
  // above hold what is being typed, which is not the same thing until
  // Apply - and a column's own value dropdown has to describe the range
  // the table is showing, not one nobody has asked for yet.
  const [applied_range, setAppliedRange] = useState({ period: DEFAULT_PERIOD, from: "", to: "" });
  const applied_params_ref = useRef({ page: 1, period: DEFAULT_PERIOD, from: "", to: "", search: "", sort: "newest", filters: null, record: undefined });
  const is_first_filters_render_ref = useRef(true);
  const is_first_search_render_ref = useRef(true);

  // The pinned record travels inside params, never read from the closure:
  // the silent refresh below runs on an interval whose effect deliberately
  // does not depend on it, so a closure read there would keep sending the
  // record that was pinned when the page mounted - and the backend drops
  // the whole date window for a pinned record, which quietly collapsed the
  // table back to one row (or re-expanded it) ten seconds after every
  // pin/unpin.
  const build_params = (params) => Object.assign({ record: pinned_record_id || undefined }, params);

  const fetch_submissions = (params, silent) => {
    if (params.period === "custom" && !params.from) return;
    applied_params_ref.current = params;
    // Same object back when nothing moved, so the ten-second silent
    // refresh does not re-render the dropdowns for no reason.
    setAppliedRange((current) =>
      current.period === params.period && current.from === (params.from || "") && current.to === (params.to || "")
        ? current
        : { period: params.period, from: params.from || "", to: params.to || "" },
    );
    if (!silent) setLoading(true);
    get_submissions(form_group_id, version, params.page, PAGE_SIZE, params)
      .then((response) => setResult(response))
      .catch(() => {
        if (!silent) setResult(null);
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  };

  const handle_page_change = (next_page) => {
    setPage(next_page);
    fetch_submissions({ ...applied_params_ref.current, page: next_page }, false);
  };

  // applied_from/applied_to arrive from the custom-range popup's Apply -
  // the from/to state is not updated yet at that moment (React state
  // updates are async), so reading state alone would apply the PREVIOUS
  // range. The search box also calls this with no arguments; then state is
  // the right source.
  const handle_apply = (applied_from, applied_to) => {
    const next_from = typeof applied_from === "string" ? applied_from : from;
    const next_to = typeof applied_to === "string" ? applied_to : to;
    setPage(1);
    fetch_submissions(build_params({ page: 1, period, from: next_from, to: next_to, search, sort, filters: column_filters }), false);
  };

  // Re-fetches the current page with whatever params were last applied -
  // used after a row is deleted, so the table reflects it immediately
  // instead of waiting for the next 10-second silent refresh.
  const refresh = () => {
    fetch_submissions(applied_params_ref.current, false);
  };

  // Period/sort/version changes fetch immediately. A custom range still
  // needs its own explicit Apply before it is ever fetched (same as the
  // chart) - but once one HAS been applied, a sort or pin change here has
  // to re-fetch under it, instead of being swallowed by the guard and
  // leaving the table sorted the way it was.
  useEffect(() => {
    setPage(1);
    if (period !== "custom") {
      fetch_submissions(build_params({ page: 1, period, from: "", to: "", search, sort, filters: column_filters }), false);
    } else if (from) {
      fetch_submissions(build_params({ page: 1, period, from, to, search, sort, filters: column_filters }), false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, sort, version, form_group_id, pinned_record_id]);

  // Search is debounced and skipped on mount - the effect above already
  // covers the initial fetch, so re-running it here too would just double
  // the first request.
  useEffect(() => {
    if (is_first_search_render_ref.current) {
      is_first_search_render_ref.current = false;
      return undefined;
    }
    const timeout_id = window.setTimeout(() => {
      setPage(1);
      fetch_submissions(build_params({ page: 1, period, from, to, search, sort, filters: column_filters }), false);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Picking values in a column's own dropdown narrows the whole table,
  // so it starts again from page one. Skipped on mount for the same
  // reason the search effect is: the period effect already fetched.
  useEffect(() => {
    if (is_first_filters_render_ref.current) {
      is_first_filters_render_ref.current = false;
      return;
    }
    setPage(1);
    fetch_submissions(build_params({ page: 1, period, from, to, search, sort, filters: column_filters }), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(column_filters || {})]);

  useEffect(() => {
    const interval_id = window.setInterval(() => {
      fetch_submissions(applied_params_ref.current, true);
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form_group_id, version]);

  const total = (result && result.total) || 0;
  const total_pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return {
    page,
    // On a tracked form read inside a period: the moment the updatable
    // fields' values are shown as of (the period's end), else null.
    as_of: (result && result.as_of) || null,
    period,
    setPeriod,
    from,
    setFrom,
    to,
    setTo,
    // The range the rows on screen belong to, for anything that has to
    // agree with the table rather than with the pickers.
    applied_period: applied_range.period,
    applied_from: applied_range.from,
    applied_to: applied_range.to,
    search,
    setSearch,
    sort,
    setSort,
    submissions: (result && result.data) || [],
    total,
    total_pages,
    loading,
    handle_page_change,
    handle_apply,
    refresh,
  };
}
