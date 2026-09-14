import React, { useEffect, useState } from "react";
import { load_tabler_icons, loaded_tabler_icons, is_icon_name } from "./tablerIcons.js";

/** The lazily loaded Tabler module, or null until it has arrived. */
export function useTablerIcons() {
  const [module, setModule] = useState(loaded_tabler_icons());
  useEffect(() => {
    if (module) return undefined;
    let is_mounted = true;
    load_tabler_icons().then((loaded) => is_mounted && setModule(loaded));
    return () => {
      is_mounted = false;
    };
  }, [module]);
  return module;
}

/**
 * One Tabler icon by its component name ("IconChartBar"). Renders nothing
 * while the icon set is still loading or when the name is unknown.
 */
export default function TablerIcon({ name, size, color, stroke }) {
  const module = useTablerIcons();
  if (!module || !is_icon_name(name)) return null;
  const Component = module[name];
  if (!Component) return null;
  return <Component size={size || 20} color={color} stroke={stroke || 1.8} aria-hidden="true" />;
}
