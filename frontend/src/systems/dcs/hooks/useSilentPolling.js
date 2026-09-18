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
 *
 * options.initial, when given, is what to show BEFORE the first answer -
 * usually what an earlier visit fetched. With it the first call is as
 * silent as every later one: no skeleton, no flash, the known list stays
 * on screen and is replaced the moment the fresh one lands. A function is
 * called with no arguments each time the deps change.
 */
export function useSilentPolling(fetchFn, intervalMs, deps, options) {
  const initial_of = () => {
    const held = options && options.initial;
    const value = typeof held === "function" ? held() : held;
    return value === undefined ? null : value;
  };
  const [data, setData] = useState(initial_of);
  const [loading, setLoading] = useState(() => initial_of() === null);
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

  useEffect(() => {
    // A new entity: show what is already known of it, or a skeleton if
    // nothing is, and ask.
    const known = initial_of();
    setData(known);
    setLoading(known === null);
    run(known === null);
    const interval_id = window.setInterval(() => {
      run(false);
    }, intervalMs || DEFAULT_POLL_INTERVAL_MS);
    return () => window.clearInterval(interval_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, intervalMs, ...dependency_list]);

  return { data, loading, error, refresh: () => run(false) };
}
