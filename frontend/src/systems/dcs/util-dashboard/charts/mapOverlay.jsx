import { useEffect, useRef, useState } from "react";
import { Marker as GlMarker } from "maplibre-gl";

/**
 * Names and markers ride on the map as HTML, not as map layers: MapLibre
 * holds one empty element per place and keeps it over the right spot while
 * the map moves, and the widget renders React into it. That is what lets a
 * marker stay the icon component's own icon, in the widget's colors, and
 * keeps the writing from depending on the basemap's fonts.
 *
 * A place's NAME is only written when its own boundary is big enough on
 * screen to hold it - so nothing is ever written across a neighbour, and
 * zooming in is what reveals the rest. Its MARKERS are planted regardless:
 * a marker is small and stands for the place, so a small map still shows
 * where everything is, and a click on one goes there.
 */

// However far a viewer zooms out, the map never holds more than this many
// pieces of HTML.
const MAX_PLACES = 400;

export function usePlaceMarkers(map, ready, places) {
  const [shown, setShown] = useState([]);
  const held = useRef(new Map());

  useEffect(() => {
    if (!map || !ready) {
      setShown([]);
      return undefined;
    }
    const update = () => {
      const keep = [];
      places.forEach((place) => {
        if (keep.length >= MAX_PLACES) return;
        const near = map.project([place.box.min_x, place.box.max_y]);
        const far = map.project([place.box.max_x, place.box.min_y]);
        const roomy = Math.abs(far.x - near.x) >= place.needed[0] && Math.abs(far.y - near.y) >= place.needed[1];
        // A marker is planted however small the place is; its name is
        // only written when the place has room for it.
        if (!roomy && place.marks.length === 0) return;
        keep.push(roomy ? place : { ...place, label: "" });
      });
      const wanted = new Set(keep.map((place) => place.key));
      held.current.forEach((entry, key) => {
        if (wanted.has(key)) return;
        entry.marker.remove();
        held.current.delete(key);
      });
      setShown(
        keep.map((place) => {
          const found = held.current.get(place.key);
          if (found) return { ...place, element: found.element };
          const element = document.createElement("div");
          element.className = "dcs-map-place";
          const marker = new GlMarker({ element, anchor: "center" }).setLngLat(place.point).addTo(map);
          held.current.set(place.key, { marker, element });
          return { ...place, element };
        }),
      );
    };
    update();
    map.on("zoomend", update);
    map.on("moveend", update);
    return () => {
      map.off("zoomend", update);
      map.off("moveend", update);
      held.current.forEach((entry) => entry.marker.remove());
      held.current.clear();
      setShown([]);
    };
  }, [map, ready, places]);

  return shown;
}
