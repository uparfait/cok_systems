import { useEffect, useMemo, useState } from "react";

/**
 * The country location tree behind every API-sourced cascading_select
 * (see dc_backend/controllers/locations/get_locations.js), fetched once per
 * session and shared by whoever needs to OFFER real locations outside a
 * live form - the builder's default-value picker for instance. The stored
 * answer of such a field is always the location's NAME exactly as the tree
 * spells it (a province's raw name, never its translation), which is why a
 * value should be picked from here rather than typed.
 */

const LEVELS = ["provinces", "districts", "sectors", "cells", "villages"];
const CHILD_KEYS = ["districts", "sectors", "cells", "villages"];
const TREE_URL = "/dcs/api/locations/all?language=en";

let tree_promise = null;

export function fetch_location_tree() {
  if (!tree_promise) {
    tree_promise = fetch(TREE_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((result) => {
        if (!result || !result.success) throw new Error("locations unavailable");
        return result.data;
      })
      .catch((error) => {
        tree_promise = null;
        throw error;
      });
  }
  return tree_promise;
}

/** The whole tree with a loading flag, a failure flag and a retry. */
export function useLocationTree(enabled) {
  const [state, setState] = useState({ tree: null, loading: !!enabled, failed: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    let is_mounted = true;
    setState((previous) => ({ tree: previous.tree, loading: true, failed: false }));
    fetch_location_tree()
      .then((tree) => is_mounted && setState({ tree, loading: false, failed: false }))
      .catch(() => is_mounted && setState({ tree: null, loading: false, failed: true }));
    return () => {
      is_mounted = false;
    };
  }, [enabled, attempt]);
  return { tree: state.tree, loading: state.loading, failed: state.failed, retry: () => setAttempt((count) => count + 1) };
}

const normalize = (value) => String(value || "").toLowerCase().trim();
const item_name = (item) => (typeof item === "string" ? item : item.name);

function matches_name(item, wanted) {
  if (normalize(item_name(item)) === wanted) return true;
  const translations = typeof item === "object" && item ? item.translations : null;
  return translations ? Object.values(translations).some((entry) => normalize(entry) === wanted) : false;
}

const to_option = (item) => {
  const name = item_name(item);
  const translations = typeof item === "object" && item ? item.translations : null;
  return { value: name, label: (translations && (translations.en || translations.kn)) || name };
};

/**
 * Every location of one level as { value, label } options: the whole
 * country's when no ancestor is given, otherwise only those below the
 * location named ancestor_value (matched like the live renderer does, by
 * raw name or any translation). Names are deduplicated because the stored
 * answer is the name alone.
 */
export function locations_at_level(tree, level, ancestor_value) {
  const country = tree && tree.Rwanda;
  const depth = LEVELS.indexOf(level);
  if (!country || depth < 0) return [];
  const wanted = normalize(ancestor_value);
  const seen = new Set();
  const found = [];
  const walk = (items, index, under_ancestor) => {
    (items || []).forEach((item) => {
      if (index === depth) {
        if (wanted && !under_ancestor) return;
        const option = to_option(item);
        if (seen.has(option.value)) return;
        seen.add(option.value);
        found.push(option);
        return;
      }
      if (typeof item === "string") return;
      walk(item[CHILD_KEYS[index]], index + 1, under_ancestor || (!!wanted && matches_name(item, wanted)));
    });
  };
  walk(country.provinces, 0, false);
  return found;
}

export const is_api_location_field = (field) => !!(field && field.data_source && field.data_source.type === "api");
export const location_level = (field) => (field && field.data_source && field.data_source.level) || "provinces";

/** Options for one API-sourced field, narrowed by an ancestor's answer when known. */
export function useLocationOptions(field, ancestor_value) {
  const enabled = is_api_location_field(field);
  const { tree, loading, failed, retry } = useLocationTree(enabled);
  const level = location_level(field);
  const options = useMemo(() => (enabled && tree ? locations_at_level(tree, level, ancestor_value) : []), [enabled, tree, level, ancestor_value]);
  return { options, loading: enabled && loading, failed: enabled && failed, retry };
}
