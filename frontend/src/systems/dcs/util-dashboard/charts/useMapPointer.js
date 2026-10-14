import { useEffect } from "react";
import { create_layers, highlight, LAND_FILL } from "./mapDraw.js";

/**
 * The boundary layers and the pointer on a MapLibre map: the place under
 * the pointer is outlined and named in a tooltip, and a click on it opens
 * its records. Bound once per map; what a click calls is read through a
 * ref so the newest handler is always the one that runs.
 */
export function use_map_pointer(map, ready, is_heat, theme_ref, pick_ref, setTip) {
  useEffect(() => {
    if (!map || !ready || is_heat) return undefined;
    create_layers(map, theme_ref.current);
    const on_move = (event) => {
      const feature = (event.features || [])[0];
      if (!feature) return;
      const props = feature.properties || {};
      highlight(map, props.key);
      map.getCanvas().style.cursor = pick_ref.current ? "pointer" : "";
      setTip({ x: event.point.x, y: event.point.y, name: props.name, asked: props.asked, path: props.path });
    };
    const on_leave = () => {
      highlight(map, null);
      map.getCanvas().style.cursor = "";
      setTip(null);
    };
    const on_click = (event) => {
      const feature = (event.features || [])[0];
      if (feature && pick_ref.current) pick_ref.current({ label: feature.properties.asked });
    };
    map.on("mousemove", LAND_FILL, on_move);
    map.on("mouseleave", LAND_FILL, on_leave);
    map.on("click", LAND_FILL, on_click);
    return () => {
      map.off("mousemove", LAND_FILL, on_move);
      map.off("mouseleave", LAND_FILL, on_leave);
      map.off("click", LAND_FILL, on_click);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready, is_heat]);
}
