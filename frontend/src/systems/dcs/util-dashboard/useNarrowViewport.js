import { useEffect, useState } from "react";
import { NARROW_PX } from "./freeFlow.js";

/** Whether a media query holds, kept current as the window is resized or turned. */
export function useMediaQuery(query) {
  const read = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;
  const [holds, setHolds] = useState(read);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia(query);
    const update = () => setHolds(media.matches);
    update();
    if (media.addEventListener) media.addEventListener("change", update);
    else media.addListener(update);
    return () => {
      if (media.removeEventListener) media.removeEventListener("change", update);
      else media.removeListener(update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);
  return holds;
}

/** Whether the window is a phone's width. */
export const useNarrowViewport = () => useMediaQuery(`(max-width: ${NARROW_PX - 1}px)`);

/**
 * A phone or a tablet: a screen with nothing to hover with, or narrow
 * enough that hovering is not how it is used. Controls that would wait for
 * a hover are simply shown.
 */
export const useTouchLikeViewport = () => useMediaQuery("(hover: none), (pointer: coarse), (max-width: 1024px)");
