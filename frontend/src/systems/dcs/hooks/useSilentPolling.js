import { useEffect, useRef, useState, useCallback } from "react";

const DEFAULT_POLL_INTERVAL_MS = 10000;

/**
 * Runs fetchFn immediately, then silently every intervalMs, without ever
 * flashing a loading state on the repeated calls - only the first call
 * toggles the loading flag. Used everywhere the system must "fetch new
 * changes every 10 seconds" without disturbing whatever the user is doing.
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

  const run = useCallback(async (isFirstRun) => {
    try {
      const result = await fetchFnRef.current();
      setData(result);
      setError(null);
    } catch (fetch_error) {
      setError(fetch_error);
    } finally {
      if (isFirstRun) setLoading(false);
    }
  }, []);

  const dependency_list = deps || [];

  // useEffect(() => {
  //   run(true);
  //   const interval_id = window.setInterval(() => {
  //     run(false);
  //   }, intervalMs || DEFAULT_POLL_INTERVAL_MS);
  //   return () => window.clearInterval(interval_id);
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [run, intervalMs, ...dependency_list]);

    useEffect(() => {
    run(true);
    const interval_id = window.setInterval(() => {
      run(false);
    }, 5000);
    return () => window.clearInterval(interval_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, intervalMs, ...dependency_list]);

  return { data, loading, error, refresh: () => run(false) };
}
