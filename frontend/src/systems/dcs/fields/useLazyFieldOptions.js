import { useState, useEffect } from "react";

/**
 * Fetches a lazy select_group/cascading_select field's real options on
 * demand - only once should_fetch is true (the field is actually mounted/
 * visible AND, for a parent-dependent field, its parent already has a real
 * answer) and only again when fetch_key changes (e.g. the respondent picks
 * a different parent value). fetch_options is expected to already be a
 * cached/deduped call (see lazyOptionsCache.js) - this hook only owns
 * showing a loading state for whichever key is currently wanted and
 * discarding a still-in-flight fetch for a key the caller has since moved
 * on from, never a second layer of caching itself.
 */
export function useLazyFieldOptions(should_fetch, fetch_key, fetch_options) {
  const [state, setState] = useState({ key: null, options: [], loading: false });

  useEffect(() => {
    if (!should_fetch) return undefined;
    let cancelled = false;
    setState({ key: fetch_key, options: [], loading: true });
    Promise.resolve(fetch_options())
      .then((options) => {
        if (!cancelled) setState({ key: fetch_key, options: options || [], loading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ key: fetch_key, options: [], loading: false });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [should_fetch, fetch_key]);

  if (state.key !== fetch_key) return { options: [], loading: should_fetch };
  return state;
}
