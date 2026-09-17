import React, { useEffect, useState } from "react";
import { resolve_icon } from "./iconLibraries.js";

/**
 * Draws one stored icon reference ("lucide:Cat", or a bare Tabler name) by
 * loading just that icon's library. Renders nothing until the library has
 * arrived, or when no library anywhere has the icon.
 *
 * A reference its own library no longer carries is not given up on: the
 * same icon is looked for by name in the other libraries (see
 * resolve_icon), so a renamed or moved icon still draws instead of leaving
 * a hole where a KPI card's icon or a map's marker should be.
 */
export default function LibraryIcon({ icon, size, color }) {
  const [found, setFound] = useState(null);

  useEffect(() => {
    if (!icon) {
      setFound(null);
      return undefined;
    }
    let is_mounted = true;
    setFound(null);
    resolve_icon(icon)
      .then((entry) => is_mounted && setFound(entry))
      .catch(() => is_mounted && setFound(null));
    return () => {
      is_mounted = false;
    };
  }, [icon]);

  if (!found) return null;
  return found.render(found.name, { size: size || 20, color });
}
