import { useEffect, useMemo, useState } from "react";
import { ICON_LIBRARIES, load_library, search_key, icon_label, make_icon_id } from "./iconLibraries.js";

/**
 * Loads the requested libraries (all of them for a cross-library search)
 * one bundle at a time, exposing what has arrived so far: results appear
 * as each library lands instead of waiting for the slowest one.
 *
 * `paused` stops it: once a choice has been made there is nothing left to
 * search, so no further bundle is fetched and nothing is reported as
 * still on its way.
 */
export function useIconLibraries(library_ids, paused) {
  const [loaded, setLoaded] = useState({});
  const [failed, setFailed] = useState({});
  const wanted_key = library_ids.join("|");

  useEffect(() => {
    if (paused) return undefined;
    let is_mounted = true;
    library_ids.forEach((id) => {
      if (loaded[id] || failed[id]) return;
      load_library(id)
        .then((library) => {
          if (is_mounted && library) setLoaded((current) => (current[id] ? current : { ...current, [id]: library }));
        })
        .catch(() => is_mounted && setFailed((current) => ({ ...current, [id]: true })));
    });
    return () => {
      is_mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted_key, paused]);

  const pending = paused ? 0 : library_ids.filter((id) => !loaded[id] && !failed[id]).length;
  return { loaded, failed, pending };
}

/**
 * The searchable index of every loaded library: one entry per icon with
 * the pre-computed lowercase key the search matches against.
 */
export function useIconIndex(loaded, library_ids) {
  return useMemo(() => {
    const entries = [];
    library_ids.forEach((id) => {
      const library = loaded[id];
      if (!library) return;
      const definition = ICON_LIBRARIES.find((entry) => entry.id === id);
      library.names.forEach((name) => {
        entries.push({
          id: make_icon_id(id, name),
          library: id,
          library_label: definition ? definition.label : id,
          name,
          label: icon_label(name, id),
          key: search_key(name),
        });
      });
    });
    return entries;
  }, [loaded, library_ids.join("|")]);
}

/** Icons whose name contains every word of the query; closest names first. */
export function filter_icon_index(entries, query) {
  const words = String(query || "")
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);
  if (words.length === 0) return entries;
  const matches = entries.filter((entry) => words.every((word) => entry.key.includes(word)));
  const first = words[0];
  return matches.sort((a, b) => {
    const a_start = a.key.startsWith(first) ? 0 : 1;
    const b_start = b.key.startsWith(first) ? 0 : 1;
    if (a_start !== b_start) return a_start - b_start;
    return a.key.length - b.key.length;
  });
}
