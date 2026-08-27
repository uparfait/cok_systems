/**
 * In-memory cache for lazily-fetched select_group/cascading_select options
 * (see dc_backend/jsonlogic/lazy_options.js) - once a respondent (or an
 * author previewing a form) has answered their way into one specific
 * branch of a huge cascade (e.g. one sector's cells), re-selecting that
 * exact same branch again later in the same session never re-fetches it.
 * Caches the in-flight PROMISE itself, not just the resolved value, so two
 * fields (or renders) asking for the same slice at the same moment share
 * one network request instead of firing it twice. Deliberately module-level
 * and session-only - a full page reload starts clean, matching how the
 * underlying form/template data itself is refetched on load anyway.
 */
const cache = new Map();

function build_cache_key(scope_type, scope_id, field_id, parent_value) {
  const parent_key = parent_value === undefined || parent_value === null ? "" : String(parent_value);
  return `${scope_type}:${scope_id}:${field_id}:${parent_key}`;
}

/**
 * Returns the cached promise for this exact (scope, field, parent value)
 * combination, calling fetcher() to populate it the first time only. A
 * rejected fetch is evicted so the next attempt (e.g. after the network
 * comes back) tries again instead of replaying the same failure forever.
 */
export function get_cached_field_options(scope_type, scope_id, field_id, parent_value, fetcher) {
  const key = build_cache_key(scope_type, scope_id, field_id, parent_value);
  if (cache.has(key)) return cache.get(key);

  const promise = Promise.resolve()
    .then(fetcher)
    .catch((error) => {
      cache.delete(key);
      throw error;
    });
  cache.set(key, promise);
  return promise;
}
