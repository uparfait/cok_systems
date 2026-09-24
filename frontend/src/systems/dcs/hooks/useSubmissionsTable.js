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
  const applied_params_ref = useRef({ page: 1, period: DEFAULT_PERIOD, from: "", to: "", search: "", sort: "newest", filters: null });
  const is_first_filters_render_ref = useRef(true);
  const is_first_search_render_ref = useRef(true);

  const fetch_submissions = (params, silent) => {
    if (params.period === "custom" && !params.from) return;
    applied_params_ref.current = params;
    if (!silent) setLoading(true);
    get_submissions(form_group_id, version, params.page, PAGE_SIZE, Object.assign({}, params, { record: pinned_record_id || undefined }))
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
    fetch_submissions({ page: 1, period, from: next_from, to: next_to, search, sort, filters: column_filters }, false);
  };

  // Re-fetches the current page with whatever params were last applied -
  // used after a row is deleted, so the table reflects it immediately
  // instead of waiting for the next 10-second silent refresh.
  const refresh = () => {
    fetch_submissions(applied_params_ref.current, false);
  };

  // Period/sort/version changes fetch immediately (custom range still needs
  // its own explicit Apply, same as the chart).
  useEffect(() => {
    setPage(1);
    if (period !== "custom") fetch_submissions({ page: 1, period, from: "", to: "", search, sort, filters: column_filters }, false);
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
      fetch_submissions({ page: 1, period, from, to, search, sort, filters: column_filters }, false);
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
    fetch_submissions({ page: 1, period, from, to, search, sort, filters: column_filters }, false);
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
    period,
    setPeriod,
    from,
    setFrom,
    to,
    setTo,
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
