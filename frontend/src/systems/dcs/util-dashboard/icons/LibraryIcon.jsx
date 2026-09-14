import React, { useEffect, useState } from "react";
import { parse_icon_id, load_library } from "./iconLibraries.js";

/**
 * Draws one stored icon reference ("lucide:Cat", or a bare Tabler name)
 * by loading just that icon's library. Renders nothing until the library
 * has arrived or when the reference is unknown.
 */
export default function LibraryIcon({ icon, size, color }) {
  const parsed = parse_icon_id(icon);
  const library_id = parsed ? parsed.library : null;
  const [library, setLibrary] = useState(null);

  useEffect(() => {
    if (!library_id) return undefined;
    let is_mounted = true;
    setLibrary(null);
    load_library(library_id)
      .then((loaded) => is_mounted && setLibrary(loaded))
      .catch(() => is_mounted && setLibrary(null));
    return () => {
      is_mounted = false;
    };
  }, [library_id]);

  if (!parsed || !library) return null;
  return library.render(parsed.name, { size: size || 20, color });
}
