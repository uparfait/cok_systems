import { useEffect } from "react";
import { create_layers, highlight, LAND_FILL } from "./mapDraw.js";
import { points_within } from "./mapGeometry.js";

// How far around the pointer a heat-map click reaches, in pixels.
const HEAT_REACH_PX = 14;

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

/** The ground under a pixel and a reach around it, in degrees at the map's current zoom. */
export function box_under(map, point, reach) {
  const sw = map.unproject([point.x - reach, point.y + reach]);
  const ne = map.unproject([point.x + reach, point.y - reach]);
  return { south: Math.min(sw.lat, ne.lat), north: Math.max(sw.lat, ne.lat), west: Math.min(sw.lng, ne.lng), east: Math.max(sw.lng, ne.lng) };
}

/**
 * The pointer over a HEAT map: there are no boundaries to name, only the
 * positions the records were collected at. A click takes the small box of
 * ground under it and, when at least one record lies inside, opens the
 * records in that box - the point clicked, or the heat it is part of. The
 * pointer is a hand wherever a click would open something.
 */
export function use_heat_pointer(map, ready, is_heat, points_ref, pick_ref) {
  useEffect(() => {
    if (!map || !ready || !is_heat) return undefined;
    const found_under = (point) => points_within(points_ref.current, box_under(map, point, HEAT_REACH_PX));
    const on_move = (event) => {
      map.getCanvas().style.cursor = pick_ref.current && found_under(event.point).count > 0 ? "pointer" : "";
    };
    const on_click = (event) => {
      if (!pick_ref.current) return;
      const box = box_under(map, event.point, HEAT_REACH_PX);
      const found = points_within(points_ref.current, box);
      if (found.count === 0) return;
      pick_ref.current({ kind: "geo", box, lat: found.nearest.lat, lng: found.nearest.lng, count: found.count });
    };
    map.on("mousemove", on_move);
    map.on("click", on_click);
    return () => {
      map.off("mousemove", on_move);
      map.off("click", on_click);
      map.getCanvas().style.cursor = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready, is_heat]);
}
