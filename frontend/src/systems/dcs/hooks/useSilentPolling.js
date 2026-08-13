import { useEffect, useRef, useState, useCallback } from "react";

const DEFAULT_POLL_INTERVAL_MS = 10000;

/**
 * Runs fetchFn immediately, then silently every intervalMs, without ever
 * flashing a loading state on the repeated calls - only the first call
 * toggles the loading flag. Used everywhere the system must "fetch new
 * changes every 10 seconds" without disturbing whatever the user is doing.
 *
 * A request already in flight is never overlapped with another one - if
 * another run is requested while one is still pending (a scheduled tick, or
 * navigating to a different entity), it is coalesced into a single extra
 * pass that fires the moment the in-flight call finishes, using whatever is
 * the latest fetchFn at that time. This keeps at most one request in flight
 * at once (so many polling components doing this together never pile up
 * requests and exhaust the browser's connection pool) while guaranteeing a
 * request for the latest target is never silently dropped.
 *
 * deps identifies which entity is being fetched (e.g. [project_id]) so
 * navigating to a different one refetches immediately instead of showing
 * the previous entity's stale data until the next scheduled poll.
 */
export function useSilentPolling(fetchFn, intervalMs, deps) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;
  const is_fetching_ref = useRef(false);
  const rerun_requested_ref = useRef(false);

  const run = useCallback(async (isFirstRun) => {
    if (is_fetching_ref.current) {
      rerun_requested_ref.current = true;
      return;
    }
    is_fetching_ref.current = true;
    do {
      rerun_requested_ref.current = false;
      try {
        const result = await fetchFnRef.current();
        setData(result);
        setError(null);
      } catch (fetch_error) {
        setError(fetch_error);
      } finally {
        if (isFirstRun) setLoading(false);
      }
    } while (rerun_requested_ref.current);
    is_fetching_ref.current = false;
  }, []);

  const dependency_list = deps || [];

  useEffect(() => {
    setLoading(true);
    run(true);
    const interval_id = window.setInterval(() => {
      run(false);
    }, intervalMs || DEFAULT_POLL_INTERVAL_MS);
    return () => window.clearInterval(interval_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, intervalMs, ...dependency_list]);

  return { data, loading, error, refresh: () => run(false) };
}
