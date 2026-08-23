import { useEffect, useRef, useState } from "react";
import { get_submissions } from "../services/submissionsService.js";

const PAGE_SIZE = 20;
const REFRESH_INTERVAL_MS = 10000;
const SEARCH_DEBOUNCE_MS = 400;

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
 */
export function useSubmissionsTable(form_group_id, version) {
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const applied_params_ref = useRef({ page: 1, period: "all", from: "", to: "", search: "", sort: "newest" });
  const is_first_search_render_ref = useRef(true);

  const fetch_submissions = (params, silent) => {
    if (params.period === "custom" && !params.from) return;
    applied_params_ref.current = params;
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

  const handle_apply = () => {
    setPage(1);
    fetch_submissions({ page: 1, period, from, to, search, sort }, false);
  };

  // Period/sort/version changes fetch immediately (custom range still needs
  // its own explicit Apply, same as the chart).
  useEffect(() => {
    setPage(1);
    if (period !== "custom") fetch_submissions({ page: 1, period, from: "", to: "", search, sort }, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, sort, version, form_group_id]);

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
      fetch_submissions({ page: 1, period, from, to, search, sort }, false);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

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
  };
}
